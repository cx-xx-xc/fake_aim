import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';

// Smoke-render the shipped client bundle: the Harness loads one plain script and
// mounts the component it registers, so a typo in a rarely opened tab would
// otherwise only surface in a browser console we cannot read.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'client.js'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

let captured = null;
const noop = () => {};
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  RegExp,
  Error,
  Promise,
  Map,
  Set,
  Uint8Array,
  ArrayBuffer,
  DataView,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
  atob: (text) => Buffer.from(text, 'base64').toString('binary'),
  isNaN,
  parseInt,
  parseFloat,
  setTimeout: () => 0,
  clearTimeout: noop,
  setInterval: () => 0,
  clearInterval: noop,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: noop,
  addEventListener: noop,
  removeEventListener: noop,
  innerWidth: 1280,
  innerHeight: 800,
  performance: { now: () => 0 },
  navigator: { userAgent: 'smoke-test', language: 'en' },
  localStorage: storage(),
  sessionStorage: storage(),
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  document: {
    createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
    head: { appendChild: noop },
    body: { appendChild: noop },
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    documentElement: { style: { setProperty: noop } },
  },
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window.__ModuleLoader__ = { load: (mod) => { captured = mod; } };

vm.runInNewContext(source, sandbox, { filename: 'client.js' });
assert.ok(captured, 'bundle called window.__ModuleLoader__.load');
assert.equal(captured.id, '@local/aim-trainer');
assert.equal(typeof captured.factory, 'function');

// Minimal React: enough to execute components once and walk the element tree.
const states = new Map();
let cursor = null;

const React = {
  createElement: (type, props, ...children) => ({
    type,
    props: { ...(props || {}), children: children.length > 1 ? children : children[0] },
  }),
  useState(init) {
    const key = `${cursor.path}#${cursor.index++}`;
    const index = cursor.index - 1;
    if (typeof cursor.override === 'function') {
      const next = cursor.override(init);
      if (next) states.set(key, next.value);
    } else if (cursor.override && Object.hasOwn(cursor.override, index)) {
      states.set(key, cursor.override[index]);
    }
    if (!states.has(key)) states.set(key, typeof init === 'function' ? init() : init);
    return [states.get(key), (next) => {
      states.set(key, typeof next === 'function' ? next(states.get(key)) : next);
    }];
  },
  useEffect(fn) {
    cursor.index++;
    fn();
  },
  useRef(init) {
    const key = `${cursor.path}@${cursor.index++}`;
    if (!states.has(key)) states.set(key, { current: init });
    return states.get(key);
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
};

const moduleExports = captured.factory((id) => {
  if (id === 'react') return React;
  throw new Error(`unexpected require(${id})`);
});

assert.equal([...moduleExports.inject].join(','), 'slots,locale');

const dicts = new Map();
const translate = (key) => {
  for (const locale of ['en', 'zh']) assert.ok(Object.hasOwn(dicts.get(locale), key), `${locale} has rendered locale key ${key}`);
  return key;
};
let registered = null;
let updatePanel = null;
const ctx = {
  effect: (fn) => { fn(); },
  locale: {
    register: (ns, locale, dict) => { dicts.set(locale, dict); },
    bind: () => translate,
    subscribe: () => noop,
    getLocale: () => ({ active: 'en' }),
  },
  slots: {
    inject: (name, fn) => fn(),
    register: (position, component) => {
      if (position.name === 'plugins.bundle.config') updatePanel = { position, component };
      else registered = { position, component };
    },
    list: () => [],
  },
};

moduleExports.apply(ctx);
assert.ok(registered, 'apply() registered a slot occupant');
assert.equal(registered.position.id, 'aim-trainer');
assert.equal(registered.position.name, 'shell.overlay');
assert.ok(dicts.get('en') && dicts.get('zh'), 'both locales registered');

const seenClasses = new Set();
const seenComponents = new Map();
const seenElements = [];
const seenText = [];
const seenRendered = [];
const visit = (node, pathName, overrides) => {
  if (node == null || node === false || node === true) return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child, index) => sum + visit(child, `${pathName}.${index}`, overrides), 0);
  }
  if (typeof node !== 'object') { seenText.push(String(node)); return 0; }
  const { type, props } = node;
  if (typeof type === 'function') {
    seenComponents.set(type.name, type);
    seenRendered.push({ name: type.name, props: props || {}, path: pathName });
    const previous = cursor;
    cursor = { path: pathName, index: 0, override: overrides[pathName] || null };
    let output;
    try {
      output = type(props || {});
    } finally {
      cursor = previous;
    }
    return 1 + visit(output, `${pathName}>${type.name}:${props?.key || ''}`, overrides);
  }
  seenElements.push(node);
  if (props && typeof props.className === 'string') for (const name of props.className.split(/\s+/)) seenClasses.add(name);
  const children = props ? props.children : null;
  return children == null ? 1 : 1 + visit(children, pathName, overrides);
};

