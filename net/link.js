import { MqttClient } from './mqtt.js';
import { Room, topicsFor, randomCode, parseInvite, formatShareCode } from './room.js';

/**
 * Broker choices, in reachability order. Both are public test brokers: they give
 * us a relay without running a server, but they carry no SLA and every topic is
 * world-readable, so only scores and names travel through them.
 */
export const BROKERS = [
  { id: 'emqx', label: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'hivemq', label: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
];

/** How long a host listens for a retained snapshot before it trusts a code. */
const PROBE_MS = 450;
const CODE_ATTEMPTS = 6;
const PING_EVERY_MS = 2500;

export function newPlayerId() {
  return Math.random().toString(36).slice(2, 10);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect-timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Connect to the first reachable broker and wire one room onto it.
 *
 * @param {object} options
 * @param {'host'|'guest'} options.role
 * @param {string} [options.code] wanted code for a guest, optional hint for a host
 * @param {string} options.name
 * @param {string} options.playerId
 * @param {Array<{id: string, label: string, url: string}>} [options.brokers]
 * @param {(status: {phase: string, broker?: string}) => void} [options.onStatus]
 * @param {() => void} [options.onUpdate]
 * @param {number} [options.timeoutMs]
 */
export async function openRoom(options) {
  const {
    role, name, playerId, code: wanted, brokers = BROKERS,
    onStatus = () => {}, onUpdate = () => {}, timeoutMs = 9000,
  } = options;

  if (!globalThis.WebSocket) throw new Error('websocket-unavailable');

  // A tagged invite ("ABC234-E") names the relay that hosts the room; a bare
  // six-character code tries every relay in turn, which is what older invites did.
  const invite = parseInvite(wanted);
  if (role === 'guest' && !invite.code) throw new Error('bad-code');
  const candidates = invite.relay ? brokers.filter((broker) => broker.id === invite.relay) : brokers;
  if (!candidates.length) throw new Error('unknown-relay');
  const pinned = Boolean(invite.relay);

  let lastError = null;

  for (const broker of candidates) {
    onStatus({ phase: 'connecting', broker: broker.label });

    const client = new MqttClient({
      url: broker.url,
      clientId: `aimtrainer-${playerId}-${Math.random().toString(36).slice(2, 7)}`,
      keepalive: 30,
      autoReconnect: false,
    });

    try {
      await withTimeout(client.connect(), timeoutMs);
    } catch (error) {
      lastError = error;
      try { client.close(); } catch (_) { /* already down */ }
      continue;
    }

    onStatus({ phase: 'online', broker: broker.label });

    let code = '';
    let room = null;
    let closed = false;
    let probed = false;
    let pinged = 0;
    let pingTimer = 0;
    let initialState = null;
    let resolveAdmission;
    let rejectAdmission;
    const admission = new Promise((resolve, reject) => { resolveAdmission = resolve; rejectAdmission = reject; });
    // Host connections never wait on admission.
    admission.catch(() => {});

    const publishOut = ({ channel, payload, retain }) => {
      if (!code || closed) return;
      const topics = topicsFor(code);
      const topic = channel === 'state' ? topics.state : channel === 'ev' ? topics.events : topics.commands;
      const body = payload === null ? '' : JSON.stringify(payload);
      client.publish(topic, body, { retain: retain === true });
    };

    client.on('message', ({ topic, payload }) => {
      const topics = topicsFor(code);
      const channel = topic === topics.state ? 'state'
        : topic === topics.events ? 'ev'
          : topic === topics.commands ? 'cmd' : '';
      if (!channel) return;
      let parsed = null;
      try {
        parsed = payload ? JSON.parse(payload) : null;
      } catch (_) {
        return;
      }
      if (channel === 'state' && parsed && parsed.code === code) {
        probed = true;
        initialState = parsed;
      }
      if (!room) return;
      room.handle(channel, parsed);
      if (room.joinError) rejectAdmission(new Error(room.joinError));
      if (channel === 'state' && room.state.players.some((player) => player.id === playerId && player.online)) resolveAdmission();
      onUpdate();
    });

    client.on('close', () => {
      clearInterval(pingTimer);
      if (!closed) onStatus({ phase: 'offline', broker: broker.label });
    });

    const subscribe = (target) => {
      const topics = topicsFor(target);
      client.subscribe(topics.state);
      client.subscribe(topics.events);
      client.subscribe(topics.commands);
    };

    // Host: only trust a code that has no retained snapshot behind it, otherwise a
    // stranger's dead room would capture players who type the same six characters.
    if (role === 'host') {
      let candidate = invite.code;
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
        if (!candidate) candidate = randomCode();
        probed = false;
        code = candidate;
        subscribe(candidate);
        await wait(PROBE_MS);
        if (!probed) break;
        candidate = '';
        code = '';
      }
      if (!code) {
        closed = true;
        try { client.close(); } catch (_) { /* ignore */ }
        lastError = new Error('room-code-unavailable');
        continue;
      }
    } else {
      code = invite.code;
      subscribe(code);
      await wait(PROBE_MS);
    }

    room = new Room({ role, playerId, name, emit: publishOut, ...(options.app ? { app: options.app } : {}) });

    if (role === 'host') room.createRoom(code);
    else {
      room.code = code;
      if (initialState && initialState.app !== room.app) {
        closed = true;
        try { client.close(); } catch (_) { /* already down */ }
        onStatus({ phase: 'error', broker: broker.label, reason: 'app-mismatch' });
        throw new Error('app-mismatch');
      }
      if (initialState) room.handle('state', initialState);
      room.joinRoom(code);
      try {
        await withTimeout(admission, timeoutMs);
      } catch (error) {
        closed = true;
        try { client.close(); } catch (_) { /* already down */ }
        if (['room-full', 'match-in-progress', 'app-mismatch'].includes(error.message)) {
          onStatus({ phase: 'error', broker: broker.label, reason: error.message });
          throw error;
        }
        lastError = error.message === 'connect-timeout' ? new Error('room-not-found') : error;
        continue;
      }
    }

    if (role === 'guest') {
      // The offset estimate needs a few samples; ping fast at first, then relax.
      pingTimer = setInterval(() => {
        if (closed) return;
        room.sendPing();
        pinged += 1;
        if (pinged > 4 && pingTimer) {
          clearInterval(pingTimer);
          pingTimer = setInterval(() => { if (!closed) room.sendPing(); }, 20000);
        }
      }, PING_EVERY_MS);
    }

    onUpdate();

    return {
      room,
      code,
      shareCode: formatShareCode(code, broker.id),
      broker: broker.label,
      close() {
        if (closed) return;
        clearInterval(pingTimer);
        try { room.leave(); } catch (_) { /* nothing to tell */ }
        closed = true;
        setTimeout(() => { try { client.close(); } catch (_) { /* gone */ } }, 80);
      },
    };
  }

  // With a tagged invite we never silently try another relay: either that relay
  // is unreachable, or it is reachable and no such room is hosted there.
  if (pinned && lastError && lastError.message !== 'room-not-found') throw new Error('relay-unreachable');
  throw lastError || new Error('no-broker');
}
