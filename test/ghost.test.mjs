import assert from 'node:assert/strict';
import { GHOST_KEY, validGhost, readGhost, saveGhost, ghostScoreAt } from '../src/ghost.js';
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
assert.equal(readGhost(storage, 30000), null);
assert.equal(saveGhost(storage, [100, 900, 1200], 30000), true);
const ghost = readGhost(storage, 30000);
for (const [time, score] of [[-1, 0], [0, 0], [99, 0], [100, 1], [899, 1], [900, 2], [30000, 3]]) {
  assert.equal(ghostScoreAt(ghost, time), score);
}
assert.equal(saveGhost(storage, [100, 200], 30000), false);
assert.equal(saveGhost(storage, [100, 200, 300], 30000), false);
assert.deepEqual(readGhost(storage, 30000), ghost, 'ties preserve the previous timeline');
assert.equal(saveGhost(storage, [0, 400, 500, 29999], 30000), true);
assert.equal(readGhost(storage, 20000), null, 'incompatible drill duration is not replayed');
for (const hits of [[-1], [30000], [500, 100], [NaN], [Infinity], [], ['200']]) {
  assert.equal(validGhost({ version: 1, durationMs: 30000, hits }, 30000), false);
  assert.equal(saveGhost(storage, hits, 30000), false);
}
values.set(GHOST_KEY, '{broken');
assert.equal(readGhost(storage, 30000), null);
const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
assert.equal(readGhost(unavailable, 30000), null);
assert.equal(saveGhost(unavailable, [100], 30000), false);
assert.equal(ghostScoreAt(null, 100), 0);
console.log('[ghost] PASS timeline playback, best-run replacement, duration validation, corrupt storage and quota errors');
