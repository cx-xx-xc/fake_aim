/**
 * Minimal MQTT 3.1.1 client over WebSocket.
 *
 * Why hand-rolled: it must run unchanged in the DSH web client (browser) and in
 * Node for scripted integration tests, with zero dependencies. Only five packet
 * types are needed: CONNECT, CONNACK, SUBSCRIBE/SUBACK, PUBLISH, PINGREQ/PINGRESP.
 *
 * The subtle part is framing: WebSocket frame boundaries have nothing to do with
 * MQTT packet boundaries, so bytes are accumulated and cut by the remaining-length
 * prefix (which is itself a 1..4 byte varint).
 */

const PACKET = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  SUBSCRIBE: 8,
  SUBACK: 9,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeVarint(value) {
  if (!Number.isInteger(value) || value < 0 || value > 268435455) {
    throw new RangeError(`invalid mqtt varint: ${value}`);
  }
  const bytes = [];
  let rest = value;
  do {
    let byte = rest % 128;
    rest = Math.floor(rest / 128);
    if (rest > 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest > 0);
  return Uint8Array.from(bytes);
}

/** Returns null while the varint is still incomplete. */
export function decodeVarint(bytes, offset = 0) {
  let multiplier = 1;
  let value = 0;
  for (let index = 0; index < 4; index += 1) {
    const position = offset + index;
    if (position >= bytes.length) return null;
    const byte = bytes[position];
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, length: index + 1 };
    multiplier *= 128;
  }
  throw new Error('malformed mqtt remaining length (more than 4 bytes)');
}

function encodeString(text) {
  const body = textEncoder.encode(text);
  if (body.length > 65535) throw new RangeError('mqtt string too long');
  const out = new Uint8Array(body.length + 2);
  out[0] = body.length >> 8;
  out[1] = body.length & 0xff;
  out.set(body, 2);
  return out;
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function packet(type, flags, body) {
  return concat([Uint8Array.of((type << 4) | flags), encodeVarint(body.length), body]);
}

export function encodeConnect({ clientId, keepalive = 30, clean = true }) {
  const body = concat([
    encodeString('MQTT'),
    Uint8Array.of(0x04, clean ? 0x02 : 0x00, keepalive >> 8, keepalive & 0xff),
    encodeString(clientId),
  ]);
  return packet(PACKET.CONNECT, 0, body);
}

export function encodeSubscribe(packetId, topics) {
  const parts = [];
  for (const topic of topics) {
    parts.push(encodeString(topic), Uint8Array.of(0x00));
  }
  const body = concat([Uint8Array.of(packetId >> 8, packetId & 0xff), ...parts]);
  return packet(PACKET.SUBSCRIBE, 0x02, body);
}

export function encodePublish(topic, payload, { retain = false, qos = 0, dup = false } = {}) {
  const body = concat([
    encodeString(topic),
    qos > 0 ? Uint8Array.of(0, 0) : new Uint8Array(0),
    typeof payload === 'string' ? textEncoder.encode(payload) : payload,
  ]);
  const flags = (dup ? 0x08 : 0) | (qos << 1) | (retain ? 0x01 : 0);
  return packet(PACKET.PUBLISH, flags, body);
}

export const encodePingreq = () => Uint8Array.of((PACKET.PINGREQ << 4) | 0x00, 0x00);
export const encodeDisconnect = () => Uint8Array.of((PACKET.DISCONNECT << 4) | 0x00, 0x00);

function parsePacket(type, flags, body) {
  if (type === PACKET.CONNACK) {
    return {
      type: 'connack',
      sessionPresent: (body[0] & 0x01) === 1,
      returnCode: body[1],
    };
  }
  if (type === PACKET.PUBLISH) {
    const topicLength = (body[0] << 8) | body[1];
    const topic = textDecoder.decode(body.subarray(2, 2 + topicLength));
    let cursor = 2 + topicLength;
    const qos = (flags >> 1) & 0x03;
    let packetId = 0;
    if (qos > 0) {
      packetId = (body[cursor] << 8) | body[cursor + 1];
      cursor += 2;
    }
    return {
      type: 'publish',
      topic,
      payload: body.subarray(cursor),
      retain: (flags & 0x01) === 1,
      qos,
      dup: (flags & 0x08) === 8,
      packetId,
    };
  }
  if (type === PACKET.SUBACK) {
    return {
      type: 'suback',
      packetId: (body[0] << 8) | body[1],
      granted: Array.from(body.subarray(2)),
    };
  }
  if (type === PACKET.PUBACK) {
    return { type: 'puback', packetId: (body[0] << 8) | body[1] };
  }
  if (type === PACKET.PINGRESP) return { type: 'pingresp' };
  return { type: 'unknown', packetType: type, body };
}

/** Streams bytes in, whole MQTT packets out, regardless of chunk boundaries. */
export class PacketDecoder {
  constructor() {
    this.buffer = new Uint8Array(0);
  }

  push(chunk) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    this.buffer = this.buffer.length === 0 ? bytes : concat([this.buffer, bytes]);
    const packets = [];
    for (;;) {
      if (this.buffer.length < 2) break;
      const header = this.buffer[0];
      const remaining = decodeVarint(this.buffer, 1);
      if (remaining === null) break;
      const start = 1 + remaining.length;
      const end = start + remaining.value;
      if (this.buffer.length < end) break;
      packets.push(parsePacket(header >> 4, header & 0x0f, this.buffer.subarray(start, end)));
      this.buffer = this.buffer.subarray(end);
    }
    return packets;
  }
}