const Trainer = registered.component;
assert.equal(updatePanel.position.key, '@local/aim-trainer');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates', {});
const showsCurrentVersion = seenText.some((text) => text.includes(manifest.version));
assert.ok(seenText.includes('checkUpdates'), 'check button rendered');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates-error', { 'updates-error': { 0: { status: 'error' } } });
assert.ok(seenText.includes('updateFailed'), 'failure is shown explicitly');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates-available', { 'updates-available': { 0: { status: 'available', version: '1.3.0', spec: 'github:cx-xx-xc/fake_aim#abc', url: 'https://github.com/cx-xx-xc/fake_aim' } } });
assert.ok(seenText.includes('updateSteps'), 'new version offers update instructions');
assert.ok(seenElements.some((node) => node.type === 'textarea' && node.props.readOnly), 'installation target can be copied manually');


function resetSeen() {
  seenClasses.clear(); seenElements.length = 0; seenText.length = 0; seenRendered.length = 0;
}
function renderTrainer(pathName = 'root', overrides = {}) {
  resetSeen();
  visit(React.createElement(Trainer, {}), pathName, overrides);
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  return typeof node === 'object' ? textOf(node.props?.children) : String(node);
}
function navigation(label) {
  const found = seenElements.find((node) => node.type === 'button' && textOf(node).includes(label));
  assert.ok(found, `navigation ${label} exists`);
  return found;
}
function soloRange() {
  const found = seenRendered.find((node) => node.name === 'RangeGame' && !node.props.multiplayer);
  assert.ok(found, 'solo training uses the 3D range');
  return found;
}

// 1. Collapsed window: the launcher must still render.
renderTrainer();
assert.ok(seenClasses.has('at-root'), 'overlay root rendered');
assert.ok(seenClasses.has('at-launch'), 'launcher rendered');

// 2. Open the range through its launcher and navigate through real callbacks.
seenElements.find((node) => node.props.className === 'at-launch').props.onClick();
renderTrainer();
assert.ok(seenClasses.has('at-win'), 'panel window rendered');
const openedWindow = seenElements.find((node) => node.props.className === 'at-win');
assert.ok(parseFloat(openedWindow.props.style.width) >= sandbox.innerWidth * .95, 'default range uses most of the viewport width');
assert.ok(parseFloat(openedWindow.props.style.height) >= sandbox.innerHeight * .95, 'default range uses most of the viewport height');
assert.ok(seenClasses.has('at-app-nav'), 'application navigation rendered');
assert.ok(seenClasses.has('at-sidebar'), 'training task sidebar rendered');
assert.equal(soloRange().props.visible, true, 'opened training range receives input');
assert.ok(seenElements.some((node) => node.type === 'canvas'), 'training scene has a canvas');

// 3. Versus lobby.
navigation('versusTab').props.onClick();
renderTrainer();
assert.ok(seenClasses.has('at-vs'), 'versus lobby rendered');
assert.equal(soloRange().props.visible, false, 'switching tabs pauses solo input');

