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

assert.deepEqual(guest.room.state.results, host.room.state.results);
guest.room.rematch();
await until(() => host.room.state.rematchRequested === guest.room.playerId, 'rematch request');
assert.equal(host.room.state.phase, 'finished');
const previousMatch = host.room.state.matchId;
host.room.startMatch('reaction');
await until(() => guest.room.state.matchId !== previousMatch && guest.room.state.mode === 'reaction', 'reaction rematch');
assert.deepEqual(guest.room.state.results, {});
guest.room.finish({ score: 280, hits: 8 });
host.room.finish({ score: 240, hits: 8 });
await until(() => host.room.state.phase === 'finished' && guest.room.state.phase === 'finished', 'reaction final results');
assert.deepEqual(guest.room.state.results, host.room.state.results);
guest.room.returnToLobby();
await until(() => host.room.state.phase === 'lobby' && guest.room.state.phase === 'lobby', 'return to lobby');
assert.equal(guest.room.state.startAt, 0);
guest.close();
await until(() => host.room.state.players.some((player) => player.id === guest.room.playerId && !player.online), 'guest leave notification');
host.close();
console.log('[link] PASS  click/reaction finals, rematch request, lobby return and leave notification');