export class MqttClient {
  /**
   * @param {object} options
   * @param {string} options.url          wss:// endpoint, e.g. wss://broker.emqx.io:8084/mqtt
   * @param {string} [options.clientId]
   * @param {number} [options.keepalive]  seconds advertised to the broker
   * @param {boolean} [options.autoReconnect]
   */
  constructor({ url, clientId, keepalive = 30, autoReconnect = true, WebSocketImpl } = {}) {
    this.url = url;
    this.clientId = clientId ?? `aim-${Math.random().toString(16).slice(2, 10)}`;
    this.keepalive = keepalive;
    this.autoReconnect = autoReconnect;
    this.WebSocketImpl = WebSocketImpl ?? globalThis.WebSocket;
    this.listeners = new Map();
    this.decoder = new PacketDecoder();
    this.socket = null;
    this.connected = false;
    this.closedByUser = false;
    this.subscriptions = new Set();
    this.nextPacketId = 1;
    this.pendingSubacks = new Map();
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.keepaliveTimer = null;
    this.lastInbound = 0;
  }

  on(event, listener) {
    const bucket = this.listeners.get(event) ?? [];
    bucket.push(listener);
    this.listeners.set(event, bucket);
    return () => {
      const current = this.listeners.get(event) ?? [];
      this.listeners.set(event, current.filter((item) => item !== listener));
    };
  }

