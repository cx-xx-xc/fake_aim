import assert from 'node:assert/strict';
import {
  buildTargets,
  estimateClockOffset,
  formatShareCode,
  mulberry32,
  normalizeCode,
  parseInvite,
  randomCode,
  Room,
  topicsFor,
  CODE_LENGTH,
} from '../net/room.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

test('normalizeCode accepts messy input', () => {
  assert.equal(normalizeCode('7k3q 9f'), '7K3Q9F');
  assert.equal(normalizeCode('7K3Q-9F'), '7K3Q9F');
  assert.equal(normalizeCode('一起打靶，房间码 7K3Q9F'), '7K3Q9F');
});

test('normalizeCode rejects wrong length', () => {
  assert.equal(normalizeCode('7K3Q'), '');
  assert.equal(normalizeCode(''), '');
  assert.equal(normalizeCode('!!!!!!'), '');
});

test('share codes carry the relay that hosts the room', () => {
  assert.equal(formatShareCode('ABC234', 'emqx'), 'ABC234-E');
  assert.equal(formatShareCode('ABC234', 'hivemq'), 'ABC234-H');
  assert.equal(formatShareCode('ABC234', 'somewhere'), 'ABC234');
  assert.deepEqual(parseInvite('ABC234-E'), { code: 'ABC234', relay: 'emqx' });
  assert.deepEqual(parseInvite('abc 234 h'), { code: 'ABC234', relay: 'hivemq' });
  assert.deepEqual(parseInvite('ABC234E'), { code: 'ABC234', relay: 'emqx' });
  assert.deepEqual(parseInvite('房间码 ABC234-H，快来'), { code: 'ABC234', relay: 'hivemq' });
  assert.equal(normalizeCode('ABC234-E'), 'ABC234');
});

test('bare legacy codes still parse without a relay', () => {
  assert.deepEqual(parseInvite('ABC234'), { code: 'ABC234', relay: '' });
  assert.deepEqual(parseInvite('  7k3q 9f '), { code: '7K3Q9F', relay: '' });
});

test('share codes reject bad relay letters and truncated bodies', () => {
  assert.deepEqual(parseInvite('ABC234-X'), { code: '', relay: '' });
  assert.deepEqual(parseInvite('ABC23-E'), { code: '', relay: '' });
  assert.deepEqual(parseInvite('ABC23O-E'), { code: '', relay: '' });
  assert.deepEqual(parseInvite(''), { code: '', relay: '' });
});

test('codes use the safe alphabet and full length', () => {
  for (let index = 0; index < 200; index += 1) {
    const code = randomCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^[2-9A-HJ-NP-Z]{6}$/);
  }
});

test('targets are deterministic per seed', () => {
  const first = buildTargets(12345, 50);
  const second = buildTargets(12345, 50);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, buildTargets(12346, 50));
});

test('targets stay inside the arena and keep spacing', () => {
  const targets = buildTargets(999, 60);
  for (const [index, target] of targets.entries()) {
    assert.ok(target.x >= 0.06 && target.x <= 0.94);
    assert.ok(target.y >= 0.08 && target.y <= 0.92);
    for (const other of targets.slice(Math.max(0, index - 4), index)) {
      assert.ok(Math.hypot(other.x - target.x, other.y - target.y) >= 0.13);
    }
  }
});

