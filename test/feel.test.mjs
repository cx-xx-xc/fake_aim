import assert from 'node:assert/strict';
import { FEEL_KEY, FEEL_DEFAULTS, validateFeelConfig, readFeelConfig, saveFeelConfig, feelPoint } from '../src/feel.js';

// Persisted preferences are untrusted; invalid or partial data must not enable audio.
for (const value of [undefined, null, false, 42, 'cross', [], { sound: 'true', gun: 0, effects: null, crosshair: 'laser' }]) {
  assert.deepEqual(validateFeelConfig(value), FEEL_DEFAULTS);
}
assert.deepEqual(validateFeelConfig({ sound: true, gun: false, effects: false, crosshair: 'ring', unknown: 'ignored' }), {
  sound: true, gun: false, effects: false, crosshair: 'ring',
});
assert.deepEqual(validateFeelConfig({ crosshair: 'dot' }), { ...FEEL_DEFAULTS, crosshair: 'dot' });
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
assert.deepEqual(readFeelConfig(storage), FEEL_DEFAULTS);
assert.equal(saveFeelConfig(storage, { sound: true, gun: false, crosshair: 'dot' }), true);
assert.deepEqual(readFeelConfig(storage), { sound: true, gun: false, effects: true, crosshair: 'dot' });
assert.deepEqual(JSON.parse(values.get(FEEL_KEY)), readFeelConfig(storage));
values.set(FEEL_KEY, '{broken');
assert.deepEqual(readFeelConfig(storage), FEEL_DEFAULTS);
values.set(FEEL_KEY, 'null');
assert.deepEqual(readFeelConfig(storage), FEEL_DEFAULTS);
const blocked = { getItem() { throw Error('disabled'); }, setItem() { throw Error('quota'); } };
assert.deepEqual(readFeelConfig(blocked), FEEL_DEFAULTS);
assert.equal(saveFeelConfig(blocked, FEEL_DEFAULTS), false);
assert.deepEqual(readFeelConfig(undefined), FEEL_DEFAULTS);
assert.equal(saveFeelConfig(undefined, FEEL_DEFAULTS), false);

// Reticle coordinates use arena content origin, including its one-pixel border.
const rect = { left: 100, top: 50, width: 402, height: 302 };
assert.deepEqual(feelPoint(301, 201, rect, 1, 1), { x: 200, y: 150, swayX: 0, swayY: 0 });
assert.deepEqual(feelPoint(0, 0, rect, 1, 1), { x: 0, y: 0, swayX: -6, swayY: -3.5 });
assert.deepEqual(feelPoint(1000, 1000, rect, 1, 1), { x: 400, y: 300, swayX: 6, swayY: 3.5 });
assert.deepEqual(feelPoint(NaN, undefined, rect, 1, 1), { x: 200, y: 150, swayX: 0, swayY: 0 });
assert.deepEqual(feelPoint(100, 50, { left: 100, top: 50, width: 0, height: 0 }), { x: 0, y: 0, swayX: 0, swayY: 0 });
for (let x = -100; x < 900; x += 17) {
  const p = feelPoint(x, x / 2, rect, 1, 1);
  assert.ok(p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 300);
  assert.ok(Math.abs(p.swayX) <= 6 && Math.abs(p.swayY) <= 3.5);
}
console.log('[feel] PASS guarded preferences, validation, storage roundtrip, border-correct cursor and bounded sway');