// 4. Records tab.
navigation('recordTab').props.onClick();
renderTrainer();
assert.ok(seenClasses.has('ar-record-page'), 'records view rendered');
assert.equal(soloRange().props.visible, false, 'records keep the solo session mounted and paused');
assert.ok(seenClasses.has('ar-empty-records'), 'first-time users see an empty records state');
sandbox.localStorage.setItem('aim-trainer:3d:history:v1', JSON.stringify([
  { mode: 'click', status: 'done', score: 42, accuracy: 84, finishedAt: 1700000000000 },
  { mode: 'reaction', status: 'done', score: 225, accuracy: 100, finishedAt: 1700000001000 },
  { mode: 'track', status: 'done', score: 80, accuracy: 80, finishedAt: 1700000002000 },
]));
renderTrainer();
assert.ok(seenClasses.has('ar-history'), 'completed sessions appear in records');
assert.deepEqual(seenElements.filter((node) => node.props.className === 'ar-best-number').map(textOf), ['42', '225 ms', '80%'], 'each drill displays its score with the correct unit');
assert.equal(seenElements.filter((node) => node.type === 'svg' && node.props.role === 'img').length, 3, 'each drill has a history trend');
sandbox.localStorage.setItem('aim-trainer:3d:records:v1', JSON.stringify({ click: 10, reaction: 600, track: 20 }));
renderTrainer('recovered-ledger');
assert.deepEqual(JSON.parse(sandbox.localStorage.getItem('aim-trainer:3d:records:v1')), { click: 42, reaction: 225, track: 80 }, 'loading recovered history repairs the persistent best scores');
const savedHistory = sandbox.localStorage.getItem('aim-trainer:3d:history:v1');
sandbox.localStorage.setItem('aim-trainer:3d:history:v1', JSON.stringify(Array.from({ length: 100 }, (_, index) => (
  { mode: 'click', status: 'done', score: 10, accuracy: 50, finishedAt: 1700000010000 + index }
))));
renderTrainer('reloaded-ledger');
seenElements.find(node => node.props.className === 'at-launch').props.onClick();
renderTrainer('reloaded-ledger');
navigation('recordTab').props.onClick();
renderTrainer('reloaded-ledger');
assert.deepEqual(seenElements.filter(node => node.props.className === 'ar-best-number').map(textOf), ['42', '225 ms', '80%'], 'reloading after history truncation preserves recovered all-time scores');
sandbox.localStorage.setItem('aim-trainer:3d:history:v1', savedHistory);
renderTrainer();
navigation('settingsTab').props.onClick();
renderTrainer();
assert.ok(seenRendered.some((node) => node.name === 'RangeSettings'), 'settings page rendered');
let sensitivity = seenElements.find((node) => node.type === 'input' && node.props['aria-label'] === 'sensitivity');
assert.ok(sensitivity, 'settings expose mouse sensitivity');
sensitivity.props.onChange({ target: { value: '0.25' } });
renderTrainer();
sensitivity = seenElements.find((node) => node.type === 'input' && node.props['aria-label'] === 'sensitivity');
assert.equal(sensitivity.props.value, 0.25, 'changed sensitivity is reflected in settings');
navigation('trainTab').props.onClick();
renderTrainer();
assert.equal(soloRange().props.visible, true, 'returning to training restores its visible range');
assert.ok(showsCurrentVersion, 'current version is visible');
for (const [mode, label] of [['click', 'gridshot'], ['reaction', 'reactionTask'], ['track', 'trackingTask']]) {
  navigation(label).props.onClick();
  renderTrainer();
  assert.equal(soloRange().props.mode, mode, `${mode} selection opens the corresponding 3D drill`);
  assert.ok(seenText.includes(`${mode}Hint3d`), `${mode} instruction is shown`);
  assert.ok(seenElements.some((node) => node.type === 'canvas'), `${mode} scene has a canvas`);
}

