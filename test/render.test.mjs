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
    register: (position, component) => { registered = { position, component }; },
    list: () => [],
  },
};

moduleExports.apply(ctx);
assert.ok(registered, 'apply() registered a slot occupant');
assert.equal(registered.position.id, 'aim-trainer');
assert.equal(registered.position.name, 'shell.overlay');
assert.ok(dicts.get('en') && dicts.get('zh'), 'both locales registered');

const seenClasses = new Set();
const visit = (node, pathName, overrides) => {
  if (node == null || node === false || node === true) return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child, index) => sum + visit(child, `${pathName}.${index}`, overrides), 0);
  }
  if (typeof node !== 'object') return 0;
  const { type, props } = node;
  if (typeof type === 'function') {
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
  if (props && typeof props.className === 'string') seenClasses.add(props.className);
  const children = props ? props.children : null;
  return children == null ? 1 : 1 + visit(children, pathName, overrides);
};

const Trainer = registered.component;

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

console.log('[render] PASS  bundle mounts; launcher, train, versus and records views render');
