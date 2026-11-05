import assert from 'node:assert/strict';
import {
  buildTargets,
  estimateClockOffset,
  mulberry32,
  normalizeCode,
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

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
  if (!result.ok) console.log(`      ${result.error?.message}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
