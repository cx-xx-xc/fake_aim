/**
 * End-to-end over a real public broker: two independent clients, one room,
 * a full click-mode match. Run: node test/broker.test.mjs
 */
import assert from 'node:assert/strict';
import { MqttClient } from '../net/mqtt.js';
import { Room, buildTargets, randomCode, topicsFor } from '../net/room.js';

const BROKER = process.env.AIM_BROKER ?? 'wss://broker.emqx.io:8084/mqtt';
const SKEW = 12_345; // pretend the guest's clock is off by 12s
const code = randomCode();
const topics = topicsFor(code);
const log = (...args) => console.log('[broker]', ...args);

function channelOf(topic) {
  if (topic === topics.state) return 'state';
  if (topic === topics.events) return 'ev';
  if (topic === topics.commands) return 'cmd';
  return null;
}

function wire(client, room) {
  client.on('message', ({ topic, payload }) => {
    const channel = channelOf(topic);
    if (!channel) return;
    let message;
    try {
      message = payload ? JSON.parse(payload) : null;
    } catch {
      return;
    }
    room.handle(channel, message);
  });
}

function emitter(client) {
  return ({ channel, payload, retain }) => {
    const topic = { state: topics.state, ev: topics.events, cmd: topics.commands }[channel];
    client.publish(topic, payload === null ? '' : JSON.stringify(payload), { retain });
  };
}

async function waitFor(label, predicate, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const hostClient = new MqttClient({ url: BROKER, autoReconnect: false });
const guestClient = new MqttClient({ url: BROKER, autoReconnect: false });

const host = new Room({ role: 'host', playerId: 'p1', name: 'host', emit: emitter(hostClient) });
const guestNow = () => Date.now() + SKEW;
const guest = new Room({
  role: 'guest',
  playerId: 'p2',
  name: 'guest',
  now: guestNow,
  emit: emitter(guestClient),
});

let failed = false;
try {
  log(`broker ${BROKER} room ${code}`);
  const startedAt = Date.now();
  await Promise.all([hostClient.connect(), guestClient.connect()]);
  log(`connected in ${Date.now() - startedAt}ms`);

  await Promise.all([
    hostClient.subscribe(topics.state),
    hostClient.subscribe(topics.events),
    hostClient.subscribe(topics.commands),
    guestClient.subscribe(topics.state),
    guestClient.subscribe(topics.events),
    guestClient.subscribe(topics.commands),
  ]);
  log('subscribed');

  wire(hostClient, host);
  wire(guestClient, guest);

  host.createRoom(code);
  guest.joinRoom(code);
  await waitFor(
    'both players in room on both sides',
    () => host.state.players.length === 2 && guest.state.players.length === 2,
  );
  assert.equal(guest.state.hostId, 'p1');
  assert.ok(host.state.players.some((player) => player.id === 'p2'));
  log('joined: ' + host.state.players.map((player) => player.name).join(', '));

  // --- clock sync over the real network -------------------------------------
  for (let index = 0; index < 5; index += 1) {
    guest.sendPing();
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  await waitFor('pong samples', () => guest.pingSamples.length >= 5);
  const { offset, rtt } = guest.clock;
  log(`clock offset ${offset.toFixed(1)}ms (true ${-SKEW}), rtt ${rtt}ms`);
  assert.ok(Math.abs(offset + SKEW) < 300, `offset drifted: ${offset}`);

  // --- start ----------------------------------------------------------------
  assert.equal(host.startMatch('click'), true);
  await waitFor('guest sees countdown', () => guest.state.phase === 'countdown');
  assert.equal(guest.state.seed, host.state.seed);
  assert.equal(guest.state.startAt, host.state.startAt);

  const hostCountdown = host.msUntilStart();
  const guestCountdown = guest.msUntilStart();
  log(`countdown host ${hostCountdown}ms / guest ${guestCountdown}ms`);
  assert.ok(Math.abs(hostCountdown - guestCountdown) < 100, 'countdown misaligned');

  // --- same board -----------------------------------------------------------
  const hostTargets = buildTargets(host.state.seed, 200);
  const guestTargets = buildTargets(guest.state.seed, 200);
  assert.deepEqual(hostTargets, guestTargets);
  log('target sequences identical');

  // --- play ---------------------------------------------------------------
  for (let score = 1; score <= 3; score += 1) {
    host.reportProgress({ score: score + 20, hits: score + 20, acc: 0.9 });
    guest.reportProgress({ score: score + 5, hits: score + 5, acc: 0.8 });
  }
  await waitFor('host sees opponent progress', () => host.opponentProgress?.score === 8);
  log(`host sees guest score ${host.opponentProgress.score}`);

  guest.finish({ score: 28, acc: 0.84, avgMs: 610 });
  host.finish({ score: 41, acc: 0.93, avgMs: 430 });
  await waitFor('match finished', () => host.state.phase === 'finished', 15000);
  await waitFor('guest sees results', () => Object.keys(guest.state.results).length === 2);

  assert.deepEqual(host.state.results, {
    p2: { score: 28, acc: 0.84, avgMs: 610 },
    p1: { score: 41, acc: 0.93, avgMs: 430 },
  });
  assert.equal(guest.state.phase, 'finished');
  log(`final: host ${host.state.results.p1.score} vs guest ${host.state.results.p2.score}`);
  console.log('\nPASS  broker end-to-end match');
} catch (error) {
  failed = true;
  console.log('\nFAIL  broker end-to-end match');
  console.log(`      ${error.message}`);
} finally {
  host.leave();
  await new Promise((resolve) => setTimeout(resolve, 300));
  hostClient.close();
  guestClient.close();
  await new Promise((resolve) => setTimeout(resolve, 200));
  process.exit(failed ? 1 : 0);
}
