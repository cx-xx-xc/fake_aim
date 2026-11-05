import assert from 'node:assert/strict';
import {
  PacketDecoder,
  decodeVarint,
  encodeConnect,
  encodePublish,
  encodeSubscribe,
  encodeVarint,
} from '../net/mqtt.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

const hex = (bytes) => Buffer.from(bytes).toString('hex');

test('varint roundtrip at boundaries', () => {
  for (const value of [0, 1, 127, 128, 129, 16383, 16384, 2097151, 2097152, 268435455]) {
    const encoded = encodeVarint(value);
    const decoded = decodeVarint(encoded, 0);
    assert.equal(decoded.value, value);
    assert.equal(decoded.length, encoded.length);
  }
});

test('varint rejects out of range values', () => {
  assert.throws(() => encodeVarint(-1), RangeError);
  assert.throws(() => encodeVarint(268435456), RangeError);
});

test('varint returns null while incomplete', () => {
  assert.equal(decodeVarint(Uint8Array.of(0x80), 0), null);
  assert.equal(decodeVarint(Uint8Array.of(), 0), null);
});

test('malformed varint throws', () => {
  assert.throws(() => decodeVarint(Uint8Array.of(0x80, 0x80, 0x80, 0x80, 0x01), 0), /malformed/);
});

test('connect packet layout', () => {
  const bytes = encodeConnect({ clientId: 'ab', keepalive: 60 });
  assert.equal(hex(bytes), '100e00044d5154540402003c00026162');
});

test('single publish decodes', () => {
  const decoder = new PacketDecoder();
  const packets = decoder.push(encodePublish('room/a', 'hello'));
  assert.equal(packets.length, 1);
  assert.equal(packets[0].type, 'publish');
  assert.equal(packets[0].topic, 'room/a');
  assert.equal(Buffer.from(packets[0].payload).toString(), 'hello');
  assert.equal(packets[0].retain, false);
});

test('retain flag survives', () => {
  const packets = new PacketDecoder().push(encodePublish('t', 'x', { retain: true }));
  assert.equal(packets[0].retain, true);
});

test('two packets in one chunk', () => {
  const chunk = Buffer.concat([encodePublish('a', '1'), encodePublish('b', '2')]);
  const packets = new PacketDecoder().push(new Uint8Array(chunk));
  assert.deepEqual(packets.map((p) => p.topic), ['a', 'b']);
});

test('publish split across five chunks', () => {
  const decoder = new PacketDecoder();
  const bytes = encodePublish('room/code/ev', JSON.stringify({ type: 'start', seed: 42 }));
  const cuts = [1, 3, 7, 11, bytes.length];
  let offset = 0;
  let packets = [];
  for (const cut of cuts) {
    packets = packets.concat(decoder.push(bytes.subarray(offset, cut)));
    offset = cut;
  }
  assert.equal(packets.length, 1);
  assert.equal(JSON.parse(Buffer.from(packets[0].payload).toString()).seed, 42);
});

test('multi-byte remaining length for long payload', () => {
  const payload = 'x'.repeat(300);
  const packets = new PacketDecoder().push(encodePublish('t', payload));
  assert.equal(packets.length, 1);
  assert.equal(Buffer.from(packets[0].payload).length, 300);
});

test('truncated packet yields nothing until completed', () => {
  const decoder = new PacketDecoder();
  const bytes = encodePublish('t', 'payload');
  assert.equal(decoder.push(bytes.subarray(0, bytes.length - 2)).length, 0);
  const packets = decoder.push(bytes.subarray(bytes.length - 2));
  assert.equal(packets.length, 1);
});

test('utf8 topic and payload', () => {
  const packets = new PacketDecoder().push(encodePublish('房间/测试', '你好'));
  assert.equal(packets[0].topic, '房间/测试');
  assert.equal(Buffer.from(packets[0].payload).toString(), '你好');
});

test('suback decodes', () => {
  const decoder = new PacketDecoder();
  const packets = decoder.push(Uint8Array.of(0x90, 0x03, 0x00, 0x01, 0x00));
  assert.equal(packets[0].type, 'suback');
  assert.equal(packets[0].packetId, 1);
  assert.deepEqual(packets[0].granted, [0]);
});

test('subscribe packet id and topic', () => {
  const bytes = encodeSubscribe(7, ['room/x/#']);
  assert.equal(hex(bytes.subarray(0, 2)), '820d');
  assert.equal((bytes[2] << 8) | bytes[3], 7);
});

test('partial header byte only', () => {
  const decoder = new PacketDecoder();
  assert.equal(decoder.push(Uint8Array.of(0x30)).length, 0);
});

const failed = results.filter((r) => !r.ok);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
  if (!result.ok) console.log(`      ${result.error?.message}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
