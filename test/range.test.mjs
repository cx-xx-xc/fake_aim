import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as range from '../src/range.js';
import * as scene from '../src/scene3d.js';
import * as ghost from '../src/ghost.js';
const { DrillSession, rangeSettings, recordRun } = range;

const uiSource = (await readFile(new URL('../src/range-ui.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]*\r?\n/gm, '')
  .replace(/^export /gm, '');

function eventTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, callback) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(callback);
    },
    removeEventListener(type, callback) { handlers.get(type)?.delete(callback); },
    dispatch(type, event = { preventDefault() {} }) {
      for (const callback of [...(handlers.get(type) || [])]) callback(event);
    },
    listenerCount(type) { return type ? handlers.get(type)?.size || 0 : [...handlers.values()].reduce((sum, callbacks) => sum + callbacks.size, 0); },
  };
}

function walk(node, fn) {
  if (Array.isArray(node)) { node.forEach(child => walk(child, fn)); return; }
  if (!node || typeof node !== 'object') return;
  fn(node);
  walk(node.props?.children, fn);
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  return typeof node === 'object' ? textOf(node.props?.children) : String(node);
}

// Exercise the component's DOM/resource boundary with a controllable renderer.
// Scoring, storage validation and targeting still use the real range modules.
function rangeHarness(t, { blockedKeys = [], failRenderer = false } = {}) {
  const oldStorage = globalThis.localStorage;
  const stored = new Map();
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem(key, value) {
      if (blockedKeys.includes(key)) throw new Error('storage is full');
      stored.set(key, String(value));
    },
  };
  globalThis.localStorage = storage;
  const doc = Object.assign(eventTarget(), { hidden: false, pointerLockElement: null });
  const canvas = eventTarget();
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatch('pointerlockchange'); };
  canvas.requestPointerLock = () => { doc.pointerLockElement = canvas; doc.dispatch('pointerlockchange'); };
  let now = 0, serial = 0, cursor = 0, tree, currentProps = {};
  const frames = new Map(), hooks = [], effects = [], pending = [];
  const metrics = { attempts: 0, active: 0, disposed: 0, rendered: 0, finished: null, lastState: null };
  const win = {
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval: () => ++serial,
    clearInterval() {},
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!effects[index] || deps.some((dep, i) => dep !== effects[index].deps[i])) {
        pending.push(() => {
          effects[index]?.cleanup?.();
          effects[index] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const dependencies = {
    ...range, ...scene, ...ghost, window: win, document: doc, performance: { now: () => now },
    createSceneRenderer(target) {
      metrics.attempts++;
      if (failRenderer) throw new Error('no WebGL');
      metrics.active++;
      const lost = () => {};
      target.addEventListener('webglcontextlost', lost);
      let disposed = false;
      return {
        render(state) { assert.equal(disposed, false, 'disposed renderer is never used'); metrics.rendered++; metrics.lastState = state; },
        dispose() {
          if (disposed) return;
          disposed = true; metrics.active--; metrics.disposed++;
          target.removeEventListener('webglcontextlost', lost);
        },
      };
    },
  };
  const factory = new Function(...Object.keys(dependencies), `${uiSource}\nreturn createRange;`)(...Object.values(dependencies));
  const { RangeGame, RangeRecords } = factory(React);
  const harness = {
    metrics, storage, canvas, document: doc,
    render(props = {}) {
      currentProps = { ...currentProps, ...props };
      cursor = 0;
      tree = RangeGame({ t: key => key, seed: 42, onFinish: (_mode, _score, result) => { metrics.finished = result; }, ...currentProps });
      walk(tree, node => { if (node.type === 'canvas') node.props.ref.current = canvas; });
      pending.splice(0).forEach(run => run());
      return tree;
    },
    records() { return RangeRecords({ t: key => key }); },
    text: () => textOf(tree),
    button(label) {
      let found;
      walk(tree, node => { if (node.type === 'button' && textOf(node) === label) found = node; });
      assert.ok(found, `button ${label} exists`);
      return found;
    },
    frame(time) {
      now = time;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback(time));
      harness.render();
    },
    complete({ hit = false } = {}) {
      harness.render({ durationMs: 100 });
      harness.button('start').props.onClick();
      harness.frame(3000);
      if (hit) {
        const target = metrics.lastState.targets[0];
        const yaw = Math.atan2(target.x, -target.z) * 180 / Math.PI;
        const pitch = Math.atan2(target.y, Math.hypot(target.x, target.z)) * 180 / Math.PI;
        doc.dispatch('mousemove', { movementX: yaw / .16, movementY: -pitch / .16 });
        now = 3050;
        doc.dispatch('mousedown', { button: 0, preventDefault() {} });
      }
      harness.frame(3100);
    },
    setRendererFailure(value) { failRenderer = value; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); effects.length = 0; },
  };
  t.after(() => {
    harness.unmount();
    if (oldStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = oldStorage;
  });
  return harness;
}

test('three visible click targets replace only the hit sphere and count misses', () => {
  const game = new DrillSession({ mode: 'click', seed: 42, durationMs: 1000 });
  game.start(0, { skipCountdown: true });
  const ids = game.targets.map(t => t.id);
  assert.equal(ids.length, 3);
  game.shoot(100, ids[1]);
  assert.equal(game.hits, 1);
  assert.equal(game.shots, 1);
  assert.equal(game.targets[0].id, ids[0]);
  assert.notEqual(game.targets[1].id, ids[1]);
  game.shoot(200, null);
  assert.equal(game.snapshot().accuracy, 50);
  game.tick(1000);
  assert.equal(game.status, 'done');
  game.shoot(1001, game.targets[0]?.id);
  assert.equal(game.hits, 1);
});

test('repeatedly replacing one solo target never overlaps either remaining target', () => {
  for (const seed of [42, 7, 13]) {
    const game = new DrillSession({ mode: 'click', seed, durationMs: 60000 });
    game.start(0, { skipCountdown: true });
    for (let replacement = 0; replacement < 500; replacement++) {
      assert.equal(game.shoot(replacement * 10, game.targets[0].id), true);
      for (let a = 0; a < game.targets.length; a++) for (let b = a + 1; b < game.targets.length; b++) {
        const left = game.targets[a], right = game.targets[b];
        const distance = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
        assert.ok(distance >= left.radius + right.radius,
          `seed ${seed}, replacement ${replacement + 1}: ${left.id} overlaps ${right.id}`);
      }
    }
  }
});

test('paused solo time does not consume the countdown or drill duration', () => {
  const game = new DrillSession({ mode: 'click', durationMs: 1000 });
  game.start(0);
  game.tick(1000);
  game.pause(1000);
  game.tick(9000);
  assert.equal(game.status, 'paused');
  game.resume(10000);
  game.tick(12000);
  assert.equal(game.status, 'running');
  game.tick(12500);
  assert.equal(game.snapshot().leftMs, 500);
  game.pause(12500);
  game.resume(20000);
  game.tick(20500);
  assert.equal(game.status, 'done');
});

test('reaction ignores early fire and measures time from actual target display', () => {
  const game = new DrillSession({ mode: 'reaction', rounds: 2, seed: 9 });
  game.start(0, { skipCountdown: true });
  game.shoot(10, null);
  assert.equal(game.hits, 0);
  assert.equal(game.early, true);
  game.tick(2500);
  assert.equal(game.targets.length, 1);
  game.shoot(2700, game.targets[0].id);
  assert.equal(game.snapshot().averageMs, 200);
  game.tick(5200);
  game.shoot(5500, game.targets[0].id);
  assert.equal(game.status, 'done');
  assert.equal(game.snapshot().averageMs, 250);
});

test('tracking accumulates aimed time without awarding long unsampled gaps', () => {
  const game = new DrillSession({ mode: 'track', durationMs: 1000 });
  game.start(0, { skipCountdown: true });
  const id = game.targets[0].id;
  for (let t = 100; t <= 500; t += 100) game.tick(t, id);
  game.tick(1000, null);
  assert.equal(game.status, 'done');
  assert.equal(game.snapshot().accuracy, 50);
});

test('multiplayer uses wall time and a shared single-target sequence', () => {
  const a = new DrillSession({ mode: 'click', seed: 7, multiplayer: true, durationMs: 1000 });
  const b = new DrillSession({ mode: 'click', seed: 7, multiplayer: true, durationMs: 1000 });
  a.start(10000, { skipCountdown: true }); b.start(10000, { skipCountdown: true });
  assert.deepEqual(a.targets, b.targets);
  assert.equal(a.targets.length, 1);
  a.pause(10500);
  a.tick(11000);
  assert.equal(a.status, 'done');
  assert.equal(a.snapshot().leftMs, 0);
});

test('finished runs remain stable and history retains only valid complete results', () => {
  const game = new DrillSession({ mode: 'click', durationMs: 100 });
  game.start(0, { skipCountdown: true });
  game.shoot(50, game.targets[0].id);
  game.tick(100);
  const result = game.snapshot();
  game.tick(10000);
  assert.equal(game.snapshot().elapsedMs, result.elapsedMs);
  assert.deepEqual(recordRun([], { ...result, finishedAt: 123 }), [{ ...result, finishedAt: 123 }]);
  assert.deepEqual(recordRun([], { ...result, status: 'paused' }), []);
  assert.equal(recordRun(Array(100).fill({ ...result, finishedAt: 1 }), { ...result, finishedAt: 2 }).length, 100);
});

test('settings reject invalid storage values and bound sensitivity and field of view', () => {
  assert.equal(rangeSettings({ sensitivity: -1 }).sensitivity, .16);
  assert.equal(rangeSettings({ fov: 999 }).fov, 110);
  assert.equal(rangeSettings({ sound: 'true' }).sound, false);
  assert.equal(rangeSettings({ crosshair: 'bad' }).crosshair, 'cross');
});

test('persistent best remains visible after its run falls outside the last 100 sessions', t => {
  const h = rangeHarness(t);
  let history = [];
  for (let index = 0; index < 101; index++) history = recordRun(history, {
    mode: 'click', status: 'done', score: index === 0 ? 120 : 10, accuracy: 100, finishedAt: index,
  });
  assert.equal(Math.max(...history.map(run => run.score)), 10, 'the old best is outside recent history');
  h.storage.setItem(range.RANGE_HISTORY_KEY, JSON.stringify(history));
  h.storage.setItem(range.RANGE_RECORDS_KEY, JSON.stringify({ click: 120, reaction: 180, track: 95 }));
  const best = [];
  walk(h.records(), node => { if (node.props.className === 'ar-best-number') best.push(textOf(node)); });
  assert.deepEqual(best, ['120', '180 ms', '95%']);
});

test('best score falls back to valid history when stored records are corrupt', () => {
  assert.equal(typeof range.bestRunScore, 'function', 'best score selection is available');
  const run = (mode, score) => ({ mode, score, status: 'done', accuracy: 100, finishedAt: 1 });
  const history = [run('click', 12), run('click', 24), run('reaction', 230), run('reaction', 190), run('track', 75),
    { ...run('click', 999), status: 'paused' }, run('track', -2)];
  for (const records of [null, [], 'broken', { click: '100', reaction: -1, track: Infinity }]) {
    assert.equal(range.bestRunScore('click', records, history), 24);
    assert.equal(range.bestRunScore('reaction', records, history), 190);
    assert.equal(range.bestRunScore('track', records, history), 75);
  }
  assert.equal(range.bestRunScore('click', { click: 0 }, []), 0, 'zero is a valid persisted score');
  assert.equal(range.bestRunScore('click', { click: 120 }, history), 120, 'persistent best is independent of recent history');
  assert.equal(range.bestRunScore('click', { click: 10 }, [run('click', 120)]), 120, 'a recovered history best beats a lower stored score');
  assert.equal(range.bestRunScore('reaction', { reaction: 300 }, [run('reaction', 200)]), 200, 'reaction keeps the fastest available score');
  assert.equal(range.bestRunScore('reaction', {}, null), null, 'missing scores have an empty state');
});

test('hidden ranges release graphics and recreate them only when visible', t => {
  const h = rangeHarness(t);
  h.render({ visible: false });
  assert.equal(h.metrics.active, 0, 'initially hidden views allocate no graphics');
  h.render({ visible: true });
  assert.equal(h.metrics.active, 1);
  h.render({ visible: false });
  assert.equal(h.metrics.active, 0, 'tab changes and collapse release graphics');
  h.frame(100);
  assert.equal(h.metrics.attempts, 1);
  h.render({ visible: true });
  assert.equal(h.metrics.active, 1);
  h.document.hidden = true; h.document.dispatch('visibilitychange');
  assert.equal(h.metrics.active, 0, 'background documents release graphics immediately');
  h.document.hidden = false; h.document.dispatch('visibilitychange');
  assert.equal(h.metrics.active, 1);
  h.unmount();
  assert.equal(h.metrics.active, 0);
  assert.equal(h.canvas.listenerCount(), 0, 'all canvas listeners are removed');
  assert.equal(h.document.listenerCount(), 0, 'all document listeners are removed');
});

test('context loss disposes the old renderer and waits for a visible restore', t => {
  const h = rangeHarness(t);
  h.render();
  assert.equal(h.canvas.listenerCount('webglcontextlost'), 2);
  h.canvas.dispatch('webglcontextlost');
  assert.equal(h.metrics.active, 0, 'lost renderer is disposed');
  assert.equal(h.canvas.listenerCount('webglcontextlost'), 1, 'old renderer listener is removed');
  h.render({ visible: false });
  h.canvas.dispatch('webglcontextrestored');
  assert.equal(h.metrics.attempts, 1, 'restore while hidden allocates nothing');
  h.render({ visible: true });
  assert.equal(h.metrics.active, 1);
  assert.equal(h.canvas.listenerCount('webglcontextlost'), 2, 'restore adds only one renderer listener');
  h.canvas.dispatch('webglcontextlost'); h.canvas.dispatch('webglcontextrestored');
  assert.equal(h.metrics.active, 1);
  assert.equal(h.canvas.listenerCount('webglcontextlost'), 2, 'repeated restore does not accumulate listeners');
});

test('failed graphics wait for manual retry without retrying on animation frames', t => {
  const h = rangeHarness(t, { failRenderer: true });
  h.render(); h.render();
  h.frame(100); h.frame(200);
  assert.equal(h.metrics.attempts, 1);
  h.setRendererFailure(false);
  h.button('retryGraphics').props.onClick(); h.render();
  assert.equal(h.metrics.attempts, 2);
  assert.equal(h.metrics.active, 1);
  assert.equal(h.text().includes('webglUnavailable'), false);
});

test('a failed history write shows save failure instead of saved locally', t => {
  const h = rangeHarness(t, { blockedKeys: [range.RANGE_HISTORY_KEY] });
  h.complete();
  assert.equal(h.metrics.finished?.persistence, false);
  assert.ok(h.text().includes('saveFailed'));
  assert.equal(h.text().includes('savedLocally'), false);
});

test('successful history persistence confirms the save', t => {
  const h = rangeHarness(t);
  h.complete();
  assert.equal(h.metrics.finished?.persistence, true);
  assert.ok(h.text().includes('savedLocally'));
  assert.equal(JSON.parse(h.storage.getItem(range.RANGE_HISTORY_KEY)).length, 1);
});

test('a failed ghost write is distinguished from the saved session result', t => {
  const h = rangeHarness(t, { blockedKeys: [range.RANGE_GHOST_KEY] });
  h.complete({ hit: true });
  assert.equal(h.metrics.finished?.hits, 1, 'a new personal ghost was earned');
  assert.equal(h.metrics.finished?.persistence, true);
  assert.equal(h.metrics.finished?.ghostPersistence, false);
  assert.ok(h.text().includes('savedLocally'));
  assert.ok(h.text().includes('ghostSaveFailed'));
});

test('active multiplayer keeps rival progress visible and offers leave after releasing input', t => {
  const h = rangeHarness(t);
  let left = 0;
  const statusPanel = { type: 'aside', props: { children: 'rivalProgress' } };
  let tree = h.render({ multiplayer: true, statusPanel, onLeave: () => { left++; } });
  let progress;
  walk(tree, node => { if (node.props.className === 'ar-online-progress') progress = node; });
  assert.ok(progress, 'active online drill contains the rival progress HUD');
  assert.equal(textOf(progress), 'rivalProgress');
  h.canvas.requestPointerLock();
  tree = h.render();
  assert.ok(textOf(tree).includes('rivalProgress'), 'rival progress remains visible while aiming');
  h.document.exitPointerLock(); h.render();
  h.button('leaveRoom').props.onClick();
  assert.equal(left, 1, 'pause overlay can leave the room');
});

test('abandoning a rotated solo run returns its ready preview to the forward camera', t => {
  const h = rangeHarness(t);
  h.render(); h.button('start').props.onClick(); h.frame(3000);
  h.document.dispatch('mousemove', { movementX: 100, movementY: 20 });
  h.frame(3010);
  assert.notEqual(h.metrics.lastState.yaw, 0);
  assert.notEqual(h.metrics.lastState.pitch, 0);
  h.document.exitPointerLock(); h.render();
  h.button('backToTasks').props.onClick(); h.render(); h.frame(3200);
  assert.equal(h.metrics.lastState.yaw, 0);
  assert.equal(h.metrics.lastState.pitch, 0);
  assert.ok(h.text().includes('start'), 'ready preview offers a fresh run');
});
