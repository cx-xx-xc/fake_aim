import { buildTargets, mulberry32 } from '../net/room.js';
import { sceneTarget } from './scene3d.js';

export const RANGE_SETTINGS_KEY = 'aim-trainer:3d:settings:v1';
export const RANGE_HISTORY_KEY = 'aim-trainer:3d:history:v1';
export const RANGE_RECORDS_KEY = 'aim-trainer:3d:records:v1';
export const RANGE_GHOST_KEY = 'aim-trainer:3d:ghost:v1';

export function rangeSettings(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    sensitivity: Number.isFinite(raw.sensitivity) && raw.sensitivity > 0 ? Math.min(1, Math.max(.02, raw.sensitivity)) : .16,
    fov: Number.isFinite(raw.fov) ? Math.min(110, Math.max(60, raw.fov)) : 80,
    crosshair: ['cross', 'dot', 'ring'].includes(raw.crosshair) ? raw.crosshair : 'cross',
    sound: typeof raw.sound === 'boolean' ? raw.sound : false,
    gun: typeof raw.gun === 'boolean' ? raw.gun : true,
    effects: typeof raw.effects === 'boolean' ? raw.effects : true,
    ghost: typeof raw.ghost === 'boolean' ? raw.ghost : true,
  };
}

export function readRangeStorage(key, fallback) {
  try { return JSON.parse(globalThis.localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function writeRangeStorage(key, value) {
  try { globalThis.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function readRunHistory() {
  const value = readRangeStorage(RANGE_HISTORY_KEY, []);
  return Array.isArray(value) ? value.filter(validRun).slice(-100) : [];
}

function validRun(run) {
  return run && ['click', 'reaction', 'track'].includes(run.mode) && run.status === 'done'
    && Number.isFinite(run.score) && run.score >= 0 && Number.isFinite(run.finishedAt)
    && Number.isFinite(run.accuracy) && run.accuracy >= 0 && run.accuracy <= 100;
}

export function recordRun(history, run) {
  const previous = Array.isArray(history) ? history.filter(validRun) : [];
  return (validRun(run) ? [...previous, run] : previous).slice(-100);
}

export function bestRunScore(mode, records, history) {
  const stored = records && typeof records === 'object' && !Array.isArray(records) ? records[mode] : null;
  const scores = Array.isArray(history) ? history.filter(run => validRun(run) && run.mode === mode).map(run => run.score) : [];
  if (Number.isFinite(stored) && stored >= 0) scores.push(stored);
  return scores.length ? (mode === 'reaction' ? Math.min(...scores) : Math.max(...scores)) : null;
}

// No DOM or animation timing here: a single clock controls both scoring and HUD.
export class DrillSession {
  constructor({ mode = 'click', seed = Math.floor(Math.random() * 0xffffffff), durationMs, rounds = 8, multiplayer = false } = {}) {
    this.mode = ['click', 'reaction', 'track'].includes(mode) ? mode : 'click';
    this.durationMs = durationMs || (this.mode === 'track' ? 20000 : 30000);
    this.rounds = Math.max(1, Math.min(20, Math.round(rounds)));
    this.multiplayer = multiplayer;
    this.random = mulberry32(seed);
    this.points = buildTargets(seed, 320);
    this.index = 0;
    this.targets = [];
    this.status = 'ready';
    this.elapsedMs = 0;
    this.clockMs = 0;
    this.lastNow = 0;
    this.shots = 0;
    this.hits = 0;
    this.trackedMs = 0;
    this.times = [];
    this.hitTimes = [];
    this.samples = [];
    this.early = false;
    this.visibleAt = null;
    this.nextAt = 700 + this.random() * 1300;
    const count = this.mode === 'click' && !multiplayer ? 3 : this.mode === 'reaction' ? 0 : 1;
    for (let i = 0; i < count; i++) this.targets.push(this.nextTarget());
  }

  nextTarget(replacedId) {
    let candidate;
    do {
      const index = this.index++;
      candidate = sceneTarget({ ...this.points[index % this.points.length], r: .024 }, `orb-${index}`);
    } while (this.mode === 'click' && !this.multiplayer && this.targets.some(target =>
      target.id !== replacedId && Math.hypot(target.x - candidate.x, target.y - candidate.y, target.z - candidate.z) < target.radius + candidate.radius));
    return candidate;
  }

  start(now, { skipCountdown = false } = {}) {
    if (this.status !== 'ready') return;
    this.countdownMs = skipCountdown ? 0 : 3000;
    this.status = skipCountdown ? 'running' : 'countdown';
    this.lastNow = now;
  }

  tick(now, aimedId = null) {
    if (!['running', 'countdown'].includes(this.status)) return;
    const delta = Math.max(0, Number.isFinite(now) ? now - this.lastNow : 0);
    this.lastNow = Number.isFinite(now) ? now : this.lastNow;
    this.clockMs += delta;
    if (this.clockMs < this.countdownMs) return;
    this.status = 'running';
    const previous = this.elapsedMs;
    this.elapsedMs = Math.max(0, this.clockMs - this.countdownMs);
    if (this.mode !== 'reaction') this.elapsedMs = Math.min(this.durationMs, this.elapsedMs);
    if (this.mode === 'reaction' && !this.targets.length && this.elapsedMs >= this.nextAt) {
      this.targets = [this.nextTarget()];
      this.visibleAt = this.elapsedMs;
      this.early = false;
    }
    if (this.mode === 'track') {
      if (aimedId === this.targets[0]?.id) this.trackedMs += Math.min(100, this.elapsedMs - previous);
      const seconds = this.elapsedMs / 1000;
      this.targets[0].x = Math.sin(seconds * .82) * 5.3;
      this.targets[0].y = Math.sin(seconds * 1.13 + .4) * 1.9;
      this.targets[0].radius = .52;
    }
    const second = Math.floor(this.elapsedMs / 1000);
    if (second > this.samples.length) this.samples.push(this.mode === 'track' ? this.snapshot().accuracy : this.mode === 'reaction' ? this.snapshot().averageMs : this.hits);
    if (this.mode !== 'reaction' && this.elapsedMs >= this.durationMs) this.status = 'done';
  }

  shoot(now, aimedId) {
    this.tick(now);
    if (this.status !== 'running') return false;
    if (this.mode === 'track') return false;
    if (this.mode === 'reaction' && !this.targets.length) { this.early = true; return false; }
    this.shots++;
    const index = this.targets.findIndex(target => target.id === aimedId);
    if (index < 0) return false;
    this.hits++;
    this.hitTimes.push(this.elapsedMs);
    if (this.mode === 'click') this.targets[index] = this.nextTarget(this.targets[index].id);
    else {
      this.times.push(Math.max(0, this.elapsedMs - this.visibleAt));
      this.targets = [];
      this.visibleAt = null;
      this.nextAt = this.elapsedMs + 700 + this.random() * 1300;
      if (this.times.length >= this.rounds) this.status = 'done';
    }
    return true;
  }

  pause(now) {
    if (this.multiplayer || !['running', 'countdown'].includes(this.status)) return;
    this.tick(now);
    if (this.status === 'done') return;
    this.beforePause = this.status;
    this.status = 'paused';
  }

  resume(now) {
    if (this.status !== 'paused') return;
    this.lastNow = now;
    this.status = this.beforePause;
  }

  snapshot() {
    const averageMs = this.times.length ? Math.round(this.times.reduce((sum, time) => sum + time, 0) / this.times.length) : 0;
    const accuracy = this.mode === 'track'
      ? (this.elapsedMs ? Math.round(this.trackedMs / this.elapsedMs * 100) : 0)
      : (this.shots ? Math.round(this.hits / this.shots * 100) : 0);
    return {
      mode: this.mode, status: this.status,
      score: this.mode === 'reaction' ? averageMs : this.mode === 'track' ? accuracy : this.hits,
      hits: this.hits, shots: this.shots, accuracy, averageMs,
      lastMs: this.times.length ? Math.round(this.times[this.times.length - 1]) : 0,
      averageHitMs: this.hits ? Math.round(this.elapsedMs / this.hits) : 0,
      round: Math.min(this.hits + 1, this.rounds), rounds: this.rounds,
      elapsedMs: this.elapsedMs, leftMs: Math.max(0, this.durationMs - this.elapsedMs),
      countdown: Math.max(1, Math.ceil((this.countdownMs - this.clockMs) / 1000)),
      samples: [...this.samples], early: this.early,
    };
  }
}