// 5. Exercise the actual versus components with final/partial score snapshots.
const VersusPanel = seenComponents.get('VersusPanel');
assert.ok(VersusPanel);
const calls = [];
const actions = {
  rematch: () => calls.push('rematch'),
  returnToLobby: () => calls.push('lobby'),
  setReactionRounds: (rounds) => calls.push(['rounds', rounds]),
  startMatch: (mode, options) => calls.push(['start', mode, options]),
  // Capture fields into host objects because bundle objects originate in a VM.
  finish: (result) => calls.push(['finish', { ...result }]),
  reportProgress: (result) => calls.push(['progress', { ...result }]),
};
const baseSnap = {
  me: 'p1', role: 'host', phase: 'finished', mode: 'click', startAt: Date.now() - 40000,
  players: [{ id: 'p1', name: 'Host', online: true, ready: true }, { id: 'p2', name: 'Guest', online: true, ready: true }], results: { p1: { score: 35 }, p2: { score: 40 } },
};
function renderMatch(snap) {
  resetSeen();
  const vs = { stage: 'room', status: { phase: 'online' }, snap,
    act: (fn) => fn(actions), leave: () => calls.push('leave') };
  visit(React.createElement(VersusPanel, { vs, t: translate, visible: true }), 'match', {});
}
function button(label) {
  const found = seenElements.find((node) => node.type === 'button' && node.props.children === label);
  assert.ok(found, `button ${label} exists`);
  return found;
}
renderMatch(baseSnap);
assert.ok(seenText.includes('youLose'));
button('rematch').props.onClick();
button('backToRoom').props.onClick();
button('leaveRoom').props.onClick();
assert.deepEqual(calls, ['rematch', 'lobby', 'leave']);
renderMatch({ ...baseSnap, me: 'p2', role: 'guest' });
assert.ok(seenText.includes('youWin'));
assert.equal(Boolean(button('requestRematch').props.disabled), false);
button('requestRematch').props.onClick();
button('backToRoom');
renderMatch({ ...baseSnap, mode: 'reaction', results: { p1: { score: 230 }, p2: { score: 270 } } });
assert.ok(seenText.includes('youWin'), 'lower reaction time wins');
assert.ok(seenText.includes('230 ms'), 'reaction score includes a unit');
renderMatch({ ...baseSnap, results: { p1: { score: 35 }, p2: { score: 35 } } });
assert.ok(seenText.includes('draw'));
renderMatch({ ...baseSnap, phase: 'playing', results: { p1: { score: 35 } } });
assert.ok(seenText.includes('waitingResult'));
assert.equal(seenClasses.has('at-arena'), false, 'submitted player never restarts the expired drill');
button('leaveRoom');
// Five-player standings: tied first, competition ranks, and withdrawal last.
const players = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => ({ id, name: id, online: true, ready: true }));
const five = { ...baseSnap, participantIds: players.map((player) => player.id), players,
  results: { p1: { score: 25 }, p2: { score: 50 }, p3: { score: 50 }, p4: { score: 10 }, p5: { score: 0, dnf: true, withdrawn: true } } };
