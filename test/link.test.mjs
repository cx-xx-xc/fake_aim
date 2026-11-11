import assert from 'node:assert/strict';
import { openRoom, newPlayerId } from '../net/link.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return;
    await sleep(60);
  }
  throw new Error(`timeout waiting for ${label}`);
}

const links = [];
try {
  const host = await openRoom({ role: 'host', name: 'host', playerId: newPlayerId() });
  links.push(host);
  console.log(`[link] host room ${host.shareCode} via ${host.broker}`);
  assert.match(host.shareCode, /^[2-9A-HJ-NP-Z]{6}-[EH]$/, 'shared code names the relay that hosts the room');
  // The code alone must select the relay: guests deliberately get no broker hint.
  const guestOptions = (name) => ({ role: 'guest', code: host.shareCode, name, playerId: newPlayerId() });
  for (let index = 1; index < 5; index += 1) {
    const guest = await openRoom(guestOptions(`guest${index}`));
    links.push(guest);
    assert.equal(guest.code, host.code, 'share code resolves to the same room id');
    assert.equal(guest.shareCode, host.shareCode);
    assert.ok(guest.room.state.players.some((player) => player.id === guest.room.playerId), 'initial admission snapshot');
  }
  // Same six characters on the other relay is a different room, not this one.
  const otherRelay = host.shareCode.endsWith('-E') ? 'H' : 'E';
  await assert.rejects(
    openRoom({ role: 'guest', code: `${host.code}-${otherRelay}`, name: 'wrong-relay', playerId: newPlayerId(), timeoutMs: 2500 }),
    /^Error: room-not-found$/,
  );
  await until(() => links.every((link) => link.room.state.players.length === 5), 'all five-player snapshots');
  await assert.rejects(openRoom(guestOptions('sixth')), /^Error: room-full$/);
  await assert.rejects(openRoom({ ...guestOptions('incompatible'), app: '0.0.0' }), /^Error: app-mismatch$/);
  assert.equal(host.room.startMatch(), false, 'unready room cannot start');
  for (const link of links) link.room.setReady(true);
  await until(() => host.room.state.players.every((player) => player.ready), 'all readiness flags');
  assert.equal(host.room.setReactionRounds(5), true);
  await until(() => links.every((link) => link.room.state.rounds === 5), 'five rounds setting');
  await until(() => links.slice(1).every((link) => link.room.pingSamples.length >= 2), 'independent guest clock samples');
  for (const link of links.slice(1)) assert.ok(Number.isFinite(link.room.clock.offset));
  assert.equal(host.room.startMatch('reaction'), true);
  await until(() => links.every((link) => link.room.state.phase === 'countdown'), 'five-player countdown');
  for (const link of links) {
    assert.equal(link.room.state.rounds, 5);
    assert.equal(link.room.state.participantIds.length, 5);
    assert.ok(Math.abs(host.room.msUntilStart() - link.room.msUntilStart()) < 350, 'countdown clocks agree');
  }
  await assert.rejects(openRoom(guestOptions('late')), /^Error: match-in-progress$/);
  for (const [index, link] of links.entries()) link.room.reportProgress({ score: index, round: 2 });
  await until(() => links.every((link) => Object.keys(link.room.progress).length === 5), 'five independent progress entries');
  for (const [index, link] of links.entries()) link.room.finish({ score: 250 + index, hits: 5 });
  await until(() => links.every((link) => link.room.state.phase === 'finished' && Object.keys(link.room.state.results).length === 5), 'five final results');
  for (const link of links) assert.deepEqual(link.room.state.results, host.room.state.results);
  links[1].room.rematch();
  await until(() => host.room.state.rematchRequested === links[1].room.playerId, 'guest rematch request');
  const previousMatch = host.room.state.matchId;
  assert.equal(host.room.startMatch('reaction', { rounds: 20 }), true);
  await until(() => links.every((link) => link.room.state.matchId !== previousMatch && link.room.state.rounds === 20), 'twenty-round rematch');
  for (const link of links) assert.deepEqual(link.room.state.results, {});
  const withdrawn = links[4];
  withdrawn.close();
  await until(() => host.room.state.results[withdrawn.room.playerId]?.dnf, 'withdrawal recorded as DNF');
  for (const [index, link] of links.slice(0, 4).entries()) link.room.finish({ score: 240 + index, hits: 20 });
  await until(() => links.slice(0, 4).every((link) => link.room.state.phase === 'finished' && Object.keys(link.room.state.results).length === 5), 'remaining players finish after withdrawal');
  links[1].room.returnToLobby();
  await until(() => links.slice(0, 4).every((link) => link.room.state.phase === 'lobby' && link.room.state.players.length === 4), 'lobby drops departed participant');
  assert.ok(host.room.state.players.every((player) => !player.ready));
  links[3].close();
  await until(() => host.room.state.players.length === 3, 'lobby leave frees slot');
  const replacement = await openRoom(guestOptions('replacement'));
  links.push(replacement);
  await until(() => host.room.state.players.length === 4, 'replacement joins freed slot');
  host.close();
  await until(() => !replacement.room.state.players.find((player) => player.id === host.room.playerId)?.online, 'host leave reaches clients');
  console.log('[link] PASS five clients, sixth/version/midmatch rejection, readiness, clocks, rounds 5/20, progress, results, rematch, DNF, lobby and leave');
} finally {
  for (const link of links) link.close();
}
