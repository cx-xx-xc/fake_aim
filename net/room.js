/**
 * Room / match logic, transport-agnostic.
 *
 * Nothing here touches the network, React or cordis: the caller supplies an
 * `emit` sink and a clock, which is what makes the whole match flow testable
 * from Node without a browser.
 */

export const PROTO = 1;
export const APP_VERSION = '1.2.2';

/** Room codes avoid 0/O/1/I so they survive being read aloud or typed. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

export const COUNTDOWN_MS = 3000;
export const MAX_PLAYERS = 2;

export const DRILLS = {
  click: { durationMs: 30000, label: 'click' },
  reaction: { rounds: 8, label: 'reaction' },
};

const TOPIC_ROOT = 'fakeaim/v1';

export function topicsFor(code) {
  return {
    state: `${TOPIC_ROOT}/room/${code}/state`,
    events: `${TOPIC_ROOT}/room/${code}/ev`,
    commands: `${TOPIC_ROOT}/room/${code}/cmd`,
  };
}

export function randomCode(random = Math.random) {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Accepts "7k3q 9f", "7K3Q-9F" or a whole invite sentence. */
export function normalizeCode(input) {
  const cleaned = String(input ?? '')
    .toUpperCase()
    .split('')
    .filter((char) => CODE_ALPHABET.includes(char))
    .join('');
  return cleaned.length === CODE_LENGTH ? cleaned : '';
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Both players consume this exact sequence, so the "board" is identical and
 * only reaction time differs. Positions are normalised (0..1) arena coordinates.
 */
export function buildTargets(seed, count = 200) {
  const next = mulberry32(seed);
  const targets = [];
  while (targets.length < count) {
    const candidate = {
      x: 0.06 + next() * 0.88,
      y: 0.08 + next() * 0.84,
      r: 0.024 + next() * 0.012,
    };
    const crowded = targets.slice(-4).some((other) => {
      const dx = other.x - candidate.x;
      const dy = other.y - candidate.y;
      return Math.hypot(dx, dy) < 0.13;
    });
    if (!crowded) targets.push(candidate);
  }
  return targets;
}

/**
 * samples: [{ t0: localSentAt, t1: hostReceivedAt, t2: localReceivedAt }]
 * Returns the clock offset that converts host time -> local time, using the
 * lowest-RTT sample (least queueing noise).
 */
export function estimateClockOffset(samples) {
  if (!samples.length) return { offset: 0, rtt: 0 };
  let best = null;
  for (const sample of samples) {
    const rtt = sample.t2 - sample.t0;
    if (!best || rtt < best.rtt) {
      best = { rtt, offset: sample.t1 - (sample.t0 + rtt / 2) };
    }
  }
  return { offset: best.offset, rtt: best.rtt };
}

const emptyState = (code, hostId) => ({
  type: 'state',
  proto: PROTO,
  app: APP_VERSION,
  code,
  hostId,
  phase: 'lobby',
  mode: 'click',
  seed: 0,
  startAt: 0,
  durationMs: DRILLS.click.durationMs,
  results: {},
  players: [],
});

export class Room {
  /**
   * @param {object} options
   * @param {'host'|'guest'} options.role
   * @param {string} options.playerId
   * @param {string} options.name
   * @param {(out: {channel: 'state'|'ev'|'cmd', payload: object|null, retain?: boolean}) => void} options.emit
   * @param {() => number} [options.now]
   */
  constructor({ role, playerId, name, emit, now = () => Date.now(), app = APP_VERSION }) {
    this.role = role;
    this.playerId = playerId;
    this.name = name;
    this.app = app;
    this.emit = emit;
    this.now = now;
    this.code = '';
    this.state = emptyState('', '');
    this.results = {};
    this.clock = { offset: 0, rtt: 0 };
    this.pingSamples = [];
    this.seq = 0;
  }

  get isHost() {
    return this.role === 'host';
  }

  publish(channel, payload, retain = false) {
    this.emit({ channel, payload, retain });
  }

  // ---------------------------------------------------------------- lifecycle

  createRoom(code) {
    this.code = code;
    this.state = emptyState(code, this.playerId);
    this.state.players = [this.playerRecord()];
    this.publishState();
    return code;
  }

  joinRoom(code) {
    this.code = code;
    this.publish('cmd', {
      type: 'join',
      from: this.playerId,
      name: this.name,
      app: this.app,
      v: PROTO,
    });
  }

  playerRecord() {
    return { id: this.playerId, name: this.name, ready: false, app: this.app, online: true };
  }

  publishState() {
    this.state.players = this.state.players.map((player) =>
      player.id === this.playerId ? { ...player, name: this.name, app: this.app } : player,
    );
    this.publish('state', { ...this.state }, true);
  }

  // -------------------------------------------------------------- host actions

  setReady(ready) {
    if (this.isHost) {
      const player = this.state.players.find((item) => item.id === this.playerId);
      if (player) player.ready = ready;
      this.publishState();
      return;
    }
    this.publish('cmd', { type: 'ready', from: this.playerId, ready });
  }

  startMatch(mode = 'click') {
    if (!this.isHost) return false;
    if (this.state.players.length < MAX_PLAYERS) return false;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const startAt = this.now() + COUNTDOWN_MS;
    this.state.phase = 'countdown';
    this.state.mode = mode;
    this.state.seed = seed;
    this.state.startAt = startAt;
    this.state.durationMs = DRILLS[mode]?.durationMs ?? 0;
    this.state.matchId = `${this.playerId}:${startAt}:${++this.seq}`;
    this.state.rematchRequested = null;
    this.opponentProgress = null;
    this.state.results = {};
    this.results = {};
    this.publishState();
    this.publish('ev', {
      type: 'start',
      from: this.playerId,
      matchId: this.state.matchId,
      mode,
      seed,
      startAt,
      durationMs: this.state.durationMs,
      rounds: DRILLS[mode]?.rounds ?? 0,
      v: PROTO,
    });
    return true;
  }

  // ------------------------------------------------------------ both sides act

  /** Milliseconds until the drill starts on this machine (negative = late). */
  msUntilStart() {
    if (!this.state.startAt) return null;
    const localStart = this.state.startAt - this.clock.offset;
    return localStart - this.now();
  }

  beginPlay() {
    this.state.phase = 'playing';
  }

  reportProgress({ score, hits = 0, misses = 0, acc = 0, round = 0 }) {
    this.publish('ev', {
      type: 'progress',
      from: this.playerId,
      matchId: this.state.matchId,
      score,
      hits,
      misses,
      acc,
      round,
      v: PROTO,
    });
  }

  finish(result) {
    if (!this.state.matchId || this.results[this.playerId]) return;
    this.recordResult(this.playerId, result);
    this.publish('ev', { type: 'finish', from: this.playerId, matchId: this.state.matchId, result, v: PROTO });
  }

  rematch() {
    if (this.state.phase !== 'finished') return;
    if (this.isHost) {
      this.startMatch(this.state.mode);
      return;
    }
    this.publish('cmd', { type: 'rematch', from: this.playerId, matchId: this.state.matchId });
  }

  returnToLobby() {
    if (this.state.phase !== 'finished') return;
    if (!this.isHost) {
      this.publish('cmd', { type: 'lobby', from: this.playerId, matchId: this.state.matchId });
      return;
    }
    this.state.phase = 'lobby';
    this.state.startAt = 0;
    this.state.matchId = null;
    this.state.rematchRequested = null;
    this.state.players = this.state.players.map((player) => ({ ...player, ready: false }));
    this.state.results = {};
    this.results = {};
    this.opponentProgress = null;
    this.publishState();
  }

  leave() {
    this.publish('ev', { type: 'leave', from: this.playerId, v: PROTO });
    if (this.isHost) {
      // Retained state must be cleared or the code looks alive forever on a public broker.
      this.publish('state', null, true);
    }
  }

  // -------------------------------------------------------------- clock sync

  sendPing() {
    this.publish('cmd', { type: 'ping', from: this.playerId, t0: this.now(), v: PROTO });
  }

  handlePong({ t0, t1 }) {
    const t2 = this.now();
    this.pingSamples.push({ t0, t1, t2 });
    this.clock = estimateClockOffset(this.pingSamples);
    return this.clock;
  }

  // ------------------------------------------------------------------ inbound

  /** @returns {string} a short description of what happened, for tests/logs */
  handle(channel, payload) {
    if (!payload || typeof payload !== 'object') return 'empty';
    if (channel === 'state') return this.handleState(payload);
    if (payload.v !== undefined && payload.v !== PROTO) return 'proto-mismatch';
    if (payload.from === this.playerId && channel !== 'cmd') return 'self';
    if (channel === 'ev') return this.handleEvent(payload);
    if (channel === 'cmd') return this.handleCommand(payload);
    return 'ignored';
  }

  handleState(next) {
    if (next.code !== this.code) return 'wrong-room';
    if (next.proto !== PROTO) return 'proto-mismatch';
    // The host owns the state. Its MQTT subscription echoes older snapshots.
    if (this.isHost) return 'self-state';
    const previousPhase = this.state.phase;
    const sameMatch = Boolean(next.matchId && next.matchId === this.state.matchId);
    const localResult = sameMatch ? this.results[this.playerId] : null;
    if (!sameMatch) this.opponentProgress = null;
    this.state = {
      ...this.state,
      ...next,
      players: next.players.map((player) => ({ ...player })),
      results: { ...next.results },
    };
    if (localResult && !this.state.results[this.playerId]) this.state.results[this.playerId] = localResult;
    this.results = { ...this.state.results };
    if (this.role === 'guest' && previousPhase !== next.phase) {
      return `phase:${next.phase}`;
    }
    return 'state';
  }

  handleEvent(message) {
    if (message.type === 'start') {
      if (this.isHost || message.from !== this.state.hostId) return 'ignored-start';
      if (this.state.matchId === message.matchId) return 'same-match';
      this.state.matchId = message.matchId;
      this.state.results = {};
      this.results = {};
      this.opponentProgress = null;
      this.state.phase = 'countdown';
      this.state.mode = message.mode;
      this.state.seed = message.seed;
      this.state.startAt = message.startAt;
      this.state.durationMs = message.durationMs;
      this.state.rounds = message.rounds;
      return 'start';
    }
    if (message.type === 'progress' || message.type === 'finish') {
      if (!this.state.matchId || message.matchId !== this.state.matchId) return 'old-match';
      if (!this.state.players.some((player) => player.id === message.from)) return 'unknown-player';
    }
    if (message.type === 'progress') {
      if (!this.results[message.from]) this.opponentProgress = message;
      return 'progress';
    }
    if (message.type === 'finish') {
      if (this.isHost && !this.results[message.from]) this.recordResult(message.from, message.result);
      return 'finish';
    }
    if (message.type === 'pong') {
      if (!this.isHost) this.handlePong({ t0: message.t0, t1: message.t1 });
      return 'pong';
    }
    if (message.type === 'leave') {
      this.state.players = this.state.players.map((player) =>
        player.id === message.from ? { ...player, online: false } : player,
      );
      if (this.isHost) this.publishState();
      return 'leave';
    }
    return 'event';
  }

  handleCommand(message) {
    if (!this.isHost) {
      if (message.type === 'pong') return this.handleEvent({ type: 'pong', ...message });
      return 'not-host';
    }
    if (message.type === 'join') {
      if (message.app !== this.app) return 'app-mismatch';
      const exists = this.state.players.some((player) => player.id === message.from);
      if (!exists) {
        if (this.state.players.length >= MAX_PLAYERS) return 'room-full';
        this.state.players.push({
          id: message.from,
          name: message.name || 'player',
          ready: false,
          app: message.app,
          online: true,
        });
      }
      this.publishState();
      return 'join';
    }
    if (message.type === 'ready') {
      const player = this.state.players.find((item) => item.id === message.from);
      if (player) player.ready = message.ready === true;
      this.publishState();
      return 'ready';
    }
    if (message.type === 'ping') {
      this.publish('ev', { type: 'pong', from: this.playerId, t0: message.t0, t1: this.now(), v: PROTO });
      return 'ping';
    }
    if (message.type === 'rematch' || message.type === 'lobby') {
      if (this.state.phase !== 'finished' || message.matchId !== this.state.matchId) return 'old-match';
      if (!this.state.players.some((player) => player.id === message.from)) return 'unknown-player';
      if (message.type === 'lobby') this.returnToLobby();
      else {
        this.state.rematchRequested = message.from;
        this.publishState();
      }
      return message.type;
    }
    return 'command';
  }

  recordResult(playerId, result) {
    this.results[playerId] = result;
    this.state.results = { ...this.results };
    const everyoneDone = this.state.players.every((player) => this.results[player.id]);
    if (everyoneDone) this.state.phase = 'finished';
    if (this.isHost) this.publishState();
  }
}