renderMatch(five);
assert.ok(seenText.includes('youLose'), 'third place is not declared winner');
assert.deepEqual(seenElements.filter((node) => node.props.className === 'at-rank').map((node) => node.props.children), [1, 1, 3, 4, '—']);
assert.deepEqual(seenElements.filter((node) => node.props.className === 'at-player-value').map((node) => node.props.children), ['50', '50', '25', '10', 'withdrawn']);
renderMatch({ ...five, me: 'p2' });
assert.ok(seenText.includes('draw'), 'tied leading score is a draw for the leaders');
renderMatch({ ...five, mode: 'reaction', results: { p1: { score: 250 }, p2: { score: 300 }, p3: { score: 200 }, p4: { score: 270 }, p5: { score: 0, dnf: true } } });
assert.deepEqual(seenElements.filter((node) => node.props.className === 'at-player-value').map((node) => node.props.children), ['200 ms', '250 ms', '270 ms', '300 ms', 'withdrawn'], 'DNF zero never wins reaction mode');
// Lobby controls: integer choices 5..20, host-only, and exact option used to start.
const lobby = { ...five, hostId: 'p1', phase: 'lobby', mode: 'reaction', rounds: 20, startAt: 0, results: {}, participantIds: [] };
renderMatch(lobby);
assert.ok(seenText.some((text) => text.includes('5 / 5')), 'all five room slots shown');
renderMatch({ ...lobby, shareCode: 'ABC234-E' });
assert.ok(seenText.includes('ABC234-E'), 'the shared code names the relay and is what guests copy');
renderMatch(lobby);
let select = seenElements.find((node) => node.type === 'select');
assert.equal(select.props.disabled, false);
assert.equal(select.props.value, 20);
assert.deepEqual(seenElements.filter((node) => node.type === 'option').map((node) => node.props.value), Array.from({length: 16}, (_, index) => index + 5));
select.props.onChange({ target: { value: '5' } });
assert.deepEqual(calls.at(-1), ['rounds', 5]);
assert.equal(button('startMatch').props.disabled, false);
button('startMatch').props.onClick();
assert.deepEqual(calls.at(-1).slice(0, 2), ['start', 'reaction']);
assert.equal(calls.at(-1)[2].rounds, 20);
renderMatch({ ...lobby, role: 'guest', me: 'p2' });
assert.equal(seenElements.find((node) => node.type === 'select').props.disabled, true);
assert.equal(button('startMatch').props.disabled, true);
renderMatch({ ...lobby, players: players.slice(0, 1) });
assert.equal(button('startMatch').props.disabled, true, 'one player cannot start');
renderMatch({ ...lobby, players: players.slice(0, 2) });
assert.equal(button('startMatch').props.disabled, false, 'two ready players can start');
renderMatch({ ...lobby, players: players.map((player) => player.id === 'p5' ? { ...player, ready: false } : player) });
assert.equal(button('startMatch').props.disabled, true, 'every joined online player must be ready');
// A room's synchronized click drill uses its seed, duration and converted clock;
// the 3D drill reports the existing multiplayer score payload.
const clickMatch = { ...lobby, mode: 'click', phase: 'playing', seed: 12345, durationMs: 15000,
  startAt: Date.now() - 1000, offset: 120, participantIds: players.map((player) => player.id) };
