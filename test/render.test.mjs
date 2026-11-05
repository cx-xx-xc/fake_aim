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

let captured = null;
const noop = () => {};
const storage = () => ({ getItem: () => null, setItem: noop, removeItem: noop });

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
    if (cursor.override && Object.hasOwn(cursor.override, index)) {
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
let registered = null;
let updatePanel = null;
const ctx = {
  effect: (fn) => { fn(); },
  locale: {
    register: (ns, locale, dict) => { dicts.set(locale, dict); },
    bind: () => (key) => key,
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
const visit = (node, pathName, overrides) => {
  if (node == null || node === false || node === true) return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child, index) => sum + visit(child, `${pathName}.${index}`, overrides), 0);
  }
  if (typeof node !== 'object') { seenText.push(String(node)); return 0; }
  const { type, props } = node;
  if (typeof type === 'function') {
    seenComponents.set(type.name, type);
    const previous = cursor;
    cursor = { path: pathName, index: 0, override: overrides[pathName] || null };
    let output;
    try {
      output = type(props || {});
    } finally {
      cursor = previous;
    }
    return 1 + visit(output, `${pathName}>`, overrides);
  }
  seenElements.push(node);
  if (props && typeof props.className === 'string') seenClasses.add(props.className);
  const children = props ? props.children : null;
  return children == null ? 1 : 1 + visit(children, pathName, overrides);
};

const Trainer = registered.component;
assert.equal(updatePanel.position.key, '@local/aim-trainer');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates', {});
assert.ok(seenText.some((text) => text.includes('1.2.2')), 'current version is visible');
assert.ok(seenText.includes('checkUpdates'), 'check button rendered');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates-error', { 'updates-error': { 0: { status: 'error' } } });
assert.ok(seenText.includes('updateFailed'), 'failure is shown explicitly');
visit(React.createElement(updatePanel.component, { view: 'page' }), 'updates-available', { 'updates-available': { 0: { status: 'available', version: '1.3.0', spec: 'github:cx-xx-xc/fake_aim#abc', url: 'https://github.com/cx-xx-xc/fake_aim' } } });
assert.ok(seenText.includes('updateSteps'), 'new version offers update instructions');
assert.ok(seenElements.some((node) => node.type === 'textarea' && node.props.readOnly), 'installation target can be copied manually');


// 1. Collapsed window: the launcher must still render.
visit(React.createElement(Trainer, {}), 'root', {});
assert.ok(seenClasses.has('at-root'), 'overlay root rendered');
assert.ok(seenClasses.has('at-launch'), 'launcher rendered');

// 2. Train tab (root hook 0 = open, hook 1 = tab).
seenClasses.clear();
visit(React.createElement(Trainer, {}), 'root', { root: { 0: true, 1: 'train' } });
assert.ok(seenClasses.has('at-win'), 'panel window rendered');
assert.ok(seenClasses.has('at-modes'), 'mode picker rendered');

// 3. Versus lobby.
seenClasses.clear();
visit(React.createElement(Trainer, {}), 'root', { root: { 0: true, 1: 'versus' } });
assert.ok(seenClasses.has('at-vs'), 'versus lobby rendered');

// 4. Records tab.
seenClasses.clear();
visit(React.createElement(Trainer, {}), 'root', { root: { 0: true, 1: 'records' } });
assert.ok(seenClasses.has('at-records'), 'records view rendered');

// 5. Exercise the actual versus components with final/partial score snapshots.
const VersusPanel = seenComponents.get('VersusPanel');
assert.ok(VersusPanel);
const calls = [];
const actions = {
  rematch: () => calls.push('rematch'),
  returnToLobby: () => calls.push('lobby'),
};
const baseSnap = {
  me: 'p1', role: 'host', phase: 'finished', mode: 'click', startAt: Date.now() - 40000,
  players: [{ id: 'p1' }, { id: 'p2' }], results: { p1: { score: 35 }, p2: { score: 40 } },
};
function renderMatch(snap) {
  seenClasses.clear(); seenElements.length = 0; seenText.length = 0;
  const vs = { stage: 'room', status: { phase: 'online' }, snap,
    act: (fn) => fn(actions), leave: () => calls.push('leave') };
  visit(React.createElement(VersusPanel, { vs, t: (key) => key }), 'match', {});
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
console.log('[render] PASS  mounted views, score verdicts, room actions and waiting-state exit');