test('prng is stable and reproducible', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('clock offset uses the lowest rtt sample', () => {
  const hostMinusLocal = 5000;
  const samples = [
    { t0: 1000, t1: 1000 + 60 + hostMinusLocal, t2: 1120 }, // rtt 120
    { t0: 2000, t1: 2000 + 10 + hostMinusLocal, t2: 2020 }, // rtt 20, winner
    { t0: 3000, t1: 3000 + 40 + hostMinusLocal, t2: 3080 }, // rtt 80
  ];
  const { offset, rtt } = estimateClockOffset(samples);
  assert.equal(rtt, 20);
  assert.equal(offset, hostMinusLocal);
});

test('topics are namespaced per room', () => {
  const topics = topicsFor('ABC234');
  assert.equal(topics.state, 'fakeaim/v1/room/ABC234/state');
  assert.equal(topics.events, 'fakeaim/v1/room/ABC234/ev');
  assert.equal(topics.commands, 'fakeaim/v1/room/ABC234/cmd');
});

test('host and guest reach the same phase after a scripted match', () => {
  const hostOut = [];
  const guestOut = [];
  const sameClock = () => 100000;
  const host = new Room({
    role: 'host',
    playerId: 'p1',
    name: 'host',
    now: sameClock,
    emit: (out) => hostOut.push(out),
  });
  const guest = new Room({
    role: 'guest',
    playerId: 'p2',
    name: 'guest',
    now: sameClock,
    emit: (out) => guestOut.push(out),
  });

  host.createRoom('ABC234');
  guest.joinRoom('ABC234');

  // replay queued output in order, as a broker would
  const deliver = () => {
    while (hostOut.length || guestOut.length) {
      const hostMessage = hostOut.shift();
      if (hostMessage) guest.handle(hostMessage.channel, hostMessage.payload);
      const guestMessage = guestOut.shift();
      if (guestMessage) host.handle(guestMessage.channel, guestMessage.payload);
    }
  };
  deliver();

  assert.equal(host.state.players.length, 2);
  assert.equal(guest.state.players.length, 2);

  host.setReady(true);
  guest.setReady(true);
  deliver();
  assert.equal(host.startMatch('click'), true);
  deliver();
  assert.equal(guest.state.phase, 'countdown');
  assert.equal(guest.state.seed, host.state.seed);

  guest.finish({ score: 40 });
  host.finish({ score: 35 });
  deliver();

  assert.equal(host.state.phase, 'finished');
  assert.equal(guest.state.phase, 'finished');
  assert.deepEqual(host.state.results, { p2: { score: 40 }, p1: { score: 35 } });
});

function pairedRooms() {
  const queue = [];
  const emit = (sender) => (message) => queue.push({ sender, ...JSON.parse(JSON.stringify(message)) });
  const host = new Room({ role: 'host', playerId: 'p1', name: 'host', emit: emit('host'), now: () => 100000 });
  const guest = new Room({ role: 'guest', playerId: 'p2', name: 'guest', emit: emit('guest'), now: () => 100000 });
  const deliver = () => {
    let count = 0;
    while (queue.length) {
      assert.ok(count++ < 100, 'message loop terminates');
      const message = queue.shift();
      // MQTT echoes publications to the sender too; delivery is asynchronous.
      host.handle(message.channel, message.payload);
      guest.handle(message.channel, message.payload);
    }
  };
  host.createRoom('ABC234');
  guest.joinRoom('ABC234');
  deliver();
  host.setReady(true);
  guest.setReady(true);
  deliver();
  host.startMatch('click');
  deliver();
  return { host, guest, queue, deliver };
}

test('delayed self snapshots cannot erase the final score', () => {
  const { host, guest, queue, deliver } = pairedRooms();
  guest.finish({ score: 40 });
  const guestFinish = queue.shift();
  host.finish({ score: 35 });
  // Guest's result reaches the host before the host receives its older snapshot.
  host.handle(guestFinish.channel, guestFinish.payload);
  const olderSnapshot = queue.shift();
  host.handle(olderSnapshot.channel, olderSnapshot.payload);
  assert.equal(host.state.phase, 'finished', 'old echo must not remount an expired drill');
  assert.deepEqual(host.state.results.p2, { score: 40 });
  deliver();
  assert.equal(host.state.phase, 'finished');
  assert.deepEqual(host.state.results, { p1: { score: 35 }, p2: { score: 40 } });
  assert.deepEqual(guest.state.results, host.state.results);
});

test('guest keeps its submitted result while awaiting the host', () => {
  const { guest } = pairedRooms();
  guest.finish({ score: 27 });
  assert.deepEqual(guest.state.results.p2, { score: 27 });
  assert.notEqual(guest.state.phase, 'finished');
});

test('old match messages cannot change a rematch score or progress', () => {
  const { host, guest, queue, deliver } = pairedRooms();
  guest.reportProgress({ score: 40 });
  const oldProgress = queue.shift();
  guest.finish({ score: 40 });
  const oldFinish = JSON.parse(JSON.stringify(queue[0]));
  host.finish({ score: 35 });
  deliver();
  host.rematch();
  deliver();
  host.handle(oldProgress.channel, oldProgress.payload);
  host.handle(oldFinish.channel, oldFinish.payload);
  assert.deepEqual(host.state.results, {});
  assert.equal(host.opponentProgress, null);
  assert.deepEqual(guest.state.results, {});
});

test('guest can request a rematch and return both players to the lobby', () => {
  const { host, guest, deliver } = pairedRooms();
  guest.finish({ score: 40 });
  host.finish({ score: 35 });
  deliver();
  guest.rematch();
  deliver();
  assert.equal(host.state.phase, 'finished', 'host decides when to restart');
  assert.equal(host.state.rematchRequested, 'p2');
  guest.returnToLobby();
  deliver();
  for (const room of [host, guest]) {
    assert.equal(room.state.phase, 'lobby');
    assert.equal(room.state.startAt, 0);
    assert.deepEqual(room.state.results, {});
    assert.ok(room.state.players.every((player) => !player.ready));
  }
});

test('duplicate finish submissions cannot overwrite a completed score', () => {
  const { host, guest, queue, deliver } = pairedRooms();
  guest.finish({ score: 40 });
  const repeated = JSON.parse(JSON.stringify(queue[0]));
  host.finish({ score: 35 });
  deliver();
  repeated.payload.result.score = 0;
  host.handle(repeated.channel, repeated.payload);
  host.finish({ score: 0 });
  guest.finish({ score: 0 });
  deliver();
  assert.deepEqual(host.state.results, { p1: { score: 35 }, p2: { score: 40 } });
  assert.deepEqual(guest.state.results, host.state.results);
});

function multiplayer(count = 5) {
  const queue = [];
  const rooms = Array.from({ length: count }, (_, index) => new Room({
    role: index ? 'guest' : 'host', playerId: `p${index}`, name: `player${index}`,
    now: () => 100000 + index * 100, emit: (out) => queue.push(JSON.parse(JSON.stringify(out))),
  }));
  const deliver = () => {
    let n = 0;
    while (queue.length) {
      assert.ok(n++ < 500, 'bounded broker queue');
      const { channel, payload } = queue.shift();
      for (const room of rooms) room.handle(channel, payload);
    }
  };
  const host = rooms[0];
  host.createRoom('ABC234');
  for (const guest of rooms.slice(1)) guest.joinRoom('ABC234');
  deliver();
  return { rooms, host, deliver, queue };
}

test('five players require everyone ready and share authoritative reaction rounds', () => {
  const { rooms, host, deliver } = multiplayer();
  assert.equal(host.state.players.length, 5);
  assert.equal(host.state.rounds, 8);
  assert.equal(host.startMatch(), false);
  for (const room of rooms.slice(0, 4)) room.setReady(true);
  deliver();
  assert.equal(host.startMatch(), false);
  rooms[4].setReady(true);
  deliver();
  for (const invalid of [4, 21, 5.5, '8', NaN]) {
    assert.equal(host.setReactionRounds(invalid), false);
    assert.equal(host.startMatch('reaction', { rounds: invalid }), false);
  }
  assert.equal(rooms[1].setReactionRounds(5), false);
  assert.equal(host.setReactionRounds(20), true);
  deliver();
  assert.ok(rooms.every((room) => room.state.rounds === 20));
  assert.equal(host.startMatch('reaction', { rounds: 5 }), true);
  deliver();
  assert.ok(rooms.every((room) => room.state.rounds === 5 && room.state.participantIds.length === 5));
  assert.equal(host.setReactionRounds(20), false);
  assert.equal(host.startMatch(), false);
  for (const [index, room] of rooms.entries()) room.reportProgress({ score: index, round: 2 });
  deliver();
  assert.ok(rooms.every((room) => Object.keys(room.progress).length === 5));
  for (const [index, room] of rooms.entries()) room.finish({ score: index });
  deliver();
  assert.ok(rooms.every((room) => room.state.phase === 'finished'));
  for (const room of rooms) assert.deepEqual(room.state.results, host.state.results);
  rooms[2].rematch();
  deliver();
  assert.equal(host.state.rematchRequested, 'p2');
  host.rematch();
  deliver();
  assert.ok(rooms.every((room) => room.state.rounds === 5 && Object.keys(room.progress).length === 0));
});

test('join rejection is directed and lobby leave frees a slot', () => {
  const { rooms, host, deliver } = multiplayer(6);
  assert.equal(host.state.players.length, 5);
  assert.equal(rooms[5].joinError, 'room-full');
  assert.equal(rooms[1].joinError, null);
  rooms[1].leave();
  deliver();
  assert.equal(host.state.players.length, 4);
  rooms[5].joinError = null;
  rooms[5].joinRoom('ABC234');
  deliver();
  assert.equal(host.state.players.length, 5);
  assert.ok(host.state.players.some((player) => player.id === 'p5'));
  const badJoin = { type: 'join', from: 'wrong-version', app: '0.0.0' };
  assert.equal(host.handle('cmd', badJoin), 'app-mismatch');
});

test('midmatch joins rejected and withdrawal cannot block completion or submit late scores', () => {
  const { rooms, host, deliver } = multiplayer(3);
  for (const room of rooms) room.setReady(true);
  deliver();
  host.startMatch('reaction');
  deliver();
  assert.equal(host.handle('cmd', { type: 'join', from: 'late', app: host.app }), 'match-in-progress');
  const matchId = host.state.matchId;
  rooms[2].leave();
  deliver();
  assert.equal(host.state.results.p2.dnf, true);
  assert.equal(host.state.players.find((player) => player.id === 'p2').online, false);
  assert.equal(host.handle('ev', { type: 'finish', from: 'p2', matchId, result: { score: 999 } }), 'inactive-player');
  assert.equal(host.handle('ev', { type: 'progress', from: 'intruder', matchId, score: 999 }), 'unknown-player');
  rooms[0].finish({ score: 1 });
  rooms[1].finish({ score: 2 });
  deliver();
  assert.equal(host.state.phase, 'finished');
  assert.equal(host.handle('cmd', { type: 'rematch', from: 'p2', matchId }), 'unknown-player');
  rooms[1].returnToLobby();
  deliver();
  assert.equal(host.state.players.length, 2);
  assert.ok(host.state.players.every((player) => !player.ready));
  host.leave();
  deliver();
  assert.equal(rooms[1].state.players.find((player) => player.id === 'p0').online, false);
});

test('multiplayer pongs only consume the requesting guest pending timestamp', () => {
  const { rooms, host, deliver, queue } = multiplayer(3);
  rooms[1].sendPing();
  rooms[2].sendPing();
  deliver();
  assert.equal(rooms[1].pingSamples.length, 1);
  assert.equal(rooms[2].pingSamples.length, 1);
  assert.equal(rooms[1].pingSamples[0].t0, 100100);
  assert.equal(rooms[2].pingSamples[0].t0, 100200);
  host.handle('cmd', { type: 'ping', from: 'p1', t0: 123 });
  deliver();
  assert.equal(rooms[1].pingSamples.length, 1, 'unsolicited timestamp ignored');
  assert.equal(queue.length, 0);
});

test('one online player cannot start even with a departed roster entry', () => {
  const { rooms, host, deliver } = multiplayer(2);
  host.setReady(true);
  rooms[1].setReady(true);
  deliver();
  rooms[1].leave();
  deliver();
  assert.equal(host.startMatch(), false);
});

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
  if (!result.ok) console.log(`      ${result.error?.message}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