renderMatch(clickMatch);
const clickDrill = seenRendered.find((node) => node.name === 'RangeGame' && node.props.multiplayer);
assert.ok(clickDrill, 'room click training uses the 3D range');
assert.equal(clickDrill.props.mode, 'click');
assert.equal(clickDrill.props.seed, clickMatch.seed, 'players share the room target sequence');
assert.equal(clickDrill.props.durationMs, clickMatch.durationMs);
assert.equal(clickDrill.props.startLocal, clickMatch.startAt - clickMatch.offset, 'room time is converted to the local clock');
assert.ok(seenElements.some(node => node.props.className === 'ar-online-progress'), 'active room exposes rival progress inside the full-screen range');
const result = { score: 7, hits: 7, shots: 10, accuracy: 70 };
clickDrill.props.onProgress(result);
assert.deepEqual(calls.at(-1), ['progress', { score: 7, hits: 7, misses: 3, acc: 70 }]);
clickDrill.props.onFinish('click', 7, result);
assert.deepEqual(calls.at(-1), ['finish', { score: 7, hits: 7, misses: 3, acc: 70 }]);
clickDrill.props.onLeave();
assert.equal(calls.at(-1), 'leave', 'range leave action reaches the connected room');
// The configured rounds reach the drill; all rivals have independent progress.
for (const rounds of [5, 20]) {
  renderMatch({ ...lobby, phase: 'playing', rounds, participantIds: players.map((p) => p.id), startAt: Date.now() - 1000, offset: 0,
    progress: { p2: { hits: 2, score: 230 }, p3: { hits: 4, score: 260 } } });
  assert.ok(seenText.includes('1/' + rounds), 'reaction drill uses selected round total');
  assert.ok(seenText.includes('2/' + rounds) && seenText.includes('4/' + rounds), 'rival round progress stays separate');
  const drill = seenRendered.find((node) => node.name === 'RangeGame' && node.props.multiplayer);
  assert.equal(drill.props.mode, 'reaction');
  assert.equal(drill.props.rounds, rounds, 'room round count reaches the reaction session');
}
renderMatch({ ...lobby, role: 'guest', me: 'p2', players: players.map((player) => player.id === 'p1' ? { ...player, online: false } : player) });
assert.ok(seenText.includes('hostLeft'));
button('leaveRoom');
// Hiding the window or selecting another tab keeps a connected match mounted.
for (const [open, tab] of [[false, 'versus'], [true, 'records']]) {
  const fixturePath = `retained-${tab}`;
  const assigned = new Set();
  // Supply the disconnected room hook's initial state, leaving window and tab
  // state under the same launcher/navigation callbacks a user invokes.
  const roomState = (initial) => {
    if (initial === 'idle') { assigned.add('stage'); return { value: 'room' }; }
    if (initial === null) { assigned.add('snapshot'); return { value: { ...lobby, phase: 'playing', startAt: Date.now() - 1000, offset: 0 } }; }
    if (initial && initial.phase === 'idle' && Object.hasOwn(initial, 'broker')) {
      assigned.add('status'); return { value: { phase: 'online' } };
    }
  };
  renderTrainer(fixturePath, { [fixturePath]: roomState });
  assert.deepEqual([...assigned].sort(), ['snapshot', 'stage', 'status'], 'connected-room fixture reaches the room state');
  seenElements.find((node) => node.props.className === 'at-launch').props.onClick();
  renderTrainer(fixturePath);
  navigation('versusTab').props.onClick();
  renderTrainer(fixturePath);
  const matchBefore = seenRendered.find((node) => node.name === 'RangeGame' && node.props.multiplayer);
  assert.ok(matchBefore, 'connected match uses the 3D range');
  assert.equal(matchBefore.props.visible, true, 'active match receives input');
  if (open) navigation('recordTab').props.onClick();
  else seenElements.find((node) => node.props.className === 'at-launch').props.onClick();
  renderTrainer(fixturePath);
  const matchAfter = seenRendered.find((node) => node.name === 'RangeGame' && node.props.multiplayer);
  assert.equal(matchAfter?.path, matchBefore.path, 'connected match keeps the same mounted range');
  assert.equal(matchAfter.props.visible, false, 'hidden match releases input');
  assert.ok(seenText.includes('1/20'), 'the reaction drill stays mounted when hidden');
  if (!open) assert.equal(seenElements.find((node) => node.type === 'section' && node.props.className === 'at-win').props.style.display, 'none');
}
// Solo training is retained across tab changes and close/reopen; visibility
// tells the range to pause its local clock and release pointer input.
renderTrainer('solo');
seenElements.find((node) => node.props.className === 'at-launch').props.onClick();
renderTrainer('solo');
const soloPath = soloRange().path;
navigation('recordTab').props.onClick();
renderTrainer('solo');
assert.equal(soloRange().path, soloPath, 'tab changes keep the solo range mounted');
assert.equal(soloRange().props.visible, false, 'solo training pauses outside the training tab');
navigation('trainTab').props.onClick();
renderTrainer('solo');
assert.equal(soloRange().props.visible, true);
seenElements.find((node) => node.props.className === 'at-launch').props.onClick();
renderTrainer('solo');
assert.equal(soloRange().path, soloPath, 'closing keeps the solo range mounted');
assert.equal(soloRange().props.visible, false, 'closing pauses solo training');
console.log('[render] PASS  3D views, settings, records, five-player standings, withdrawals, host round controls, readiness and retained drills');
