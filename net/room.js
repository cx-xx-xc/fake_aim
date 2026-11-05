/**
 * Room / match logic, transport-agnostic.
 *
 * Nothing here touches the network, React or cordis: the caller supplies an
 * `emit` sink and a clock, which is what makes the whole match flow testable
 * from Node without a browser.
 */

export const PROTO = 1;
export const APP_VERSION = '1.3.0';

/** Room codes avoid 0/O/1/I so they survive being read aloud or typed. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

export const COUNTDOWN_MS = 3000;
export const MAX_PLAYERS = 5;

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
  rounds: 8,
  participantIds: [],
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
    this.pendingPings = new Set();
    this.progress = {};
    this.opponentProgress = null;
    this.joinError = null;
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
    if (this.state.phase !== 'lobby') return;
    if (this.isHost) {
      const player = this.state.players.find((item) => item.id === this.playerId);
      if (player) player.ready = ready;
      this.publishState();
      return;
    }
    this.publish('cmd', { type: 'ready', from: this.playerId, ready });
  }

  setReactionRounds(rounds) {
    if (!this.isHost || this.state.phase !== 'lobby' || !Number.isInteger(rounds) || rounds < 5 || rounds > 20) return false;
    this.state.rounds = rounds;
    this.publishState();
    return true;
  }

  startMatch(mode = 'click', { rounds = this.state.rounds ?? 8 } = {}) {
    if (!this.isHost || !['lobby', 'finished'].includes(this.state.phase) || !DRILLS[mode]) return false;
    const online = this.state.players.filter((player) => player.online);
    if (online.length < 2 || online.length > MAX_PLAYERS || online.some((player) => !player.ready)) return false;
    if (mode === 'reaction' && (!Number.isInteger(rounds) || rounds < 5 || rounds > 20)) return false;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const startAt = this.now() + COUNTDOWN_MS;
    // Offline participants remain on the finished scoreboard until the next match.
    this.state.players = online.map((player) => ({ ...player, withdrawn: false }));
    this.state.participantIds = online.map((player) => player.id);
    this.state.phase = 'countdown';
    this.state.mode = mode;
    if (mode === 'reaction') this.state.rounds = rounds;
    this.state.seed = seed;
    this.state.startAt = startAt;
    this.state.durationMs = DRILLS[mode].durationMs ?? 0;
    this.state.matchId = `${this.playerId}:${startAt}:${++this.seq}`;
    this.state.rematchRequested = null;
    this.progress = {};
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
      rounds: this.state.rounds,
      participantIds: [...this.state.participantIds],
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
    if (this.state.phase === 'countdown') this.state.phase = 'playing';
  }

  activeParticipant(playerId) {
    return ['countdown', 'playing'].includes(this.state.phase)
      && this.state.participantIds.includes(playerId)
      && this.state.players.some((player) => player.id === playerId && player.online && !player.withdrawn);
  }

  reportProgress({ score, hits = 0, misses = 0, acc = 0, round = 0 }) {
    if (!this.activeParticipant(this.playerId) || this.results[this.playerId]) return;
    const message = {
      type: 'progress',
      from: this.playerId,
      matchId: this.state.matchId,
      score,
      hits,
      misses,
      acc,
      round,
      v: PROTO,
    };
    this.progress[this.playerId] = message;
    this.publish('ev', message);
  }

  finish(result) {
    if (!this.activeParticipant(this.playerId) || this.results[this.playerId]) return;
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
    this.state.players = this.state.players.filter((player) => player.online).map((player) => ({ ...player, ready: false }));
    this.state.participantIds = [];
    this.state.results = {};
    this.results = {};
    this.progress = {};
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
    const t0 = this.now();
    this.pendingPings.add(t0);
    if (this.pendingPings.size > 20) this.pendingPings.delete(this.pendingPings.values().next().value);
    this.publish('cmd', { type: 'ping', from: this.playerId, t0, v: PROTO });
  }

  handlePong({ t0, t1 }) {
    if (!this.pendingPings.delete(t0) || !Number.isFinite(t1)) return this.clock;
    const t2 = this.now();
    this.pingSamples.push({ t0, t1, t2 });
    if (this.pingSamples.length > 20) this.pingSamples.shift();
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
    if (!sameMatch) {
      this.opponentProgress = null;
      this.progress = {};
    }
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
    if (message.type === 'join-rejected') {
      if (this.isHost || message.to !== this.playerId) return 'not-addressed';
      this.joinError = message.reason;
      return message.reason;
    }
    if (message.type === 'start') {
      if (this.isHost || message.from !== this.state.hostId) return 'ignored-start';
      if (this.state.matchId === message.matchId) return 'same-match';
      this.state.matchId = message.matchId;
      this.state.results = {};
      this.results = {};
      this.progress = {};
      this.opponentProgress = null;
      this.state.participantIds = message.participantIds ?? this.state.players.filter((player) => player.online).map((player) => player.id);
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
      if (!this.state.participantIds.includes(message.from)) return 'unknown-player';
      if (!this.activeParticipant(message.from)) return 'inactive-player';
    }
    if (message.type === 'progress') {
      if (!this.results[message.from]) {
        this.progress[message.from] = message;
        this.opponentProgress = message;
      }
      return 'progress';
    }
    if (message.type === 'finish') {
      if (this.isHost && !this.results[message.from]) this.recordResult(message.from, message.result);
      return 'finish';
    }
    if (message.type === 'pong') {
      if (this.isHost || message.to !== this.playerId || message.from !== this.state.hostId) return 'not-addressed';
      this.handlePong({ t0: message.t0, t1: message.t1 });
      return 'pong';
    }
    if (message.type === 'leave') {
      const player = this.state.players.find((item) => item.id === message.from);
      if (!player) return 'unknown-player';
      if (this.state.phase === 'lobby' && message.from !== this.state.hostId) {
        this.state.players = this.state.players.filter((item) => item.id !== message.from);
      } else {
        player.online = false;
        player.ready = false;
        player.withdrawn = true;
        if (this.isHost && this.state.participantIds.includes(message.from) && !this.results[message.from]) {
          this.recordResult(message.from, { score: 0, dnf: true, withdrawn: true });
        }
      }
      delete this.progress[message.from];
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
      const reject = (reason) => {
        this.publish('ev', { type: 'join-rejected', from: this.playerId, to: message.from, reason, v: PROTO });
        return reason;
      };
      if (message.app !== this.app) return reject('app-mismatch');
      if (this.state.phase !== 'lobby') return reject('match-in-progress');
      const exists = this.state.players.some((player) => player.id === message.from);
      if (!exists) {
        if (this.state.players.length >= MAX_PLAYERS) return reject('room-full');
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
      if (this.state.phase !== 'lobby') return 'not-lobby';
      const player = this.state.players.find((item) => item.id === message.from && item.online);
      if (!player) return 'unknown-player';
      player.ready = message.ready === true;
      this.publishState();
      return 'ready';
    }
    if (message.type === 'ping') {
      if (!this.state.players.some((player) => player.id === message.from && player.online)) return 'unknown-player';
      this.publish('ev', { type: 'pong', from: this.playerId, to: message.from, t0: message.t0, t1: this.now(), v: PROTO });
      return 'ping';
    }
    if (message.type === 'rematch' || message.type === 'lobby') {
      if (this.state.phase !== 'finished' || message.matchId !== this.state.matchId) return 'old-match';
      if (!this.state.players.some((player) => player.id === message.from && player.online && !player.withdrawn)) return 'unknown-player';
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
    if (!result || typeof result !== 'object') return;
    this.results[playerId] = result;
    this.state.results = { ...this.results };
    const everyoneDone = this.state.participantIds.length > 0 && this.state.participantIds.every((id) => this.results[id]);
    if (this.isHost && everyoneDone) this.state.phase = 'finished';
    if (this.isHost) this.publishState();
  }
}