  emit(event, ...args) {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(...args);
      } catch (error) {
        console.error('[mqtt] listener failed', error);
      }
    }
  }

  connect() {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      if (!this.WebSocketImpl) {
        reject(new Error('WebSocket is not available in this runtime'));
        return;
      }
      let settled = false;
      const socket = new this.WebSocketImpl(this.url, 'mqtt');
      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.addEventListener('open', () => {
        socket.send(encodeConnect({ clientId: this.clientId, keepalive: this.keepalive }));
      });

      socket.addEventListener('message', (event) => {
        this.lastInbound = Date.now();
        const data = event.data;
        const bytes =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data instanceof Uint8Array
              ? data
              : new Uint8Array(0);
        for (const packetIn of this.decoder.push(bytes)) {
          this.handlePacket(packetIn, () => {
            if (settled) return;
            settled = true;
            resolve();
          }, fail);
        }
      });

      socket.addEventListener('error', () => {
        this.emit('error', new Error('websocket error'));
        fail(new Error('websocket error'));
      });

      socket.addEventListener('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.stopKeepalive();
        this.emit('close', { wasConnected });
        fail(new Error('socket closed before connect'));
        if (!this.closedByUser && this.autoReconnect) this.scheduleReconnect();
      });
    });
  }

  handlePacket(packetIn, onConnected, onFailed) {
    if (packetIn.type === 'connack') {
      if (packetIn.returnCode !== 0) {
        onFailed(new Error(`mqtt refused connection: code ${packetIn.returnCode}`));
        return;
      }
      this.connected = true;
      this.reconnectAttempt = 0;
      this.startKeepalive();
      for (const topic of this.subscriptions) this.sendSubscribe(topic);
      onConnected();
      this.emit('connect', { sessionPresent: packetIn.sessionPresent });
      return;
    }
    if (packetIn.type === 'publish') {
      this.emit('message', {
        topic: packetIn.topic,
        payload: textDecoder.decode(packetIn.payload),
        bytes: packetIn.payload,
        retain: packetIn.retain,
      });
      return;
    }
    if (packetIn.type === 'suback') {
      const pending = this.pendingSubacks.get(packetIn.packetId);
      this.pendingSubacks.delete(packetIn.packetId);
      if (pending) {
        const granted = packetIn.granted[0] ?? 0x80;
        if (granted === 0x80) pending.reject(new Error('subscription refused by broker'));
        else pending.resolve(granted);
      }
      return;
    }
    if (packetIn.type === 'pingresp') return;
    this.emit('packet', packetIn);
  }

  sendSubscribe(topic) {
    if (!this.socket || !this.connected) return;
    const packetId = this.nextPacketId;
    this.nextPacketId = this.nextPacketId >= 65535 ? 1 : this.nextPacketId + 1;
    this.socket.send(encodeSubscribe(packetId, [topic]));
    this.pendingSubacks.set(packetId, { resolve: () => {}, reject: () => {} });
  }

  subscribe(topic) {
    this.subscriptions.add(topic);
    if (!this.connected) return Promise.resolve(0);
    const packetId = this.nextPacketId;
    this.nextPacketId = this.nextPacketId >= 65535 ? 1 : this.nextPacketId + 1;
    return new Promise((resolve, reject) => {
      this.pendingSubacks.set(packetId, { resolve, reject });
      this.socket.send(encodeSubscribe(packetId, [topic]));
      setTimeout(() => {
        if (this.pendingSubacks.has(packetId)) {
          this.pendingSubacks.delete(packetId);
          reject(new Error(`subscribe timed out: ${topic}`));
        }
      }, 8000);
    });
  }

  publish(topic, payload, options = {}) {
    if (!this.socket || !this.connected) return false;
    this.socket.send(encodePublish(topic, payload, options));
    return true;
  }

  startKeepalive() {
    this.stopKeepalive();
    const period = Math.max(5, Math.floor(this.keepalive * 0.75)) * 1000;
    this.keepaliveTimer = setInterval(() => {
      if (!this.connected) return;
      if (Date.now() - this.lastInbound > this.keepalive * 2000) {
        this.emit('error', new Error('mqtt keepalive lost'));
        this.close(false);
        return;
      }
      try {
        this.socket?.send(encodePingreq());
      } catch (error) {
        this.emit('error', error);
      }
    }, period);
    if (typeof this.keepaliveTimer === 'object' && this.keepaliveTimer?.unref) this.keepaliveTimer.unref();
  }

  stopKeepalive() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(8000, 500 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.emit('reconnecting', { attempt: this.reconnectAttempt, delay });
      this.connect().catch(() => {});
    }, delay);
    if (typeof this.reconnectTimer === 'object' && this.reconnectTimer?.unref) this.reconnectTimer.unref();
  }

  close(byUser = true) {
    this.closedByUser = byUser;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepalive();
    try {
      if (this.socket && this.connected) this.socket.send(encodeDisconnect());
    } catch {}
    this.connected = false;
    try {
      this.socket?.close();
    } catch {}
    this.socket = null;
  }
}
