import assert from 'node:assert/strict';
import { openRoom, newPlayerId } from '../net/link.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return true;
    await sleep(60);
  }
  throw new Error(`timeout waiting for ${label}`);
}

const host = await openRoom({ role: 'host', name: 'host', playerId: newPlayerId() });
console.log(`[link] host room ${host.code} via ${host.broker}`);

const guest = await openRoom({ role: 'guest', code: host.code, name: 'guest', playerId: newPlayerId() });
console.log(`[link] guest joined ${guest.code} via ${guest.broker}`);

await until(() => host.room.state.players.length === 2, 'host to see the guest');
assert.equal(host.room.state.players[1].name, 'guest');

guest.room.setReady(true);
await until(() => host.room.state.players.some((player) => player.id === guest.room.playerId && player.ready), 'guest ready to reach the host');

await until(() => guest.room.pingSamples.length >= 2, 'clock samples');
assert.ok(Number.isFinite(guest.room.clock.offset));

assert.equal(host.room.startMatch('click'), true);
await until(() => guest.room.state.phase === 'countdown', 'guest to see the start', 6000);
assert.equal(guest.room.state.mode, 'click');

const hostWait = host.room.msUntilStart();
const guestWait = guest.room.msUntilStart();
assert.ok(Math.abs(hostWait - guestWait) < 250, `countdown drift ${hostWait} vs ${guestWait}`);

host.room.finish({ score: 12, hits: 12, misses: 3, acc: 80 });
guest.room.finish({ score: 10, hits: 10, misses: 5, acc: 66 });
await until(() => Object.keys(guest.room.state.results).length === 2, 'both results');
await until(() => host.room.state.phase === 'finished' && guest.room.state.phase === 'finished', 'finished phase');

console.log('[link] PASS  link end-to-end match');
host.close();
guest.close();
