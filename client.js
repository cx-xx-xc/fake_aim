window.__ModuleLoader__.load({
  id: '@local/aim-trainer',
  factory(require) {
    const React = require('react');
    // ---- net/mqtt.js ----
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

    function encodeVarint(value) {
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
    function decodeVarint(bytes, offset = 0) {
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

    function encodeConnect({ clientId, keepalive = 30, clean = true }) {
      const body = concat([
        encodeString('MQTT'),
        Uint8Array.of(0x04, clean ? 0x02 : 0x00, keepalive >> 8, keepalive & 0xff),
        encodeString(clientId),
      ]);
      return packet(PACKET.CONNECT, 0, body);
    }

    function encodeSubscribe(packetId, topics) {
      const parts = [];
      for (const topic of topics) {
        parts.push(encodeString(topic), Uint8Array.of(0x00));
      }
      const body = concat([Uint8Array.of(packetId >> 8, packetId & 0xff), ...parts]);
      return packet(PACKET.SUBSCRIBE, 0x02, body);
    }

    function encodePublish(topic, payload, { retain = false, qos = 0, dup = false } = {}) {
      const body = concat([
        encodeString(topic),
        qos > 0 ? Uint8Array.of(0, 0) : new Uint8Array(0),
        typeof payload === 'string' ? textEncoder.encode(payload) : payload,
      ]);
      const flags = (dup ? 0x08 : 0) | (qos << 1) | (retain ? 0x01 : 0);
      return packet(PACKET.PUBLISH, flags, body);
    }

    const encodePingreq = () => Uint8Array.of((PACKET.PINGREQ << 4) | 0x00, 0x00);
    const encodeDisconnect = () => Uint8Array.of((PACKET.DISCONNECT << 4) | 0x00, 0x00);

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
    class PacketDecoder {
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

    class MqttClient {
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
    // ---- net/room.js ----
    /**
     * Room / match logic, transport-agnostic.
     *
     * Nothing here touches the network, React or cordis: the caller supplies an
     * `emit` sink and a clock, which is what makes the whole match flow testable
     * from Node without a browser.
     */

    const PROTO = 1;
    const APP_VERSION = '2.0.0';

    /** Room codes avoid 0/O/1/I so they survive being read aloud or typed. */
    const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const CODE_LENGTH = 6;

    const COUNTDOWN_MS = 3000;
    const MAX_PLAYERS = 5;

    const DRILLS = {
      click: { durationMs: 30000, label: 'click' },
      reaction: { rounds: 8, label: 'reaction' },
    };

    const TOPIC_ROOT = 'fakeaim/v1';

    function topicsFor(code) {
      return {
        state: `${TOPIC_ROOT}/room/${code}/state`,
        events: `${TOPIC_ROOT}/room/${code}/ev`,
        commands: `${TOPIC_ROOT}/room/${code}/cmd`,
      };
    }

    function randomCode(random = Math.random) {
      let code = '';
      for (let index = 0; index < CODE_LENGTH; index += 1) {
        code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
      }
      return code;
    }

    /** Relay ids and the single character each contributes to a shared room code. */
    const RELAY_TAGS = { emqx: 'E', hivemq: 'H' };

    function relayTag(brokerId) {
      return RELAY_TAGS[brokerId] || '';
    }

    /**
     * A room only exists on the broker that created it, so the invite has to name
     * that broker: "ABC234-E" is the room "ABC234" on the EMQX relay.
     */
    function formatShareCode(code, brokerId) {
      const tag = relayTag(brokerId);
      return tag ? `${code}-${tag}` : code;
    }

    function isValidCode(text) {
      return text.length === CODE_LENGTH && [...text].every((char) => CODE_ALPHABET.includes(char));
    }

    function relayOf(tag) {
      return Object.keys(RELAY_TAGS).find((brokerId) => RELAY_TAGS[brokerId] === tag) || '';
    }

    /**
     * Splits a typed invite into the room id and, when one is present, its relay.
     * A bare six-character code stays valid and will try every relay in turn.
     *
     * Accepted shapes: "ABC234-E", "abc 234 e", "ABC234E" and any sentence that
     * carries one of them. A trailing relay letter on a five-character body is a
     * truncated share code, not a room, so it is rejected rather than guessed at.
     */
    function parseInvite(input) {
      const parts = String(input ?? '').toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean);
      const joined = parts.join('');
      if (parts.length > 1) {
        const body = parts.slice(0, -1).join('');
        const tag = parts[parts.length - 1];
        if (tag.length === 1 && relayOf(tag)) {
          return isValidCode(body) ? { code: body, relay: relayOf(tag) } : { code: '', relay: '' };
        }
      }
      if (isValidCode(joined)) return { code: joined, relay: '' };
      if (joined.length === CODE_LENGTH + 1) {
        const code = joined.slice(0, CODE_LENGTH);
        const relay = relayOf(joined.slice(CODE_LENGTH));
        return isValidCode(code) && relay ? { code, relay } : { code: '', relay: '' };
      }
      return { code: '', relay: '' };
    }

    /** Accepts "7k3q 9f", "7K3Q-9F", "7K3Q9F-E" or a whole invite sentence. */
    function normalizeCode(input) {
      return parseInvite(input).code;
    }

    function mulberry32(seed) {
      let state = seed >>> 0;
      return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    }

    /**
     * Both players consume this exact sequence, so the "board" is identical and
     * only reaction time differs. Positions are normalised (0..1) arena coordinates.
     */
    function buildTargets(seed, count = 200) {
      const next = mulberry32(seed);
      const targets = [];
      while (targets.length < count) {
        const candidate = {
          x: 0.06 + next() * 0.88,
          y: 0.08 + next() * 0.84,
          r: 0.024 + next() * 0.012,
        };
        const crowded = targets.slice(-4).some((other) => {
          const dx = other.x - candidate.x;
          const dy = other.y - candidate.y;
          return Math.hypot(dx, dy) < 0.13;
        });
        if (!crowded) targets.push(candidate);
      }
      return targets;
    }

    /**
     * samples: [{ t0: localSentAt, t1: hostReceivedAt, t2: localReceivedAt }]
     * Returns the clock offset that converts host time -> local time, using the
     * lowest-RTT sample (least queueing noise).
     */
    function estimateClockOffset(samples) {
      if (!samples.length) return { offset: 0, rtt: 0 };
      let best = null;
      for (const sample of samples) {
        const rtt = sample.t2 - sample.t0;
        if (!best || rtt < best.rtt) {
          best = { rtt, offset: sample.t1 - (sample.t0 + rtt / 2) };
        }
      }
      return { offset: best.offset, rtt: best.rtt };
    }

    const emptyState = (code, hostId) => ({
      type: 'state',
      proto: PROTO,
      app: APP_VERSION,
      code,
      hostId,
      phase: 'lobby',
      mode: 'click',
      rounds: 8,
      participantIds: [],
      seed: 0,
      startAt: 0,
      durationMs: DRILLS.click.durationMs,
      results: {},
      players: [],
    });

    class Room {
      /**
       * @param {object} options
       * @param {'host'|'guest'} options.role
       * @param {string} options.playerId
       * @param {string} options.name
       * @param {(out: {channel: 'state'|'ev'|'cmd', payload: object|null, retain?: boolean}) => void} options.emit
       * @param {() => number} [options.now]
       */
      constructor({ role, playerId, name, emit, now = () => Date.now(), app = APP_VERSION }) {
        this.role = role;
        this.playerId = playerId;
        this.name = name;
        this.app = app;
        this.emit = emit;
        this.now = now;
        this.code = '';
        this.state = emptyState('', '');
        this.results = {};
        this.clock = { offset: 0, rtt: 0 };
        this.pingSamples = [];
        this.pendingPings = new Set();
        this.progress = {};
        this.opponentProgress = null;
        this.joinError = null;
        this.seq = 0;
      }

      get isHost() {
        return this.role === 'host';
      }

      publish(channel, payload, retain = false) {
        this.emit({ channel, payload, retain });
      }

      // ---------------------------------------------------------------- lifecycle

      createRoom(code) {
        this.code = code;
        this.state = emptyState(code, this.playerId);
        this.state.players = [this.playerRecord()];
        this.publishState();
        return code;
      }

      joinRoom(code) {
        this.code = code;
        this.publish('cmd', {
          type: 'join',
          from: this.playerId,
          name: this.name,
          app: this.app,
          v: PROTO,
        });
      }

      playerRecord() {
        return { id: this.playerId, name: this.name, ready: false, app: this.app, online: true };
      }

      publishState() {
        this.state.players = this.state.players.map((player) =>
          player.id === this.playerId ? { ...player, name: this.name, app: this.app } : player,
        );
        this.publish('state', { ...this.state }, true);
      }

      // -------------------------------------------------------------- host actions

      setReady(ready) {
        if (this.state.phase !== 'lobby') return;
        if (this.isHost) {
          const player = this.state.players.find((item) => item.id === this.playerId);
          if (player) player.ready = ready;
          this.publishState();
          return;
        }
        this.publish('cmd', { type: 'ready', from: this.playerId, ready });
      }

      setReactionRounds(rounds) {
        if (!this.isHost || this.state.phase !== 'lobby' || !Number.isInteger(rounds) || rounds < 5 || rounds > 20) return false;
        this.state.rounds = rounds;
        this.publishState();
        return true;
      }

      startMatch(mode = 'click', { rounds = this.state.rounds ?? 8 } = {}) {
        if (!this.isHost || !['lobby', 'finished'].includes(this.state.phase) || !DRILLS[mode]) return false;
        const online = this.state.players.filter((player) => player.online);
        if (online.length < 2 || online.length > MAX_PLAYERS || online.some((player) => !player.ready)) return false;
        if (mode === 'reaction' && (!Number.isInteger(rounds) || rounds < 5 || rounds > 20)) return false;
        const seed = Math.floor(Math.random() * 0x7fffffff);
        const startAt = this.now() + COUNTDOWN_MS;
        // Offline participants remain on the finished scoreboard until the next match.
        this.state.players = online.map((player) => ({ ...player, withdrawn: false }));
        this.state.participantIds = online.map((player) => player.id);
        this.state.phase = 'countdown';
        this.state.mode = mode;
        if (mode === 'reaction') this.state.rounds = rounds;
        this.state.seed = seed;
        this.state.startAt = startAt;
        this.state.durationMs = DRILLS[mode].durationMs ?? 0;
        this.state.matchId = `${this.playerId}:${startAt}:${++this.seq}`;
        this.state.rematchRequested = null;
        this.progress = {};
        this.opponentProgress = null;
        this.state.results = {};
        this.results = {};
        this.publishState();
        this.publish('ev', {
          type: 'start',
          from: this.playerId,
          matchId: this.state.matchId,
          mode,
          seed,
          startAt,
          durationMs: this.state.durationMs,
          rounds: this.state.rounds,
          participantIds: [...this.state.participantIds],
          v: PROTO,
        });
        return true;
      }

      // ------------------------------------------------------------ both sides act

      /** Milliseconds until the drill starts on this machine (negative = late). */
      msUntilStart() {
        if (!this.state.startAt) return null;
        const localStart = this.state.startAt - this.clock.offset;
        return localStart - this.now();
      }

      beginPlay() {
        if (this.state.phase === 'countdown') this.state.phase = 'playing';
      }

      activeParticipant(playerId) {
        return ['countdown', 'playing'].includes(this.state.phase)
          && this.state.participantIds.includes(playerId)
          && this.state.players.some((player) => player.id === playerId && player.online && !player.withdrawn);
      }

      reportProgress({ score, hits = 0, misses = 0, acc = 0, round = 0 }) {
        if (!this.activeParticipant(this.playerId) || this.results[this.playerId]) return;
        const message = {
          type: 'progress',
          from: this.playerId,
          matchId: this.state.matchId,
          score,
          hits,
          misses,
          acc,
          round,
          v: PROTO,
        };
        this.progress[this.playerId] = message;
        this.publish('ev', message);
      }

      finish(result) {
        if (!this.activeParticipant(this.playerId) || this.results[this.playerId]) return;
        this.recordResult(this.playerId, result);
        this.publish('ev', { type: 'finish', from: this.playerId, matchId: this.state.matchId, result, v: PROTO });
      }

      rematch() {
        if (this.state.phase !== 'finished') return;
        if (this.isHost) {
          this.startMatch(this.state.mode);
          return;
        }
        this.publish('cmd', { type: 'rematch', from: this.playerId, matchId: this.state.matchId });
      }

      returnToLobby() {
        if (this.state.phase !== 'finished') return;
        if (!this.isHost) {
          this.publish('cmd', { type: 'lobby', from: this.playerId, matchId: this.state.matchId });
          return;
        }
        this.state.phase = 'lobby';
        this.state.startAt = 0;
        this.state.matchId = null;
        this.state.rematchRequested = null;
        this.state.players = this.state.players.filter((player) => player.online).map((player) => ({ ...player, ready: false }));
        this.state.participantIds = [];
        this.state.results = {};
        this.results = {};
        this.progress = {};
        this.opponentProgress = null;
        this.publishState();
      }

      leave() {
        this.publish('ev', { type: 'leave', from: this.playerId, v: PROTO });
        if (this.isHost) {
          // Retained state must be cleared or the code looks alive forever on a public broker.
          this.publish('state', null, true);
        }
      }

      // -------------------------------------------------------------- clock sync

      sendPing() {
        const t0 = this.now();
        this.pendingPings.add(t0);
        if (this.pendingPings.size > 20) this.pendingPings.delete(this.pendingPings.values().next().value);
        this.publish('cmd', { type: 'ping', from: this.playerId, t0, v: PROTO });
      }

      handlePong({ t0, t1 }) {
        if (!this.pendingPings.delete(t0) || !Number.isFinite(t1)) return this.clock;
        const t2 = this.now();
        this.pingSamples.push({ t0, t1, t2 });
        if (this.pingSamples.length > 20) this.pingSamples.shift();
        this.clock = estimateClockOffset(this.pingSamples);
        return this.clock;
      }

      // ------------------------------------------------------------------ inbound

      /** @returns {string} a short description of what happened, for tests/logs */
      handle(channel, payload) {
        if (!payload || typeof payload !== 'object') return 'empty';
        if (channel === 'state') return this.handleState(payload);
        if (payload.v !== undefined && payload.v !== PROTO) return 'proto-mismatch';
        if (payload.from === this.playerId && channel !== 'cmd') return 'self';
        if (channel === 'ev') return this.handleEvent(payload);
        if (channel === 'cmd') return this.handleCommand(payload);
        return 'ignored';
      }

      handleState(next) {
        if (next.code !== this.code) return 'wrong-room';
        if (next.proto !== PROTO) return 'proto-mismatch';
        // The host owns the state. Its MQTT subscription echoes older snapshots.
        if (this.isHost) return 'self-state';
        const previousPhase = this.state.phase;
        const sameMatch = Boolean(next.matchId && next.matchId === this.state.matchId);
        const localResult = sameMatch ? this.results[this.playerId] : null;
        if (!sameMatch) {
          this.opponentProgress = null;
          this.progress = {};
        }
        this.state = {
          ...this.state,
          ...next,
          players: next.players.map((player) => ({ ...player })),
          results: { ...next.results },
        };
        if (localResult && !this.state.results[this.playerId]) this.state.results[this.playerId] = localResult;
        this.results = { ...this.state.results };
        if (this.role === 'guest' && previousPhase !== next.phase) {
          return `phase:${next.phase}`;
        }
        return 'state';
      }

      handleEvent(message) {
        if (message.type === 'join-rejected') {
          if (this.isHost || message.to !== this.playerId) return 'not-addressed';
          this.joinError = message.reason;
          return message.reason;
        }
        if (message.type === 'start') {
          if (this.isHost || message.from !== this.state.hostId) return 'ignored-start';
          if (this.state.matchId === message.matchId) return 'same-match';
          this.state.matchId = message.matchId;
          this.state.results = {};
          this.results = {};
          this.progress = {};
          this.opponentProgress = null;
          this.state.participantIds = message.participantIds ?? this.state.players.filter((player) => player.online).map((player) => player.id);
          this.state.phase = 'countdown';
          this.state.mode = message.mode;
          this.state.seed = message.seed;
          this.state.startAt = message.startAt;
          this.state.durationMs = message.durationMs;
          this.state.rounds = message.rounds;
          return 'start';
        }
        if (message.type === 'progress' || message.type === 'finish') {
          if (!this.state.matchId || message.matchId !== this.state.matchId) return 'old-match';
          if (!this.state.participantIds.includes(message.from)) return 'unknown-player';
          if (!this.activeParticipant(message.from)) return 'inactive-player';
        }
        if (message.type === 'progress') {
          if (!this.results[message.from]) {
            this.progress[message.from] = message;
            this.opponentProgress = message;
          }
          return 'progress';
        }
        if (message.type === 'finish') {
          if (this.isHost && !this.results[message.from]) this.recordResult(message.from, message.result);
          return 'finish';
        }
        if (message.type === 'pong') {
          if (this.isHost || message.to !== this.playerId || message.from !== this.state.hostId) return 'not-addressed';
          this.handlePong({ t0: message.t0, t1: message.t1 });
          return 'pong';
        }
        if (message.type === 'leave') {
          const player = this.state.players.find((item) => item.id === message.from);
          if (!player) return 'unknown-player';
          if (this.state.phase === 'lobby' && message.from !== this.state.hostId) {
            this.state.players = this.state.players.filter((item) => item.id !== message.from);
          } else {
            player.online = false;
            player.ready = false;
            player.withdrawn = true;
            if (this.isHost && this.state.participantIds.includes(message.from) && !this.results[message.from]) {
              this.recordResult(message.from, { score: 0, dnf: true, withdrawn: true });
            }
          }
          delete this.progress[message.from];
          if (this.isHost) this.publishState();
          return 'leave';
        }
        return 'event';
      }

      handleCommand(message) {
        if (!this.isHost) {
          if (message.type === 'pong') return this.handleEvent({ type: 'pong', ...message });
          return 'not-host';
        }
        if (message.type === 'join') {
          const reject = (reason) => {
            this.publish('ev', { type: 'join-rejected', from: this.playerId, to: message.from, reason, v: PROTO });
            return reason;
          };
          if (message.app !== this.app) return reject('app-mismatch');
          if (this.state.phase !== 'lobby') return reject('match-in-progress');
          const exists = this.state.players.some((player) => player.id === message.from);
          if (!exists) {
            if (this.state.players.length >= MAX_PLAYERS) return reject('room-full');
            this.state.players.push({
              id: message.from,
              name: message.name || 'player',
              ready: false,
              app: message.app,
              online: true,
            });
          }
          this.publishState();
          return 'join';
        }
        if (message.type === 'ready') {
          if (this.state.phase !== 'lobby') return 'not-lobby';
          const player = this.state.players.find((item) => item.id === message.from && item.online);
          if (!player) return 'unknown-player';
          player.ready = message.ready === true;
          this.publishState();
          return 'ready';
        }
        if (message.type === 'ping') {
          if (!this.state.players.some((player) => player.id === message.from && player.online)) return 'unknown-player';
          this.publish('ev', { type: 'pong', from: this.playerId, to: message.from, t0: message.t0, t1: this.now(), v: PROTO });
          return 'ping';
        }
        if (message.type === 'rematch' || message.type === 'lobby') {
          if (this.state.phase !== 'finished' || message.matchId !== this.state.matchId) return 'old-match';
          if (!this.state.players.some((player) => player.id === message.from && player.online && !player.withdrawn)) return 'unknown-player';
          if (message.type === 'lobby') this.returnToLobby();
          else {
            this.state.rematchRequested = message.from;
            this.publishState();
          }
          return message.type;
        }
        return 'command';
      }

      recordResult(playerId, result) {
        if (!result || typeof result !== 'object') return;
        this.results[playerId] = result;
        this.state.results = { ...this.results };
        const everyoneDone = this.state.participantIds.length > 0 && this.state.participantIds.every((id) => this.results[id]);
        if (this.isHost && everyoneDone) this.state.phase = 'finished';
        if (this.isHost) this.publishState();
      }
    }
    // ---- net/link.js ----

    /**
     * Broker choices, in reachability order. Both are public test brokers: they give
     * us a relay without running a server, but they carry no SLA and every topic is
     * world-readable, so only scores and names travel through them.
     */
    const BROKERS = [
      { id: 'emqx', label: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
      { id: 'hivemq', label: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
    ];

    /** How long a host listens for a retained snapshot before it trusts a code. */
    const PROBE_MS = 450;
    const CODE_ATTEMPTS = 6;
    const PING_EVERY_MS = 2500;

    function newPlayerId() {
      return Math.random().toString(36).slice(2, 10);
    }

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function withTimeout(promise, ms) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('connect-timeout')), ms);
        promise.then(
          (value) => { clearTimeout(timer); resolve(value); },
          (error) => { clearTimeout(timer); reject(error); },
        );
      });
    }

    /**
     * Connect to the first reachable broker and wire one room onto it.
     *
     * @param {object} options
     * @param {'host'|'guest'} options.role
     * @param {string} [options.code] wanted code for a guest, optional hint for a host
     * @param {string} options.name
     * @param {string} options.playerId
     * @param {Array<{id: string, label: string, url: string}>} [options.brokers]
     * @param {(status: {phase: string, broker?: string}) => void} [options.onStatus]
     * @param {() => void} [options.onUpdate]
     * @param {number} [options.timeoutMs]
     */
    async function openRoom(options) {
      const {
        role, name, playerId, code: wanted, brokers = BROKERS,
        onStatus = () => {}, onUpdate = () => {}, timeoutMs = 9000,
      } = options;

      if (!globalThis.WebSocket) throw new Error('websocket-unavailable');

      // A tagged invite ("ABC234-E") names the relay that hosts the room; a bare
      // six-character code tries every relay in turn, which is what older invites did.
      const invite = parseInvite(wanted);
      if (role === 'guest' && !invite.code) throw new Error('bad-code');
      const candidates = invite.relay ? brokers.filter((broker) => broker.id === invite.relay) : brokers;
      if (!candidates.length) throw new Error('unknown-relay');
      const pinned = Boolean(invite.relay);

      let lastError = null;

      for (const broker of candidates) {
        onStatus({ phase: 'connecting', broker: broker.label });

        const client = new MqttClient({
          url: broker.url,
          clientId: `aimtrainer-${playerId}-${Math.random().toString(36).slice(2, 7)}`,
          keepalive: 30,
          autoReconnect: false,
        });

        try {
          await withTimeout(client.connect(), timeoutMs);
        } catch (error) {
          lastError = error;
          try { client.close(); } catch (_) { /* already down */ }
          continue;
        }

        onStatus({ phase: 'online', broker: broker.label });

        let code = '';
        let room = null;
        let closed = false;
        let probed = false;
        let pinged = 0;
        let pingTimer = 0;
        let initialState = null;
        let resolveAdmission;
        let rejectAdmission;
        const admission = new Promise((resolve, reject) => { resolveAdmission = resolve; rejectAdmission = reject; });
        // Host connections never wait on admission.
        admission.catch(() => {});

        const publishOut = ({ channel, payload, retain }) => {
          if (!code || closed) return;
          const topics = topicsFor(code);
          const topic = channel === 'state' ? topics.state : channel === 'ev' ? topics.events : topics.commands;
          const body = payload === null ? '' : JSON.stringify(payload);
          client.publish(topic, body, { retain: retain === true });
        };

        client.on('message', ({ topic, payload }) => {
          const topics = topicsFor(code);
          const channel = topic === topics.state ? 'state'
            : topic === topics.events ? 'ev'
              : topic === topics.commands ? 'cmd' : '';
          if (!channel) return;
          let parsed = null;
          try {
            parsed = payload ? JSON.parse(payload) : null;
          } catch (_) {
            return;
          }
          if (channel === 'state' && parsed && parsed.code === code) {
            probed = true;
            initialState = parsed;
          }
          if (!room) return;
          room.handle(channel, parsed);
          if (room.joinError) rejectAdmission(new Error(room.joinError));
          if (channel === 'state' && room.state.players.some((player) => player.id === playerId && player.online)) resolveAdmission();
          onUpdate();
        });

        client.on('close', () => {
          clearInterval(pingTimer);
          if (!closed) onStatus({ phase: 'offline', broker: broker.label });
        });

        const subscribe = (target) => {
          const topics = topicsFor(target);
          client.subscribe(topics.state);
          client.subscribe(topics.events);
          client.subscribe(topics.commands);
        };

        // Host: only trust a code that has no retained snapshot behind it, otherwise a
        // stranger's dead room would capture players who type the same six characters.
        if (role === 'host') {
          let candidate = invite.code;
          for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
            if (!candidate) candidate = randomCode();
            probed = false;
            code = candidate;
            subscribe(candidate);
            await wait(PROBE_MS);
            if (!probed) break;
            candidate = '';
            code = '';
          }
          if (!code) {
            closed = true;
            try { client.close(); } catch (_) { /* ignore */ }
            lastError = new Error('room-code-unavailable');
            continue;
          }
        } else {
          code = invite.code;
          subscribe(code);
          await wait(PROBE_MS);
        }

        room = new Room({ role, playerId, name, emit: publishOut, ...(options.app ? { app: options.app } : {}) });

        if (role === 'host') room.createRoom(code);
        else {
          room.code = code;
          if (initialState && initialState.app !== room.app) {
            closed = true;
            try { client.close(); } catch (_) { /* already down */ }
            onStatus({ phase: 'error', broker: broker.label, reason: 'app-mismatch' });
            throw new Error('app-mismatch');
          }
          if (initialState) room.handle('state', initialState);
          room.joinRoom(code);
          try {
            await withTimeout(admission, timeoutMs);
          } catch (error) {
            closed = true;
            try { client.close(); } catch (_) { /* already down */ }
            if (['room-full', 'match-in-progress', 'app-mismatch'].includes(error.message)) {
              onStatus({ phase: 'error', broker: broker.label, reason: error.message });
              throw error;
            }
            lastError = error.message === 'connect-timeout' ? new Error('room-not-found') : error;
            continue;
          }
        }

        if (role === 'guest') {
          // The offset estimate needs a few samples; ping fast at first, then relax.
          pingTimer = setInterval(() => {
            if (closed) return;
            room.sendPing();
            pinged += 1;
            if (pinged > 4 && pingTimer) {
              clearInterval(pingTimer);
              pingTimer = setInterval(() => { if (!closed) room.sendPing(); }, 20000);
            }
          }, PING_EVERY_MS);
        }

        onUpdate();

        return {
          room,
          code,
          shareCode: formatShareCode(code, broker.id),
          broker: broker.label,
          close() {
            if (closed) return;
            clearInterval(pingTimer);
            try { room.leave(); } catch (_) { /* nothing to tell */ }
            closed = true;
            setTimeout(() => { try { client.close(); } catch (_) { /* gone */ } }, 80);
          },
        };
      }

      // With a tagged invite we never silently try another relay: either that relay
      // is unreachable, or it is reachable and no such room is hosted there.
      if (pinned && lastError && lastError.message !== 'room-not-found') throw new Error('relay-unreachable');
      throw lastError || new Error('no-broker');
    }

    // ---- net/../src/updates.js ----
    // Public repository metadata only. No profile writes or automatic installation.
    const UPDATE_REPO = 'cx-xx-xc/fake_aim';
    const UPDATE_PACKAGE = '@local/aim-trainer';

    function compareVersions(left, right) {
      const parse = (value) => {
        if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Invalid version');
        const parts = value.split('.').map(Number);
        if (!parts.every(Number.isSafeInteger)) throw new Error('Invalid version');
        return parts;
      };
      const a = parse(left), b = parse(right);
      for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
      return 0;
    }

    async function checkForUpdates(currentVersion, { fetcher = globalThis.fetch, signal } = {}) {
      const get = async (url, headers = {}) => {
        const response = await fetcher(url, { signal, cache: 'no-store', credentials: 'omit', headers });
        if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
        return response.json();
      };
      // Read the manifest at the exact commit checked, so the offered installation
      // cannot drift to another version while the user reads the result.
      const commit = await get(`https://api.github.com/repos/${UPDATE_REPO}/commits/main`);
      if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid GitHub commit');
      const manifest = await get(`https://api.github.com/repos/${UPDATE_REPO}/contents/package.json?ref=${commit.sha}`, { Accept: 'application/vnd.github.raw+json' });
      if (manifest.name !== UPDATE_PACKAGE || !manifest.dsh?.bundle?.patch) throw new Error('Invalid plugin manifest');
      const difference = compareVersions(manifest.version, currentVersion);
      return {
        status: difference > 0 ? 'available' : difference < 0 ? 'ahead' : 'current',
        version: manifest.version,
        spec: `github:${UPDATE_REPO}#${commit.sha}`,
        url: `https://github.com/${UPDATE_REPO}/commit/${commit.sha}`,
      };
    }

    // ---- net/../src/ghost.js ----
    const GHOST_KEY = 'aim-trainer:ghost:click:v1';
    const GHOST_ENABLED_KEY = 'aim-trainer:ghost:enabled:v1';

    function validGhost(value, durationMs) {
      return value?.version === 1 && value.durationMs === durationMs
        && Array.isArray(value.hits) && value.hits.length > 0 && value.hits.length <= 10000
        && value.hits.every((time, index) => Number.isFinite(time) && time >= 0
          && time < durationMs && (index === 0 || time >= value.hits[index - 1]));
    }

    function readGhost(storage, durationMs) {
      try {
        const value = JSON.parse(storage.getItem(GHOST_KEY));
        return validGhost(value, durationMs) ? value : null;
      } catch { return null; }
    }

    // Only completed runs call this. Tied or lower scores preserve the existing replay.
    function saveGhost(storage, hits, durationMs) {
      const candidate = { version: 1, durationMs, hits: [...hits] };
      if (!validGhost(candidate, durationMs)) return false;
      const previous = readGhost(storage, durationMs);
      if (previous && previous.hits.length >= hits.length) return false;
      try { storage.setItem(GHOST_KEY, JSON.stringify(candidate)); return true; }
      catch { return false; }
    }

    function ghostScoreAt(ghost, elapsedMs) {
      if (!ghost || !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
      let low = 0;
      let high = ghost.hits.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (ghost.hits[middle] <= elapsedMs) low = middle + 1;
        else high = middle;
      }
      return low;
    }

    // ---- net/../src/feel.js ----
    // Self-contained presentation layer; this module never changes drill scores or hitboxes.
    const FEEL_KEY = 'aim-trainer:feel:v1';
    const FEEL_DEFAULTS = Object.freeze({ sound: false, crosshair: 'cross', gun: true, effects: true });

    function validateFeelConfig(value) {
      const source = value && typeof value === 'object' ? value : {};
      return {
        sound: typeof source.sound === 'boolean' ? source.sound : false,
        crosshair: ['cross', 'dot', 'ring'].includes(source.crosshair) ? source.crosshair : 'cross',
        gun: typeof source.gun === 'boolean' ? source.gun : true,
        effects: typeof source.effects === 'boolean' ? source.effects : true,
      };
    }

    function readFeelConfig(storage) {
      try { return validateFeelConfig(JSON.parse(storage.getItem(FEEL_KEY))); }
      catch { return { ...FEEL_DEFAULTS }; }
    }

    function saveFeelConfig(storage, value) {
      try { storage.setItem(FEEL_KEY, JSON.stringify(validateFeelConfig(value))); return true; }
      catch { return false; }
    }

    // Border widths are excluded so the rendered reticle agrees with the native cursor.
    function feelPoint(clientX, clientY, rect, borderX = 0, borderY = 0) {
      const width = Math.max(0, Number(rect.width) - borderX * 2) || 0;
      const height = Math.max(0, Number(rect.height) - borderY * 2) || 0;
      const x = Number.isFinite(clientX) ? Math.max(0, Math.min(width, clientX - rect.left - borderX)) : width / 2;
      const y = Number.isFinite(clientY) ? Math.max(0, Math.min(height, clientY - rect.top - borderY)) : height / 2;
      return { x, y, swayX: width ? (x / width - .5) * 12 : 0, swayY: height ? (y / height - .5) * 7 : 0 };
    }

    const FEEL_CSS = `
    .at-feel-arena { isolation:isolate; }
    .at-feel-arena .at-target { z-index:2; }
    .at-feel-arena .at-count,.at-feel-arena .at-flag { z-index:6; }
    .at-feel-arena.at-feel-active,.at-feel-arena.at-feel-active .at-target { cursor:none; }
    .at-feel-layer { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; }
    .at-feel-layer *,.at-feel-depth,.at-feel-gun { pointer-events:none; }
    .at-feel-depth { position:absolute; inset:55% -30% -20%; z-index:0; opacity:.25; transform:perspective(180px) rotateX(52deg); transform-origin:center top; background-image:linear-gradient(#1f5660 1px,transparent 1px),linear-gradient(90deg,#1f5660 1px,transparent 1px); background-size:42px 38px; }
    .at-feel-reticle { position:absolute; width:22px; height:22px; transform:translate(-50%,-50%); filter:drop-shadow(0 1px 1px #000); color:#d6fff7; }
    .at-feel-reticle.cross::before,.at-feel-reticle.cross::after { content:''; position:absolute; background:currentColor; }
    .at-feel-reticle.cross::before { left:10px; top:1px; width:2px; height:20px; }
    .at-feel-reticle.cross::after { top:10px; left:1px; height:2px; width:20px; }
    .at-feel-reticle.dot { width:5px; height:5px; border-radius:50%; background:#d6fff7; box-shadow:0 0 0 1px #071519; }
    .at-feel-reticle.ring { width:18px; height:18px; box-sizing:border-box; border:2px solid currentColor; border-radius:50%; }
    .at-feel-gun { position:absolute; right:4%; bottom:-9px; width:clamp(120px,30%,180px); z-index:1; opacity:.7; transform-origin:80% 100%; }
    .at-feel-gun svg { display:block; width:100%; height:auto; overflow:visible; }
    .at-feel-recoil { animation:at-feel-kick .16s ease-out; transform-origin:80% 100%; }
    .at-feel-flash { fill:#fff5c5; stroke:#ffba59; stroke-width:3; }
    .at-feel-impact { position:absolute; width:22px; height:22px; margin:-11px; border:2px solid #c8fff0; border-radius:50%; box-sizing:border-box; animation:at-feel-impact .4s ease-out forwards; }
    .at-feel-particle { position:absolute; width:3px; height:3px; border-radius:50%; background:#a8ffe4; animation:at-feel-spark .4s ease-out forwards; }
    .at-feel-plus { position:absolute; margin:-27px 0 0 10px; color:#b4ffe4; font:800 14px/1 sans-serif; text-shadow:0 1px 3px #000; animation:at-feel-score .45s ease-out forwards; }
    .at-feel-controls { display:flex; flex-shrink:0; align-items:center; flex-wrap:wrap; gap:8px 14px; padding:9px 14px; color:var(--dsw-alias-label-secondary); font-family:inherit; font-size:11px; line-height:1.4; }
    .at-feel-controls label { display:inline-flex; gap:5px; align-items:center; cursor:pointer; }
    .at-feel-controls input { accent-color:#00e5c0; margin:0; }
    .at-feel-controls select { min-height:28px; max-width:130px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; }
    .at-feel-controls :focus-visible { outline:2px solid #00e5c0; outline-offset:3px; }
    @keyframes at-feel-kick { 0% { transform:translate(4px,9px) rotate(5deg); } 100% { transform:none; } }
    @keyframes at-feel-impact { to { transform:scale(1.9); opacity:0; } }
    @keyframes at-feel-spark { to { transform:translate(var(--fx),var(--fy)); opacity:0; } }
    @keyframes at-feel-score { to { transform:translateY(-24px); opacity:0; } }
    @media (prefers-reduced-motion:reduce) {
     .at-feel-recoil { animation:none; }
     .at-feel-impact,.at-feel-particle { display:none; }
     .at-feel-plus { animation:none; }
     .at-feel-gun { transform:none !important; }
    }
    `;

    function createFeel(React) {
      const fh = React.createElement;
      const listeners = new Set();
      let settings;
      function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
      function current() { if (!settings) settings = readFeelConfig(storage()); return settings; }
      function update(patch) {
        settings = validateFeelConfig({ ...current(), ...patch });
        saveFeelConfig(storage(), settings);
        for (const notify of listeners) notify(settings);
      }
      function useFeel() {
        const [value, setValue] = React.useState(current);
        React.useEffect(() => {
          listeners.add(setValue);
          setValue(current());
          return () => { listeners.delete(setValue); };
        }, []);
        return value;
      }

      function FeelControls({ t }) {
        const config = useFeel();
        const toggle = (key, label) => fh('label', { key },
          fh('input', { type: 'checkbox', checked: config[key], onChange: (e) => update({ [key]: e.target.checked }) }), t(label));
        return fh('div', { className: 'at-feel-controls' },
          toggle('sound', 'feelSound'),
          fh('label', null, t('feelCrosshair'),
            fh('select', { value: config.crosshair, onChange: (e) => update({ crosshair: e.target.value }) },
              ...[['cross', 'feelCross'], ['dot', 'feelDot'], ['ring', 'feelRing']].map(([value, key]) => fh('option', { key: value, value }, t(key))))),
          toggle('gun', 'feelGun'), toggle('effects', 'feelEffects'));
      }

      function Arena({ active = false, t, divRef, children, className = '', onPointerMove, onPointerLeave, onPointerUp, onPointerCancel, onPointerDownCapture, ...props }) {
        const config = useFeel();
        const [pointer, setPointer] = React.useState(null);
        const [impacts, setImpacts] = React.useState([]);
        const [shot, setShot] = React.useState(0);
        const [flash, setFlash] = React.useState(false);
        const seq = React.useRef(0);
        const flashTimer = React.useRef(null);
        const sound = React.useRef(null);
        const lastSound = React.useRef(0);
        React.useEffect(() => {
          if (!impacts.length) return undefined;
          const timer = setTimeout(() => setImpacts([]), 460);
          return () => clearTimeout(timer);
        }, [impacts]);
        React.useEffect(() => {
          if (!active) { setPointer(null); setImpacts([]); setFlash(false); clearTimeout(flashTimer.current); }
        }, [active]);
        React.useEffect(() => () => {
          clearTimeout(flashTimer.current);
          if (sound.current) { try { sound.current.close()?.catch(() => {}); } catch { /* browser already closed */ } }
        }, []);

        function point(event) {
          const node = event.currentTarget;
          return feelPoint(event.clientX, event.clientY, node.getBoundingClientRect(), node.clientLeft || 0, node.clientTop || 0);
        }
        // Only invoked synchronously from pointer-down; no autoplay or network audio.
        function play(hit, event) {
          if (!config.sound || event.nativeEvent?.isTrusted === false || event.isTrusted === false) return;
          const now = Date.now();
          if (now - lastSound.current < 35) return;
          lastSound.current = now;
          try {
            const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!Audio) return;
            if (!sound.current || sound.current.state === 'closed') sound.current = new Audio();
            const context = sound.current;
            if (context.state === 'suspended') context.resume()?.catch(() => {});
            const start = context.currentTime;
            function tone(type, from, to, gain, delay, duration) {
              const osc = context.createOscillator();
              const envelope = context.createGain();
              osc.type = type;
              osc.frequency.setValueAtTime(from, start + delay);
              osc.frequency.exponentialRampToValueAtTime(to, start + delay + duration);
              envelope.gain.setValueAtTime(gain, start + delay);
              envelope.gain.exponentialRampToValueAtTime(.0001, start + delay + duration);
              osc.connect(envelope); envelope.connect(context.destination);
              osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
              osc.start(start + delay); osc.stop(start + delay + duration);
            }
            tone('triangle', 170, 45, .09, 0, .1);
            tone('sawtooth', 900, 110, .025, 0, .045);
            if (hit) tone('sine', 1100, 1800, .045, .025, .11);
          } catch { /* Audio unavailable: visuals and scoring still work. */ }
        }
        function capture(event) {
          if (active && (event.button === undefined || event.button === 0)) {
            const p = point(event);
            setPointer(p);
            const target = event.target?.closest?.('.at-target');
            const hit = !!target && event.currentTarget.contains(target);
            play(hit, event);
            if (config.gun) {
              setShot(++seq.current); setFlash(true);
              clearTimeout(flashTimer.current);
              flashTimer.current = setTimeout(() => setFlash(false), 70);
            }
            if (config.effects && hit) {
              const id = ++seq.current;
              setImpacts((items) => [...items.slice(-5), { ...p, id }]);
            }
          }
          if (onPointerDownCapture) onPointerDownCapture(event);
        }
        function gun() {
          // Original vector pistol design, drawn here; no downloaded models or assets.
          return fh('div', { className: 'at-feel-gun', 'aria-hidden': true, style: { transform: `translate(${pointer?.swayX || 0}px,${pointer?.swayY || 0}px)` } },
            fh('div', { key: shot, className: shot ? 'at-feel-recoil' : '' },
              fh('svg', { viewBox: '0 0 200 165', focusable: 'false' },
                fh('path', { d: 'M116 83 L166 92 L190 165 L134 165 L108 112 Z', fill: '#111d29', stroke: '#506674', strokeWidth: 3 }),
                fh('path', { d: 'M49 56 L128 36 L165 55 L162 88 L103 108 L64 91 Z', fill: '#263947', stroke: '#7d97a1', strokeWidth: 3 }),
                fh('path', { d: 'M46 53 L127 33 L155 44 L78 69 L46 66 Z', fill: '#45616c', stroke: '#8ba4ae', strokeWidth: 2 }),
                fh('path', { d: 'M49 53 L72 62 L73 77 L49 68 Z', fill: '#07121a', stroke: '#a2b9be', strokeWidth: 2 }),
                fh('path', { d: 'M84 74 L141 55 M116 121 L155 136 M121 134 L161 149', stroke: '#00e5c0', strokeWidth: 3, opacity: .8 }),
                fh('path', { d: 'M88 101 Q78 122 111 124 L126 111', fill: 'none', stroke: '#5b7480', strokeWidth: 5 }),
                fh('path', { d: 'M117 32 L121 22 L132 25 L133 32', fill: '#13212c', stroke: '#00e5c0', strokeWidth: 2 }),
                flash && fh('path', { className: 'at-feel-flash', d: 'M48 57 L24 37 L29 53 L7 55 L29 65 L20 79 L49 66 Z' }))));
        }
        return fh('div', {
          ...props, ref: divRef, className: `${className} at-feel-arena${active && pointer ? ' at-feel-active' : ''}`,
          onPointerDownCapture: capture,
          onPointerMove: (event) => { if (active) setPointer(point(event)); if (onPointerMove) onPointerMove(event); },
          onPointerLeave: (event) => { setPointer(null); if (onPointerLeave) onPointerLeave(event); },
          onPointerUp: (event) => { if (event.pointerType === 'touch') setPointer(null); if (onPointerUp) onPointerUp(event); },
          onPointerCancel: (event) => { setPointer(null); if (onPointerCancel) onPointerCancel(event); },
        }, children,
        active && fh('div', { className: 'at-feel-depth', 'aria-hidden': true }),
        active && config.gun && gun(),
        active && fh('div', { className: 'at-feel-layer', 'aria-hidden': true },
          pointer && fh('span', { className: `at-feel-reticle ${config.crosshair}`, style: { left: pointer.x, top: pointer.y } }),
          config.effects && impacts.map((item) => fh('div', { key: item.id },
            fh('span', { className: 'at-feel-impact', style: { left: item.x, top: item.y } }),
            fh('span', { className: 'at-feel-plus', style: { left: item.x, top: item.y } }, '+1'),
            ...Array.from({ length: 6 }, (_, i) => fh('span', { key: i, className: 'at-feel-particle', style: {
              left: item.x, top: item.y, '--fx': `${Math.cos(i * Math.PI / 3) * 30}px`, '--fy': `${Math.sin(i * Math.PI / 3) * 30}px`,
            } }))))));
      }
      return { Arena, FeelControls };
    }

    // ---- net/../src/scene3d.js ----
    // Small, dependency-free WebGL range. Camera position is always the world origin.
    const SCENE_DEG = Math.PI / 180;
    const SCENE_PITCH_LIMIT = 85 * SCENE_DEG;
    const SCENE_FLOOR_Y = -4.6;
    const sceneFinite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
    const sceneClamp = (value, low, high) => Math.min(high, Math.max(low, value));
    const sceneAngle = (value) => sceneFinite(value) % (Math.PI * 2);

    function sceneDirection(yaw = 0, pitch = 0) {
      yaw = sceneAngle(yaw);
      pitch = sceneClamp(sceneFinite(pitch), -SCENE_PITCH_LIMIT, SCENE_PITCH_LIMIT);
      const horizontal = Math.cos(pitch);
      return [Math.sin(yaw) * horizontal, Math.sin(pitch), -Math.cos(yaw) * horizontal];
    }

    function rotateLook(camera, dx, dy, sensitivity = 0.16) {
      const speed = Number.isFinite(sensitivity) && sensitivity >= 0 ? sensitivity : 0.16;
      const yawDelta = sceneFinite(sceneFinite(dx) * speed * SCENE_DEG);
      const pitchDelta = sceneFinite(sceneFinite(dy) * speed * SCENE_DEG);
      return {
        yaw: sceneAngle(sceneAngle(camera?.yaw) + sceneAngle(yawDelta)),
        pitch: sceneClamp(sceneFinite(camera?.pitch) - pitchDelta, -SCENE_PITCH_LIMIT, SCENE_PITCH_LIMIT),
      };
    }

    function sceneTarget(point, id) {
      const x = sceneClamp(sceneFinite(point?.x, 0.5), 0, 1);
      const y = sceneClamp(sceneFinite(point?.y, 0.5), 0, 1);
      const radius = Number.isFinite(point?.r) && point.r > 0 && Number.isFinite(point.r * 20) ? point.r * 20 : 0.48;
      return { id, x: (x - 0.5) * 14, y: (0.5 - y) * 8, z: -12, radius };
    }

    function sceneValidTarget(target) {
      return target && Number.isFinite(target.x) && Number.isFinite(target.y)
        && Number.isFinite(target.z) && Number.isFinite(target.radius) && target.radius > 0;
    }

    function aimTarget(camera, targets) {
      const direction = sceneDirection(camera?.yaw, camera?.pitch);
      let nearest = Infinity;
      let selected = null;
      for (const target of Array.isArray(targets) ? targets : []) {
        if (!sceneValidTarget(target)) continue;
        const along = target.x * direction[0] + target.y * direction[1] + target.z * direction[2];
        const distanceSquared = target.x ** 2 + target.y ** 2 + target.z ** 2;
        const discriminant = target.radius ** 2 - (distanceSquared - along ** 2);
        if (discriminant < 0 || !Number.isFinite(discriminant)) continue;
        const root = Math.sqrt(discriminant);
        if (along + root < 0) continue;
        const distance = Math.max(0, along - root);
        if (distance < nearest) {
          nearest = distance;
          selected = target;
        }
      }
      return selected;
    }

    // Column-major matrices, matching GLSL. Positive yaw turns the camera right.
    function sceneIdentity() {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }

    function sceneMultiply(a, b) {
      const out = new Float32Array(16);
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
          for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
        }
      }
      return out;
    }

    function sceneModel(position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
      const [x, y, z] = rotation;
      const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
      return new Float32Array([
        cz * cy * scale[0], sz * cy * scale[0], -sy * scale[0], 0,
        (cz * sy * sx - sz * cx) * scale[1], (sz * sy * sx + cz * cx) * scale[1], cy * sx * scale[1], 0,
        (cz * sy * cx + sz * sx) * scale[2], (sz * sy * cx - cz * sx) * scale[2], cy * cx * scale[2], 0,
        ...position, 1,
      ]);
    }

    function sceneView(yaw, pitch) {
      const forward = sceneDirection(yaw, pitch);
      const right = [Math.cos(sceneAngle(yaw)), 0, Math.sin(sceneAngle(yaw))];
      const up = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
      ];
      return new Float32Array([
        right[0], up[0], -forward[0], 0,
        right[1], up[1], -forward[1], 0,
        right[2], up[2], -forward[2], 0,
        0, 0, 0, 1,
      ]);
    }

    function scenePerspective(fov, aspect) {
      const f = 1 / Math.tan(fov * SCENE_DEG / 2);
      const near = 0.035, far = 90;
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
    }

    const SCENE_VERTEX = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform mat3 uNormal;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vDistance;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vec4 eye = uView * world;
      vWorld = world.xyz;
      vNormal = normalize(uNormal * aNormal);
      vDistance = length(eye.xyz);
      gl_Position = uProjection * eye;
    }`;

    const SCENE_FRAGMENT = `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uEye;
    uniform float uGrid;
    uniform float uGloss;
    uniform float uEmission;
    uniform float uFog;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vDistance;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 light = normalize(vec3(-0.45, 0.85, 0.4));
      vec3 view = normalize(uEye - vWorld);
      float diffuse = max(dot(normal, light), 0.0);
      float specular = pow(max(dot(normal, normalize(light + view)), 0.0), 48.0) * uGloss;
      vec3 color = uColor * (0.62 + diffuse * 0.4 + normal.y * 0.035);
      color += vec3(0.84, 0.91, 0.94) * specular;
      if (uGrid > 0.0) {
        vec3 n = abs(normal);
        vec2 coordinate = n.y > 0.5 ? vWorld.xz : (n.x > 0.5 ? vWorld.zy : vWorld.xy);
        vec2 edge = abs(fract(coordinate * 0.5 + 0.5) - 0.5);
        float width = 0.005 + min(vDistance, 35.0) * 0.0005;
        float line = 1.0 - smoothstep(width, width * 2.2, min(edge.x, edge.y));
        color *= 1.0 - line * 0.16 * uGrid;
      }
      float rim = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
      color += uColor * rim * uGloss * 0.12;
      color = mix(color, uColor, min(uEmission, 1.0)) + uColor * max(uEmission - 1.0, 0.0);
      float fog = (1.0 - exp(-vDistance * vDistance * 0.00075)) * uFog;
      gl_FragColor = vec4(mix(color, vec3(0.52, 0.56, 0.60), fog), 1.0);
    }`;

    function sceneCubeData() {
      const positions = [], normals = [], indices = [];
      const faces = [
        [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
        [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
        [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
        [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
        [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
        [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
      ];
      for (const [normal, vertices] of faces) {
        const first = positions.length / 3;
        for (const vertex of vertices) { positions.push(...vertex); normals.push(...normal); }
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
      return { positions, normals, indices };
    }

    function sceneSphereData() {
      const positions = [], normals = [], indices = [];
      const rings = 24, slices = 36;
      for (let ring = 0; ring <= rings; ring++) {
        const latitude = ring * Math.PI / rings;
        for (let slice = 0; slice <= slices; slice++) {
          const longitude = slice * Math.PI * 2 / slices;
          const normal = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
          positions.push(...normal); normals.push(...normal);
        }
      }
      for (let ring = 0; ring < rings; ring++) {
        for (let slice = 0; slice < slices; slice++) {
          const a = ring * (slices + 1) + slice, b = a + slices + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      return { positions, normals, indices };
    }

    function sceneCylinderData() {
      const positions = [], normals = [], indices = [];
      const slices = 24;
      for (let slice = 0; slice <= slices; slice++) {
        const angle = slice * Math.PI * 2 / slices, x = Math.cos(angle), y = Math.sin(angle);
        positions.push(x, y, -0.5, x, y, 0.5);
        normals.push(x, y, 0, x, y, 0);
        if (slice < slices) { const a = slice * 2; indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
      }
      for (const sign of [-1, 1]) {
        const center = positions.length / 3;
        positions.push(0, 0, sign * 0.5); normals.push(0, 0, sign);
        for (let slice = 0; slice <= slices; slice++) {
          const angle = slice * Math.PI * 2 / slices;
          positions.push(Math.cos(angle), Math.sin(angle), sign * 0.5); normals.push(0, 0, sign);
          if (slice < slices) indices.push(center, center + slice + (sign > 0 ? 1 : 2), center + slice + (sign > 0 ? 2 : 1));
        }
      }
      return { positions, normals, indices };
    }

    function createSceneRenderer(canvas) {
      if (!canvas || typeof canvas.getContext !== 'function') throw new Error('A canvas is required for the 3D range.');
      let gl;
      try { gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' }); }
      catch { throw new Error('WebGL could not start. Check browser hardware acceleration and retry.'); }
      if (!gl) throw new Error('WebGL is unavailable. Enable browser hardware acceleration and retry.');
      const resources = { shaders: [], programs: [], buffers: [] };
      let disposed = false, lost = false;
      const contextLost = (event) => { event.preventDefault(); lost = true; };
      canvas.addEventListener?.('webglcontextlost', contextLost);
      function dispose() {
        if (disposed) return;
        disposed = true;
        canvas.removeEventListener?.('webglcontextlost', contextLost);
        for (const buffer of resources.buffers) gl.deleteBuffer(buffer);
        for (const program of resources.programs) gl.deleteProgram(program);
        for (const shader of resources.shaders) gl.deleteShader(shader);
      }
      function shader(type, source) {
        const value = gl.createShader(type);
        if (!value) throw new Error('WebGL could not allocate a range shader.');
        resources.shaders.push(value);
        gl.shaderSource(value, source); gl.compileShader(value);
        if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(`3D range shader failed: ${gl.getShaderInfoLog(value) || 'unknown graphics error'}`);
        return value;
      }
      function buffer(type, values) {
        const value = gl.createBuffer();
        if (!value) throw new Error('WebGL could not allocate the range geometry.');
        resources.buffers.push(value);
        gl.bindBuffer(type, value); gl.bufferData(type, values, gl.STATIC_DRAW);
        return value;
      }
      function mesh(data) {
        return {
          position: buffer(gl.ARRAY_BUFFER, new Float32Array(data.positions)),
          normal: buffer(gl.ARRAY_BUFFER, new Float32Array(data.normals)),
          indices: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices)),
          count: data.indices.length,
        };
      }
      try {
        const vertex = shader(gl.VERTEX_SHADER, SCENE_VERTEX), fragment = shader(gl.FRAGMENT_SHADER, SCENE_FRAGMENT);
        const program = gl.createProgram();
        if (!program) throw new Error('WebGL could not allocate the range program.');
        resources.programs.push(program);
        gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`3D range program failed: ${gl.getProgramInfoLog(program) || 'unknown graphics error'}`);
        const uniforms = {};
        for (const name of ['Projection', 'View', 'Model', 'Normal', 'Color', 'Eye', 'Grid', 'Gloss', 'Emission', 'Fog']) uniforms[name] = gl.getUniformLocation(program, `u${name}`);
        const positionAttribute = gl.getAttribLocation(program, 'aPosition'), normalAttribute = gl.getAttribLocation(program, 'aNormal');
        const cube = mesh(sceneCubeData()), sphere = mesh(sceneSphereData()), cylinder = mesh(sceneCylinderData());
        const identity = sceneIdentity();
        let activeMesh = null;
        function draw(geometry, model, color, { grid = 0, gloss = 0, emission = 0, fog = 1 } = {}) {
          if (geometry !== activeMesh) {
            gl.bindBuffer(gl.ARRAY_BUFFER, geometry.position); gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normal); gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indices); activeMesh = geometry;
          }
          // Models have orthogonal axes: inverse-transpose is each axis / its squared length.
          const normal = new Float32Array(9);
          for (let column = 0; column < 3; column++) {
            const start = column * 4;
            const lengthSquared = model[start] ** 2 + model[start + 1] ** 2 + model[start + 2] ** 2;
            for (let row = 0; row < 3; row++) normal[column * 3 + row] = model[start + row] / lengthSquared;
          }
          gl.uniformMatrix4fv(uniforms.Model, false, model); gl.uniformMatrix3fv(uniforms.Normal, false, normal);
          gl.uniform3fv(uniforms.Color, color);
          gl.uniform1f(uniforms.Grid, grid); gl.uniform1f(uniforms.Gloss, gloss);
          gl.uniform1f(uniforms.Emission, emission); gl.uniform1f(uniforms.Fog, fog);
          gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_SHORT, 0);
        }
        const box = (position, size, color, material, rotation) => draw(cube, sceneModel(position, size, rotation), color, material);
        function render(state = {}) {
          if (disposed || lost || gl.isContextLost()) return;
          const ratio = sceneClamp(sceneFinite(globalThis.devicePixelRatio, 1), 1, 1.5);
          const width = Math.max(1, Math.round(sceneFinite(canvas.clientWidth, canvas.width || 1) * ratio));
          const height = Math.max(1, Math.round(sceneFinite(canvas.clientHeight, canvas.height || 1) * ratio));
          if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
          gl.viewport(0, 0, width, height);
          gl.clearColor(0.52, 0.56, 0.60, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
          gl.disable(gl.BLEND); gl.useProgram(program);
          gl.enableVertexAttribArray(positionAttribute); gl.enableVertexAttribArray(normalAttribute);
          activeMesh = null;
          gl.uniformMatrix4fv(uniforms.Projection, false, scenePerspective(sceneClamp(sceneFinite(state.fov, 72), 35, 115), width / height));
          gl.uniformMatrix4fv(uniforms.View, false, sceneView(state.yaw, state.pitch));
          gl.uniform3fv(uniforms.Eye, [0, 0, 0]);
          const grid = { grid: 1, gloss: 0.015 };
          // The full normalized target sequence fits above this floor, including large spheres.
          const wallHeight = 7 - SCENE_FLOOR_Y, wallCenter = (7 + SCENE_FLOOR_Y) / 2;
          box([0, SCENE_FLOOR_Y - 0.08, -4], [28.2, 0.16, 32.2], [0.49, 0.53, 0.57], grid);
          box([0, wallCenter, -18.08], [28.2, wallHeight, 0.16], [0.64, 0.67, 0.70], grid);
          box([-14.08, wallCenter, -4], [0.16, wallHeight, 28], [0.59, 0.63, 0.67], grid);
          box([14.08, wallCenter, -4], [0.16, wallHeight, 28], [0.59, 0.63, 0.67], grid);
          box([0, 7.08, -4], [28.2, 0.16, 28], [0.69, 0.71, 0.73], { grid: 0.6 });
          box([0, wallCenter, 10.08], [28.2, wallHeight, 0.16], [0.61, 0.65, 0.68], grid);
          // Recessed skirting and overhead lights add depth without visual clutter.
          box([0, SCENE_FLOOR_Y + 0.14, -17.96], [28, 0.26, 0.08], [0.39, 0.44, 0.49]);
          for (const side of [-1, 1]) {
            box([side * 13.96, SCENE_FLOOR_Y + 0.14, -4], [0.08, 0.26, 28], [0.39, 0.44, 0.49]);
            box([side * 13.90, wallCenter, -17.9], [0.16, wallHeight, 0.16], [0.49, 0.54, 0.58]);
            for (const z of [-14, -6, 2]) {
              box([side * 5.4, 6.96, z], [3.7, 0.04, 0.48], [0.77, 0.80, 0.81], { emission: 1 });
            }
          }
          const now = sceneFinite(state.now, globalThis.performance?.now?.() ?? 0);
          const hitAge = now - sceneFinite(state.hitAt, -Infinity);
          const hitLight = state.effects !== false && state.hitAt > 0 && hitAge >= 0 && hitAge < 140 ? (1 - hitAge / 140) * 0.04 : 0;
          for (const target of Array.isArray(state.targets) ? state.targets : []) {
            if (!sceneValidTarget(target)) continue;
            const r = target.radius;
            draw(sphere, sceneModel([target.x, SCENE_FLOOR_Y + 0.008, target.z], [r * 0.78, 0.007, r * 0.65]), [0.35, 0.40, 0.44]);
            draw(sphere, sceneModel([target.x, target.y, target.z], [r, r, r]), [0.035 + hitLight, 0.72 + hitLight, 0.82 + hitLight], { gloss: 0.5 });
          }
          if (state.gun !== false) drawGun(state, now, width / height);
        }
        function drawGun(state, now, aspect) {
          gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.uniformMatrix4fv(uniforms.Projection, false, scenePerspective(60, aspect));
          gl.uniformMatrix4fv(uniforms.View, false, identity);
          const age = now - sceneFinite(state.shotAt, -Infinity);
          const fired = state.shotAt > 0 && age >= 0;
          const recoil = fired && state.effects !== false && !state.reducedMotion ? Math.exp(-age / 70) : 0;
          const sway = state.reducedMotion ? 0 : Math.sin(now * 0.0018) * 0.002;
          const group = sceneModel([0.46 * Math.min(1, aspect / 1.25), -0.43 + sway + recoil * 0.025, -0.94 + recoil * 0.06], [1, 1, 1], [0.04 + recoil * 0.12, 0.16, -0.065]);
          const metal = [0.17, 0.20, 0.23], frame = [0.105, 0.125, 0.15], edge = [0.25, 0.29, 0.32];
          const part = (geometry, position, scale, color, rotation, emission = 0) => draw(geometry, sceneMultiply(group, sceneModel(position, scale, rotation)), color, { gloss: 0.28, emission, fog: 0 });
          const gunBox = (position, size, color = metal, rotation) => part(cube, position, size, color, rotation);
          // The gloved hand is behind the receiver; the slide, sights and bore are geometry.
          part(sphere, [0.03, -0.16, 0.10], [0.105, 0.19, 0.115], [0.18, 0.20, 0.21], [-0.2, 0, -0.1]);
          part(sphere, [0.11, -0.40, 0.24], [0.12, 0.25, 0.18], [0.13, 0.16, 0.18], [-0.3, 0, -0.2]);
          gunBox([0, -0.14, 0.015], [0.15, 0.34, 0.20], frame, [-0.24, 0, 0]);
          gunBox([0, -0.305, 0.055], [0.17, 0.035, 0.22], [0.075, 0.09, 0.105], [-0.24, 0, 0]);
          gunBox([0, -0.005, -0.19], [0.17, 0.13, 0.53], frame);
          gunBox([0, 0.115, -0.21], [0.18, 0.15, 0.64]);
          gunBox([0, 0.194, -0.21], [0.15, 0.012, 0.60], edge);
          gunBox([0.092, 0.12, -0.25], [0.006, 0.065, 0.16], [0.29, 0.32, 0.34]);
          part(cylinder, [0, 0.105, -0.558], [0.058, 0.058, 0.075], [0.27, 0.30, 0.32]);
          part(cylinder, [0, 0.105, -0.598], [0.038, 0.038, 0.006], [0.025, 0.032, 0.04]);
          gunBox([0, -0.17, -0.23], [0.13, 0.03, 0.25], frame);
          gunBox([0, -0.105, -0.345], [0.13, 0.14, 0.033], frame, [0.12, 0, 0]);
          gunBox([0, -0.085, -0.18], [0.025, 0.10, 0.025], [0.29, 0.31, 0.33], [-0.24, 0, 0]);
          for (let i = 0; i < 6; i++) {
            gunBox([0.092, 0.115, 0.07 - i * 0.025], [0.006, 0.105, 0.008], [0.08, 0.10, 0.12]);
            gunBox([0.078, -0.085 - i * 0.03, 0.04 + i * 0.007], [0.008, 0.012, 0.14], [0.075, 0.09, 0.105], [-0.24, 0, 0]);
          }
          for (const side of [-1, 1]) gunBox([side * 0.055, 0.22, 0.055], [0.028, 0.04, 0.045], [0.055, 0.07, 0.08]);
          gunBox([0, 0.222, -0.47], [0.025, 0.045, 0.03], [0.06, 0.075, 0.085]);
          gunBox([0, 0.224, -0.452], [0.009, 0.018, 0.006], [0.74, 0.81, 0.78]);
          if (fired && age < 45 && state.effects !== false) {
            part(sphere, [0, 0.105, -0.69], [0.045, 0.045, 0.13], [1, 0.64, 0.19], undefined, 1.5);
            part(sphere, [0, 0.105, -0.65], [0.028, 0.028, 0.07], [1, 0.94, 0.72], undefined, 1.1);
          }
        }
        return { render, dispose };
      } catch (error) {
        dispose();
        throw error;
      }
    }

    // ---- net/../src/range.js ----

    const RANGE_SETTINGS_KEY = 'aim-trainer:3d:settings:v1';
    const RANGE_HISTORY_KEY = 'aim-trainer:3d:history:v1';
    const RANGE_RECORDS_KEY = 'aim-trainer:3d:records:v1';
    const RANGE_GHOST_KEY = 'aim-trainer:3d:ghost:v1';

    function rangeSettings(value = {}) {
      const raw = value && typeof value === 'object' ? value : {};
      return {
        sensitivity: Number.isFinite(raw.sensitivity) && raw.sensitivity > 0 ? Math.min(1, Math.max(.02, raw.sensitivity)) : .16,
        fov: Number.isFinite(raw.fov) ? Math.min(110, Math.max(60, raw.fov)) : 80,
        crosshair: ['cross', 'dot', 'ring'].includes(raw.crosshair) ? raw.crosshair : 'cross',
        sound: typeof raw.sound === 'boolean' ? raw.sound : false,
        gun: typeof raw.gun === 'boolean' ? raw.gun : true,
        effects: typeof raw.effects === 'boolean' ? raw.effects : true,
        ghost: typeof raw.ghost === 'boolean' ? raw.ghost : true,
      };
    }

    function readRangeStorage(key, fallback) {
      try { return JSON.parse(globalThis.localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    }

    function writeRangeStorage(key, value) {
      try { globalThis.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    }

    function readRunHistory() {
      const value = readRangeStorage(RANGE_HISTORY_KEY, []);
      return Array.isArray(value) ? value.filter(validRun).slice(-100) : [];
    }

    function validRun(run) {
      return run && ['click', 'reaction', 'track'].includes(run.mode) && run.status === 'done'
        && Number.isFinite(run.score) && run.score >= 0 && Number.isFinite(run.finishedAt)
        && Number.isFinite(run.accuracy) && run.accuracy >= 0 && run.accuracy <= 100;
    }

    function recordRun(history, run) {
      const previous = Array.isArray(history) ? history.filter(validRun) : [];
      return (validRun(run) ? [...previous, run] : previous).slice(-100);
    }

    function bestRunScore(mode, records, history) {
      const stored = records && typeof records === 'object' && !Array.isArray(records) ? records[mode] : null;
      const scores = Array.isArray(history) ? history.filter(run => validRun(run) && run.mode === mode).map(run => run.score) : [];
      if (Number.isFinite(stored) && stored >= 0) scores.push(stored);
      return scores.length ? (mode === 'reaction' ? Math.min(...scores) : Math.max(...scores)) : null;
    }

    // No DOM or animation timing here: a single clock controls both scoring and HUD.
    class DrillSession {
      constructor({ mode = 'click', seed = Math.floor(Math.random() * 0xffffffff), durationMs, rounds = 8, multiplayer = false } = {}) {
        this.mode = ['click', 'reaction', 'track'].includes(mode) ? mode : 'click';
        this.durationMs = durationMs || (this.mode === 'track' ? 20000 : 30000);
        this.rounds = Math.max(1, Math.min(20, Math.round(rounds)));
        this.multiplayer = multiplayer;
        this.random = mulberry32(seed);
        this.points = buildTargets(seed, 320);
        this.index = 0;
        this.targets = [];
        this.status = 'ready';
        this.elapsedMs = 0;
        this.clockMs = 0;
        this.lastNow = 0;
        this.shots = 0;
        this.hits = 0;
        this.trackedMs = 0;
        this.times = [];
        this.hitTimes = [];
        this.samples = [];
        this.early = false;
        this.visibleAt = null;
        this.nextAt = 700 + this.random() * 1300;
        const count = this.mode === 'click' && !multiplayer ? 3 : this.mode === 'reaction' ? 0 : 1;
        for (let i = 0; i < count; i++) this.targets.push(this.nextTarget());
      }

      nextTarget(replacedId) {
        let candidate;
        do {
          const index = this.index++;
          candidate = sceneTarget({ ...this.points[index % this.points.length], r: .024 }, `orb-${index}`);
        } while (this.mode === 'click' && !this.multiplayer && this.targets.some(target =>
          target.id !== replacedId && Math.hypot(target.x - candidate.x, target.y - candidate.y, target.z - candidate.z) < target.radius + candidate.radius));
        return candidate;
      }

      start(now, { skipCountdown = false } = {}) {
        if (this.status !== 'ready') return;
        this.countdownMs = skipCountdown ? 0 : 3000;
        this.status = skipCountdown ? 'running' : 'countdown';
        this.lastNow = now;
      }

      tick(now, aimedId = null) {
        if (!['running', 'countdown'].includes(this.status)) return;
        const delta = Math.max(0, Number.isFinite(now) ? now - this.lastNow : 0);
        this.lastNow = Number.isFinite(now) ? now : this.lastNow;
        this.clockMs += delta;
        if (this.clockMs < this.countdownMs) return;
        this.status = 'running';
        const previous = this.elapsedMs;
        this.elapsedMs = Math.max(0, this.clockMs - this.countdownMs);
        if (this.mode !== 'reaction') this.elapsedMs = Math.min(this.durationMs, this.elapsedMs);
        if (this.mode === 'reaction' && !this.targets.length && this.elapsedMs >= this.nextAt) {
          this.targets = [this.nextTarget()];
          this.visibleAt = this.elapsedMs;
          this.early = false;
        }
        if (this.mode === 'track') {
          if (aimedId === this.targets[0]?.id) this.trackedMs += Math.min(100, this.elapsedMs - previous);
          const seconds = this.elapsedMs / 1000;
          this.targets[0].x = Math.sin(seconds * .82) * 5.3;
          this.targets[0].y = Math.sin(seconds * 1.13 + .4) * 1.9;
          this.targets[0].radius = .52;
        }
        const second = Math.floor(this.elapsedMs / 1000);
        if (second > this.samples.length) this.samples.push(this.mode === 'track' ? this.snapshot().accuracy : this.mode === 'reaction' ? this.snapshot().averageMs : this.hits);
        if (this.mode !== 'reaction' && this.elapsedMs >= this.durationMs) this.status = 'done';
      }

      shoot(now, aimedId) {
        this.tick(now);
        if (this.status !== 'running') return false;
        if (this.mode === 'track') return false;
        if (this.mode === 'reaction' && !this.targets.length) { this.early = true; return false; }
        this.shots++;
        const index = this.targets.findIndex(target => target.id === aimedId);
        if (index < 0) return false;
        this.hits++;
        this.hitTimes.push(this.elapsedMs);
        if (this.mode === 'click') this.targets[index] = this.nextTarget(this.targets[index].id);
        else {
          this.times.push(Math.max(0, this.elapsedMs - this.visibleAt));
          this.targets = [];
          this.visibleAt = null;
          this.nextAt = this.elapsedMs + 700 + this.random() * 1300;
          if (this.times.length >= this.rounds) this.status = 'done';
        }
        return true;
      }

      pause(now) {
        if (this.multiplayer || !['running', 'countdown'].includes(this.status)) return;
        this.tick(now);
        if (this.status === 'done') return;
        this.beforePause = this.status;
        this.status = 'paused';
      }

      resume(now) {
        if (this.status !== 'paused') return;
        this.lastNow = now;
        this.status = this.beforePause;
      }

      snapshot() {
        const averageMs = this.times.length ? Math.round(this.times.reduce((sum, time) => sum + time, 0) / this.times.length) : 0;
        const accuracy = this.mode === 'track'
          ? (this.elapsedMs ? Math.round(this.trackedMs / this.elapsedMs * 100) : 0)
          : (this.shots ? Math.round(this.hits / this.shots * 100) : 0);
        return {
          mode: this.mode, status: this.status,
          score: this.mode === 'reaction' ? averageMs : this.mode === 'track' ? accuracy : this.hits,
          hits: this.hits, shots: this.shots, accuracy, averageMs,
          lastMs: this.times.length ? Math.round(this.times[this.times.length - 1]) : 0,
          averageHitMs: this.hits ? Math.round(this.elapsedMs / this.hits) : 0,
          round: Math.min(this.hits + 1, this.rounds), rounds: this.rounds,
          elapsedMs: this.elapsedMs, leftMs: Math.max(0, this.durationMs - this.elapsedMs),
          countdown: Math.max(1, Math.ceil((this.countdownMs - this.clockMs) / 1000)),
          samples: [...this.samples], early: this.early,
        };
      }
    }

    // ---- net/../src/range-ui.js ----

    function createRange(React) {
      const el = React.createElement;
      const listeners = new Set();
      let preferences;
      const currentSettings = () => preferences || (preferences = rangeSettings(readRangeStorage(RANGE_SETTINGS_KEY, {})));
      function useSettings() {
        const [settings, setSettings] = React.useState(currentSettings);
        React.useEffect(() => { listeners.add(setSettings); return () => listeners.delete(setSettings); }, []);
        return settings;
      }
      function updateSettings(patch) {
        preferences = rangeSettings({ ...currentSettings(), ...patch });
        writeRangeStorage(RANGE_SETTINGS_KEY, preferences);
        for (const notify of listeners) notify(preferences);
      }
      function RangeSettings({ t }) {
        const settings = useSettings();
        const slider = (key, label, min, max, step, unit = '') => el('label', { className: 'ar-setting' },
          el('span', null, t(label)), el('strong', null, `${settings[key]}${unit}`),
          el('input', { type: 'range', min, max, step, value: settings[key], 'aria-label': t(label), onChange: event => updateSettings({ [key]: Number(event.target.value) }) }));
        return el('div', { className: 'ar-settings' },
          el('div', { className: 'ar-section-label' }, t('settingsControls')),
          slider('sensitivity', 'sensitivity', .02, .6, .01, ' °/px'),
          slider('fov', 'fieldOfView', 60, 110, 1, '°'),
          el('label', { className: 'ar-setting' }, el('span', null, t('feelCrosshair')),
            el('select', { value: settings.crosshair, onChange: event => updateSettings({ crosshair: event.target.value }) },
              ...[['cross', 'feelCross'], ['dot', 'feelDot'], ['ring', 'feelRing']].map(([key, label]) => el('option', { key, value: key }, t(label))))),
          el('div', { className: 'ar-section-label' }, t('settingsPresentation')),
          ...[['gun', 'feelGun'], ['effects', 'feelEffects'], ['sound', 'feelSound'], ['ghost', 'ghost']].map(([key, label]) => el('label', { key, className: 'ar-toggle' },
            el('span', null, t(label)), el('input', { type: 'checkbox', checked: settings[key], onChange: event => updateSettings({ [key]: event.target.checked }) }))),
          el('p', { className: 'ar-muted' }, t('sensitivityHint')));
      }

      function Trend({ values, label }) {
        if (!values.length) return el('div', { className: 'ar-chart-empty' }, '—');
        const max = Math.max(1, ...values), min = Math.min(0, ...values);
        const points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${48 - (value - min) / Math.max(1, max - min) * 40}`).join(' ');
        return el('svg', { className: 'ar-trend', viewBox: '0 0 100 52', preserveAspectRatio: 'none', role: 'img', 'aria-label': label },
          ...[12, 28, 44].map(y => el('line', { key: y, x1: 0, x2: 100, y1: y, y2: y, stroke: '#30383d', strokeWidth: .4 })),
          el('polyline', { points, fill: 'none', stroke: '#4cd4d9', strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' }),
          values.length === 1 && el('circle', { cx: 50, cy: 8, r: 1.8, fill: '#4cd4d9' }));
      }

      function RangeRecords({ t }) {
        const history = readRunHistory();
        const records = readRangeStorage(RANGE_RECORDS_KEY, null);
        const legacy = readRangeStorage('aim-trainer:records:v1', null);
        return el('div', { className: 'ar-record-page' },
          el('div', { className: 'ar-page-heading' }, el('span', { className: 'ar-eyebrow' }, 'YOUR PERFORMANCE'), el('h2', null, t('recordTab')), el('p', null, t('historyHint'))),
          el('div', { className: 'ar-record-grid' }, ...['click', 'reaction', 'track'].map(mode => {
            const runs = history.filter(run => run.mode === mode);
            const best = bestRunScore(mode, records, runs) ?? '—';
            return el('article', { key: mode, className: 'ar-panel' }, el('span', { className: 'ar-eyebrow' }, t(mode)),
              el('strong', { className: 'ar-best-number' }, best, el('small', null, mode === 'reaction' ? ' ms' : mode === 'track' ? '%' : '')),
              el(Trend, { values: runs.slice(-20).map(r => r.score), label: t('recentRuns') }), el('p', { className: 'ar-muted' }, `${runs.length} ${t('completedRuns')}`));
          })),
          history.length ? el('div', { className: 'ar-panel ar-history' }, el('h3', null, t('recentRuns')),
            el('table', null, el('thead', null, el('tr', null, ...['trainingTask', 'score', 'accuracy', 'date'].map(key => el('th', { key }, t(key))))),
              el('tbody', null, ...history.slice(-15).reverse().map((run, i) => el('tr', { key: i },
                el('td', null, t(run.mode)), el('td', null, run.score, run.mode === 'reaction' ? ' ms' : run.mode === 'track' ? '%' : ''),
                el('td', null, `${run.accuracy}%`), el('td', null, new Date(run.finishedAt).toLocaleString()))))))
            : el('div', { className: 'ar-panel ar-empty-records' }, el('span', null, '◎'), el('h3', null, t('noRecord')), el('p', null, t('historyHint'))),
          legacy && el('div', { className: 'ar-legacy' }, t('legacyRecords'), ' · ', ...['click', 'reaction', 'track'].map(mode => `${t(mode)}: ${Number.isFinite(legacy[mode]) ? legacy[mode] : '—'}  `)));
      }

      function RangeGame({ mode = 'click', t, onFinish = () => {}, visible = true, seed, multiplayer = false, durationMs, rounds = 8, startLocal = 0, onProgress, onBack, onLeave, statusPanel }) {
        const settings = useSettings();
        const configRef = React.useRef(settings); configRef.current = settings;
        const makeGame = () => new DrillSession({ mode, seed, multiplayer, durationMs, rounds });
        const session = React.useRef(null);
        if (!session.current) {
          session.current = makeGame();
          if (multiplayer) session.current.start(startLocal || Date.now(), { skipCountdown: true });
        }
        const [view, setView] = React.useState(() => session.current.snapshot());
        const [locked, setLocked] = React.useState(false);
        const [error, setError] = React.useState('');
        const [result, setResult] = React.useState(null);
        const [ghost, setGhost] = React.useState(() => {
          const data = readRangeStorage(RANGE_GHOST_KEY, null);
          return validGhost(data, 30000) ? data : null;
        });
        const canvasRef = React.useRef(null);
        const controlRef = React.useRef(null);
        const visibleRef = React.useRef(visible); visibleRef.current = visible;
        const callbacks = React.useRef({ onFinish, onProgress }); callbacks.current = { onFinish, onProgress };
        const camera = React.useRef({ yaw: 0, pitch: 0 });
        const history = readRunHistory().filter(run => run.mode === mode);
        const active = !['ready', 'done'].includes(view.status);
        const running = view.status === 'running' || view.status === 'countdown';
        const clock = () => multiplayer ? Date.now() : performance.now();

        React.useEffect(() => {
          if (!visible) {
            controlRef.current?.suspendGraphics();
            session.current.pause(clock());
            setView(session.current.snapshot());
            if (document.pointerLockElement === canvasRef.current && canvasRef.current) document.exitPointerLock?.();
          } else controlRef.current?.resumeGraphics();
        }, [visible]);

        React.useEffect(() => {
          const canvas = canvasRef.current;
          if (!canvas) return undefined;
          let renderer = null, rendererAvailable = true, frame = 0, disposed = false, lastUI = 0, lastReport = 0, reportedDone = false;
          let lastRender = -1000, requested = false;
          let shotAt = -1000, hitAt = -1000, audio = null;
          let wasLocked = false;
          const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
          const suspendGraphics = () => { renderer?.dispose(); renderer = null; };
          const openRenderer = () => {
            if (disposed || renderer || !rendererAvailable || !visibleRef.current || document.hidden) return;
            try { renderer = createSceneRenderer(canvas); setError(''); }
            catch (_) { rendererAvailable = false; setError('webglUnavailable'); }
          };
          openRenderer();
          const sync = () => setView(session.current.snapshot());
          const finish = () => {
            if (reportedDone || session.current.status !== 'done') return;
            reportedDone = true;
            const data = { ...session.current.snapshot(), finishedAt: Date.now() };
            if (document.pointerLockElement === canvas) document.exitPointerLock?.();
            if (!multiplayer) {
              data.persistence = writeRangeStorage(RANGE_HISTORY_KEY, recordRun(readRunHistory(), data));
              if (mode === 'click' && data.hits > 0) {
                const old = readRangeStorage(RANGE_GHOST_KEY, null);
                if (!validGhost(old, 30000) || session.current.hitTimes.length > old.hits.length) {
                  data.ghostPersistence = writeRangeStorage(RANGE_GHOST_KEY, { version: 1, durationMs: 30000, hits: session.current.hitTimes });
                }
              }
              setResult(data);
            }
            callbacks.current.onFinish(mode, data.score, data);
          };
          const playSound = hit => {
            if (!configRef.current.sound) return;
            try {
              const Audio = window.AudioContext || window.webkitAudioContext;
              if (!Audio) return;
              if (!audio) audio = new Audio();
              if (audio.state === 'suspended') audio.resume().catch(() => {});
              const oscillator = audio.createOscillator(), gain = audio.createGain();
              oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(hit ? 900 : 180, audio.currentTime);
              oscillator.frequency.exponentialRampToValueAtTime(hit ? 330 : 65, audio.currentTime + .07);
              gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .09);
              oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .1);
              oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            } catch (_) { /* Visual training remains usable without audio. */ }
          };
          const lockChange = () => {
            if (disposed) return;
            const input = document.pointerLockElement === canvas;
            setLocked(input);
            if (input) {
              setError('');
              if (session.current.status === 'ready') session.current.start(clock());
              else session.current.resume(clock());
            } else if (wasLocked) session.current.pause(clock());
            wasLocked = input;
            sync();
          };
          const move = event => {
            if (document.pointerLockElement !== canvas || !visibleRef.current) return;
            camera.current = rotateLook(camera.current, event.movementX, event.movementY, configRef.current.sensitivity);
          };
          const fire = event => {
            if (event.button !== 0 || document.pointerLockElement !== canvas || !visibleRef.current || session.current.status !== 'running') return;
            event.preventDefault();
            const target = aimTarget(camera.current, session.current.targets);
            const hit = session.current.shoot(clock(), target?.id);
            shotAt = performance.now(); if (hit) hitAt = shotAt;
            playSound(hit); sync(); finish();
          };
          const hidden = () => {
            if (!document.hidden) { openRenderer(); return; }
            suspendGraphics();
            session.current.pause(clock()); sync();
            if (document.pointerLockElement === canvas) document.exitPointerLock?.();
          };
          const contextLost = event => {
            event.preventDefault(); session.current.pause(clock()); sync();
            if (document.pointerLockElement === canvas) document.exitPointerLock?.();
            suspendGraphics(); rendererAvailable = false; setError('webglLost');
          };
          const restore = () => { rendererAvailable = true; openRenderer(); };
          const lockError = () => { if (requested) { requested = false; setError('pointerLockFailed'); } };
          const animate = now => {
            if (disposed) return;
            const game = session.current;
            const input = document.pointerLockElement === canvas;
            if (!document.hidden && (visibleRef.current || multiplayer)) {
              const aimed = input && visibleRef.current ? aimTarget(camera.current, game.targets) : null;
              game.tick(clock(), aimed?.id);
              if ((game.status === 'running' || game.status === 'countdown') && now - lastUI > 80) { sync(); lastUI = now; }
              if (multiplayer && game.status === 'running' && now - lastReport > 250) {
                callbacks.current.onProgress?.(game.snapshot()); lastReport = now;
              }
              finish();
              if (visibleRef.current && renderer && game.status !== 'done' && (input || now - lastRender > 100)) {
                renderer.render({ ...camera.current, ...configRef.current,
                targets: game.status === 'ready' ? [sceneTarget({ x: .38, y: .42 }, 'p1'), sceneTarget({ x: .6, y: .34 }, 'p2'), sceneTarget({ x: .52, y: .64 }, 'p3')] : game.targets,
                shotAt, hitAt, now, reducedMotion });
                lastRender = now;
              }
            }
            frame = window.requestAnimationFrame(animate);
          };
          controlRef.current = {
            request() { requested = true; },
            suspendGraphics,
            resumeGraphics: openRenderer,
            retry() { suspendGraphics(); rendererAvailable = true; openRenderer(); },
            restart() {
              session.current = makeGame(); reportedDone = false; camera.current = { yaw: 0, pitch: 0 };
              setResult(null); sync();
              const saved = readRangeStorage(RANGE_GHOST_KEY, null); setGhost(validGhost(saved, 30000) ? saved : null);
            },
            abandon() {
              if (document.pointerLockElement === canvas) document.exitPointerLock?.();
              session.current = makeGame(); reportedDone = false; camera.current = { yaw: 0, pitch: 0 }; setResult(null); sync();
            },
          };
          document.addEventListener('pointerlockchange', lockChange);
          document.addEventListener('pointerlockerror', lockError);
          document.addEventListener('mousemove', move);
          document.addEventListener('mousedown', fire);
          document.addEventListener('visibilitychange', hidden);
          canvas.addEventListener('webglcontextlost', contextLost);
          canvas.addEventListener('webglcontextrestored', restore);
          const preventMenu = event => event.preventDefault();
          canvas.addEventListener('contextmenu', preventMenu);
          const onlineTimer = multiplayer ? window.setInterval(() => {
            session.current.tick(clock());
            finish();
          }, 150) : 0;
          frame = window.requestAnimationFrame(animate);
          return () => {
            disposed = true; window.cancelAnimationFrame(frame);
            document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('pointerlockerror', lockError);
            document.removeEventListener('mousemove', move); document.removeEventListener('mousedown', fire);
            document.removeEventListener('visibilitychange', hidden);
            canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', restore);
            canvas.removeEventListener('contextmenu', preventMenu);
            if (onlineTimer) window.clearInterval(onlineTimer);
            if (document.pointerLockElement === canvas) document.exitPointerLock?.();
            suspendGraphics(); if (audio) audio.close().catch(() => {});
            controlRef.current = null;
          };
        }, []);

        function enter() {
          if (error === 'webglUnavailable' || error === 'webglLost') return;
          const canvas = canvasRef.current;
          if (!canvas?.requestPointerLock) { setError('pointerLockUnavailable'); return; }
          try {
            controlRef.current?.request();
            const pending = canvas.requestPointerLock();
            pending?.catch?.(() => setError('pointerLockFailed'));
          } catch (_) { setError('pointerLockFailed'); }
        }
        function restart() { controlRef.current?.restart(); }
        const title = t(mode === 'click' ? 'gridshot' : mode === 'reaction' ? 'reactionTask' : 'trackingTask');
        const unit = mode === 'reaction' ? ' ms' : mode === 'track' ? '%' : '';
        const stat = (label, value) => el('div', { className: 'ar-hud-stat', key: label }, el('span', null, t(label)), el('strong', null, value));
        const ghostScore = ghostScoreAt(ghost, view.elapsedMs);
        const overlay = active && (!locked || view.status === 'paused');
        return el('div', { className: `ar-range${active ? ' ar-range-play' : ''}${result ? ' ar-range-result' : ''}`, 'data-active': active ? 'true' : 'false' },
          el('div', { className: 'ar-scene at-arena' },
            el('canvas', { ref: canvasRef, className: 'ar-canvas', 'aria-label': t('sceneLabel') }),
            !active && !result && el('div', { className: 'ar-hero-text' }, el('span', { className: 'ar-eyebrow' }, 'AIM TRAINER / PRECISION SERIES'), el('h1', null, title), el('p', null, t(`${mode}Hint3d`))),
            !active && !result && el('span', { className: 'ar-scene-badge' }, '● 3D RANGE'),
            active && el('div', { className: 'ar-hud' },
              el('div', { className: 'ar-hud-name' }, el('strong', null, title), el('span', null, multiplayer ? t('versusTab') : 'AIM TRAINER')),
              stat('score', `${view.score}${unit}`), stat(mode === 'reaction' ? 'round' : 'timeLeft', mode === 'reaction' ? `${view.round}/${rounds}` : `${Math.ceil(view.leftMs / 1000)}s`), stat('accuracy', `${view.accuracy}%`),
              el('button', { className: 'ar-hud-pause', type: 'button', onClick: () => document.exitPointerLock?.(), 'aria-label': t('pause') }, 'Ⅱ')),
            active && multiplayer && statusPanel && el('div', { className: 'ar-online-progress' }, statusPanel),
            active && !overlay && el('div', { className: `ar-crosshair ${settings.crosshair}`, 'aria-hidden': true }),
            view.status === 'countdown' && locked && el('div', { className: 'ar-countdown' }, el('span', null, t('ready')), el('strong', null, view.countdown)),
            mode === 'reaction' && active && locked && view.status === 'running' && !session.current.targets.length && el('div', { className: 'ar-reaction-wait' }, view.early ? t('early') : t('waitForTarget')),
            mode === 'click' && active && settings.ghost && ghost && !multiplayer && el('div', { className: 'ar-ghost-strip' },
              el('span', null, t('ghost')), el('strong', null, `${view.hits} : ${ghostScore}`),
              el('span', null, `${view.hits - ghostScore >= 0 ? '+' : ''}${view.hits - ghostScore}`)),
            active && locked && el('div', { className: 'ar-game-help' }, t('escapePause')),
            overlay && el('div', { className: 'ar-pause-overlay' },
              el('div', { className: 'ar-pause-card' }, el('span', { className: 'ar-eyebrow' }, title),
                el('h2', null, t(multiplayer ? 'inputReleased' : 'paused')),
                el('p', null, t(multiplayer ? 'onlineClockContinues' : 'pauseHint')),
                error && el('p', { className: 'ar-error', role: 'alert' }, t(error)),
                (error === 'webglUnavailable' || error === 'webglLost') && el('button', { className: 'ar-secondary', type: 'button', onClick: () => controlRef.current?.retry() }, t('retryGraphics')),
                el('button', { className: 'at-primary', type: 'button', onClick: enter }, t('resumeTraining')),
                multiplayer && el('button', { className: 'ar-secondary', type: 'button', onClick: onLeave }, t('leaveRoom')),
                !multiplayer && el('button', { className: 'ar-secondary', type: 'button', onClick: () => { controlRef.current?.abandon(); onBack?.(); } }, t('backToTasks')))),
            result && el('div', { className: 'ar-results' },
              el('div', { className: 'ar-result-top' }, el('span', { className: 'ar-eyebrow' }, t('sessionComplete')), el('h2', null, title),
                el('div', { className: 'ar-result-score' }, result.score.toLocaleString(), el('small', null, unit || t('hits')))),
              el('div', { className: 'ar-result-stats' }, stat('accuracy', `${result.accuracy}%`),
                stat(mode === 'track' ? 'duration' : 'targetsHit', mode === 'track' ? `${Math.round(result.elapsedMs / 1000)}s` : `${result.hits} / ${result.shots}`),
                stat(mode === 'reaction' ? 'fastestReaction' : mode === 'track' ? 'onTargetTime' : 'averageHitTime', mode === 'track' ? `${(session.current.trackedMs / 1000).toFixed(1)}s` : `${mode === 'reaction' ? Math.round(Math.min(...session.current.times)) : result.averageHitMs} ms`)),
              el('div', { className: 'ar-result-charts' },
                el('div', { className: 'ar-panel' }, el('h3', null, t('sessionTrend')), el(Trend, { values: result.samples, label: t('sessionTrend') })),
                el('div', { className: 'ar-panel' }, el('h3', null, t('recentRuns')), el(Trend, { values: [...history.slice(-9).map(r => r.score)], label: t('recentRuns') }))),
              el('div', { className: 'ar-result-actions' }, el('span', { className: result.persistence ? 'ar-muted' : 'ar-error', role: result.persistence ? undefined : 'alert' }, t(result.persistence ? 'savedLocally' : 'saveFailed')),
                result.ghostPersistence === false && el('span', { className: 'ar-error', role: 'alert' }, t('ghostSaveFailed')),
                el('button', { className: 'ar-secondary', type: 'button', onClick: () => { restart(); onBack?.(); } }, t('backToTasks')),
                el('button', { className: 'at-primary', type: 'button', onClick: () => { restart(); enter(); } }, t('again'))))),
          !active && !result && el('div', { className: 'ar-task-info' },
            el('div', null, el('span', { className: 'ar-eyebrow' }, t('trainingTask')), el('h2', null, title), el('p', null, t('mouseLookHint'))),
            el('div', { className: 'ar-task-duration' }, el('strong', null, mode === 'reaction' ? rounds : mode === 'track' ? '20' : '30'), el('span', null, mode === 'reaction' ? t('round') : t('sec'))),
            el('button', { className: 'at-primary ar-start', type: 'button', 'data-shortcut-start': '', onClick: enter, disabled: error === 'webglUnavailable' || error === 'webglLost' }, t('start'))),
          !active && !result && error && el('p', { className: 'ar-error', role: 'alert' }, t(error)),
          !active && !result && (error === 'webglUnavailable' || error === 'webglLost') && el('button', { className: 'ar-secondary', type: 'button', onClick: () => controlRef.current?.retry() }, t('retryGraphics')),
          !active && !result && el('div', { className: 'ar-task-notes' },
            el('div', { className: 'ar-panel' }, el('span', { className: 'ar-note-icon' }, '⌖'), el('strong', null, t('focusTitle')), el('p', null, t(`${mode}Hint3d`))),
            el('div', { className: 'ar-panel' }, el('span', { className: 'ar-note-icon' }, '↗'), el('strong', null, t('improveTitle')), el('p', null, t('improveHint')))));
      }
      return { RangeGame, RangeSettings, RangeRecords };
    }

    // ---- net/../src/app-style.js ----
    const APP_CSS = `
    .at-root { --ar-bg:#171b1e; --ar-panel:#1e2428; --ar-line:#343c42; --ar-text:#e7edef; --ar-muted:#929fa7; --ar-accent:#48d2d7; font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif; }
    .at-win { isolation:isolate; container-type:inline-size; border:1px solid #394249; border-radius:12px; background:var(--ar-bg); color:var(--ar-text); box-shadow:0 28px 100px #0009; overflow:hidden; }
    .at-win button,.at-win input,.at-win select { font-family:inherit; }
    .at-win button { -webkit-tap-highlight-color:transparent; }
    .at-win button:focus-visible,.at-win input:focus-visible,.at-win select:focus-visible { outline:2px solid var(--ar-accent); outline-offset:3px; }
    .at-win button:disabled { opacity:.4; cursor:not-allowed; }
    .at-bar { min-height:62px; padding:0 20px; background:#20262a; border-bottom:1px solid var(--ar-line); gap:14px; }
    .at-brand { display:flex; align-items:center; gap:10px; flex-shrink:0; color:#f3f6f7; }
    .at-brand svg { width:30px; height:30px; color:var(--ar-accent); }
    .at-brand b { font-size:16px; letter-spacing:-.04em; }
    .at-brand small { color:#a7b3ba; font-size:9px; letter-spacing:.22em; display:block; margin-top:3px; }
    .at-name { font-size:11px; color:var(--ar-muted); letter-spacing:.14em; }
    .at-app-nav { align-self:stretch; display:flex; gap:2px; margin-left:22px; }
    .at-app-nav .at-tab { position:relative; flex:none; padding:0 18px; background:none; color:#9da9b0; border-radius:0; font-size:12px; letter-spacing:.02em; }
    .at-app-nav .at-tab[aria-selected="true"] { background:none; color:var(--ar-accent); }
    .at-app-nav .at-tab[aria-selected="true"]:after { position:absolute; content:''; bottom:0; left:18px; right:18px; height:3px; background:var(--ar-accent); }
    .at-app-nav .at-tab:hover { color:#e8edef; }
    .at-ico { color:#a7b3ba; border-color:#465159; border-radius:5px; width:28px; height:28px; background:none; }
    .at-version { color:#82929b; font-size:10px; letter-spacing:.08em; }
    .at-content { min-height:0; flex:1; overflow:auto; background:radial-gradient(ellipse at 80% 0,#29323844,transparent 60%),#171b1e; scrollbar-color:#47545d #1b2024; }
    .at-training-shell { min-height:100%; display:grid; grid-template-columns:205px minmax(0,1fr); }
    .at-sidebar { background:#1b2024; border-right:1px solid #30393f; padding:25px 14px; }
    .at-side-label { padding:0 13px; margin:4px 0 14px; color:#788891; font-size:9px; font-weight:700; letter-spacing:.18em; }
    .at-modes { display:flex; flex-direction:column; gap:5px; padding:0; }
    .at-mode { position:relative; display:flex; gap:11px; align-items:center; text-align:left; min-height:68px; padding:12px; border-radius:6px; border:1px solid transparent; background:transparent; color:#bac4ca; font-size:12px; letter-spacing:0; }
    .at-mode svg { width:24px; height:24px; flex-shrink:0; color:#7c909a; }
    .at-mode small { display:block; color:#7f909a; font-size:10px; margin-top:6px; font-weight:400; }
    .at-mode[aria-pressed="true"] { background:#2b373d; color:#fff; border-color:#3e5d64; box-shadow:none; }
    .at-mode[aria-pressed="true"] svg { color:var(--ar-accent); }
    .at-mode[aria-pressed="true"]:before { content:''; position:absolute; left:-15px; top:15px; bottom:15px; width:3px; background:var(--ar-accent); }
    .at-mode:hover { background:#283138; }
    .at-side-bottom { margin:30px 12px; padding-top:22px; border-top:1px solid #343d43; }
    .at-side-bottom strong { display:block; color:#9dafb8; font-size:11px; }
    .at-side-bottom p { color:#70838f; font-size:10px; line-height:1.8; margin:8px 0; }
    .at-main-training { min-width:0; padding:28px 30px; }
    .at-breadcrumb { display:flex; align-items:center; gap:9px; margin-bottom:16px; color:#82929a; font-size:10px; letter-spacing:.12em; }
    .at-breadcrumb span:last-child { color:#c2cdd2; }
    .at-footer { min-height:30px; padding:0 12px 0 20px; color:#778a96; background:#1b2024; border-top:1px solid #313a40; letter-spacing:.025em; }
    .at-footer .at-resize { color:#778a96; }
    .at-primary { background:#49d4d9; color:#10282d; border:1px solid #49d4d9; border-radius:5px; padding:13px 24px; font-size:12px; line-height:1.4; letter-spacing:.01em; font-weight:750; cursor:pointer; min-height:43px; }
    .at-primary:hover { background:#78e5e8; border-color:#78e5e8; }
    .ar-secondary,.at-ghost { border:1px solid #48545d; background:#242c31; color:#d5dfe4; border-radius:5px; padding:12px 20px; font-size:12px; line-height:1.4; cursor:pointer; }
    .ar-secondary:hover,.at-ghost:hover { background:#303c43; border-color:#6b7b85; }
    .ar-eyebrow { color:#90a3ad; font-size:9px; line-height:1.5; font-weight:650; letter-spacing:.18em; }
    .ar-range { min-width:0; }
    .ar-range .ar-scene { height:clamp(280px,43vh,520px); min-height:240px; margin:0; border-radius:8px; border:1px solid #435057; position:relative; overflow:hidden; background:#303940; }
    .ar-canvas { width:100%; height:100%; display:block; outline:none; }
    .ar-hero-text { position:absolute; left:28px; top:25px; pointer-events:none; text-shadow:0 2px 20px #0009; }
    .ar-hero-text h1 { font-size:clamp(28px,4vw,48px); line-height:1.1; font-weight:750; letter-spacing:-.035em; margin:12px 0; color:#f2f7f9; }
    .ar-hero-text p { font-size:11px; color:#b3c5cd; line-height:1.8; max-width:330px; margin:0; }
    .ar-scene-badge { position:absolute; top:22px; right:22px; font-size:9px; color:#b8d1d8; letter-spacing:.16em; padding:8px 10px; border:1px solid #819ca533; background:#121e2455; border-radius:4px; }
    .ar-task-info { display:flex; align-items:center; gap:24px; padding:22px 0; border-bottom:1px solid #343d43; }
    .ar-task-info>div:first-child { flex:1; }
    .ar-task-info h2 { margin:5px 0 7px; font-size:20px; font-weight:650; letter-spacing:-.025em; }
    .ar-task-info p { margin:0; color:#8c9da7; font-size:11px; line-height:1.8; }
    .ar-task-duration { display:flex; align-items:baseline; gap:6px; padding:0 22px; border-left:1px solid #3d484e; }
    .ar-task-duration strong { font-size:28px; font-weight:500; }
    .ar-task-duration span { color:#879da8; font-size:10px; }
    .ar-start { min-width:150px; }
    .ar-task-notes { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:22px; }
    .ar-panel { border:1px solid #354148; background:linear-gradient(135deg,#242d32,#20262a); border-radius:7px; padding:22px; }
    .ar-task-notes .ar-panel { position:relative; padding:19px 18px 16px 52px; }
    .ar-task-notes strong { font-size:11px; font-weight:600; }
    .ar-task-notes p { margin:8px 0 0; color:#8196a1; font-size:10px; line-height:1.9; }
    .ar-note-icon { position:absolute; top:18px; left:18px; color:#66c6cc; font-size:21px; }
    .ar-range-play,.ar-range-result { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; background:#161d21; }
    .ar-range-play .ar-scene,.ar-range-result .ar-scene { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
    .ar-hud { display:flex; position:absolute; top:0; left:0; right:0; align-items:center; justify-content:center; gap:1px; padding:20px 28px; pointer-events:none; background:linear-gradient(#0e161c88,transparent); }
    .ar-hud-name { margin-right:auto; min-width:145px; }
    .ar-hud-name strong { display:block; font-size:15px; font-weight:650; }
    .ar-hud-name>span { display:block; font-size:8px; letter-spacing:.2em; color:#a7bbc5; margin-top:6px; }
    .ar-hud-stat { min-width:125px; padding:9px 24px; text-align:left; font-variant-numeric:tabular-nums; }
    .ar-hud .ar-hud-stat { background:#14212a55; border:1px solid #8aa4b044; margin-right:5px; border-radius:4px; }
    .ar-hud-stat>span { display:block; text-transform:uppercase; color:#a2b9c6; font-size:9px; letter-spacing:.12em; margin-bottom:5px; }
    .ar-hud-stat strong { font-size:25px; color:#f6fafc; font-weight:550; letter-spacing:-.025em; }
    .ar-hud-pause { margin-left:auto; margin-right:0; background:#14212a66; color:#bcd0d9; border:1px solid #8aa4b055; border-radius:5px; padding:10px 12px; pointer-events:auto; cursor:pointer; }
    .ar-crosshair { position:absolute; left:50%; top:50%; width:18px; height:18px; transform:translate(-50%,-50%); pointer-events:none; filter:drop-shadow(0 0 1px #000); }
    .ar-crosshair.cross:before,.ar-crosshair.cross:after { content:''; position:absolute; background:#e1fff7; }
    .ar-crosshair.cross:before { width:2px; height:14px; left:8px; top:2px; }
    .ar-crosshair.cross:after { height:2px; width:14px; left:2px; top:8px; }
    .ar-crosshair.dot { width:4px; height:4px; border-radius:50%; background:#d9fff5; box-shadow:0 0 0 1px #14242a; }
    .ar-crosshair.ring { width:15px; height:15px; border:2px solid #d9fff5; border-radius:50%; }
    .ar-countdown { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:15px; pointer-events:none; }
    .ar-countdown>span { letter-spacing:.25em; font-size:12px; color:#d2e4eb; }
    .ar-countdown strong { font-size:100px; line-height:1; color:white; font-weight:400; text-shadow:0 5px 50px #0008; }
    .ar-game-help { position:absolute; bottom:25px; left:28px; color:#adc0c9; font-size:10px; letter-spacing:.06em; }
    .ar-online-progress { position:absolute; top:120px; left:28px; width:230px; pointer-events:none; padding:8px 12px; border:1px solid #a9c3d333; border-radius:5px; background:#14232b99; }
    .ar-online-progress .at-players { gap:4px; }
    .ar-online-progress .at-player { padding:5px 7px; min-height:0; border:0; background:transparent; font-size:10px; }
    .ar-online-progress .at-player-value { font-size:11px; }
    .ar-ghost-strip { position:absolute; bottom:23px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:18px; padding:10px 20px; border:1px solid #9fb3bd33; background:#12202b88; border-radius:4px; font-size:10px; color:#bfd2df; }
    .ar-ghost-strip strong { color:white; font-size:15px; }
    .ar-reaction-wait { position:absolute; top:36%; left:50%; transform:translateX(-50%); color:#d0dfe7; font-size:13px; pointer-events:none; }
    .ar-pause-overlay { position:absolute; inset:0; background:#091118bb; backdrop-filter:blur(8px); display:grid; place-items:center; z-index:3; }
    .ar-pause-card { width:min(460px,90%); padding:40px; border:1px solid #4c5e68; border-radius:9px; background:#1c272fef; text-align:center; box-shadow:0 30px 70px #0005; }
    .ar-pause-card h2 { font-size:32px; font-weight:600; margin:18px 0 12px; }
    .ar-pause-card p { color:#98afbc; font-size:12px; line-height:1.8; }
    .ar-pause-card button { display:block; width:100%; margin-top:12px; }
    .ar-error { margin:12px 0; color:#ffb496; font-size:12px; line-height:1.7; padding:10px 14px; background:#78351d33; border-radius:4px; }
    .ar-results { position:absolute; inset:0; overflow:auto; padding:38px 5%; background:linear-gradient(115deg,#171f25f9,#1d282ef5); }
    .ar-result-top h2 { color:#b3c6d1; font-size:17px; margin:10px 0; font-weight:500; }
    .ar-result-score { font-size:72px; font-weight:600; color:#88e9e8; line-height:1.2; letter-spacing:-.04em; }
    .ar-result-score small { font-size:15px; margin-left:14px; color:#8faebd; letter-spacing:0; font-weight:400; }
    .ar-result-stats { display:flex; gap:10px; border-top:1px solid #38464f; border-bottom:1px solid #38464f; margin:22px 0; padding:12px 0; }
    .ar-result-stats .ar-hud-stat { flex:1; padding-left:0; }
    .ar-result-charts { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .ar-panel h3 { margin:0 0 14px; font-size:12px; font-weight:500; color:#c2d0d8; }
    .ar-trend { display:block; height:130px; width:100%; overflow:visible; }
    .ar-chart-empty { height:130px; display:grid; place-items:center; color:#677b88; }
    .ar-result-actions { display:flex; gap:12px; justify-content:flex-end; align-items:center; margin-top:25px; }
    .ar-result-actions>span { margin-right:auto; }
    .ar-muted { font-size:11px; line-height:1.8; color:#8ca1af; }
    .ar-settings-page { max-width:900px; margin:auto; padding:40px; }
    .ar-page-heading { margin-bottom:28px; }
    .ar-page-heading h2 { font-size:30px; margin:10px 0; letter-spacing:-.03em; }
    .ar-page-heading p { margin:0; color:#8ca1af; font-size:12px; line-height:1.8; }
    .ar-settings { padding:26px; background:#20282e; border:1px solid #37454f; border-radius:8px; }
    .ar-section-label { font-size:10px; letter-spacing:.15em; color:#78d7dc; margin:2px 0 24px; padding-top:15px; }
    .ar-setting { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; margin-bottom:24px; font-size:12px; color:#c6d3dc; }
    .ar-setting strong { color:#89cbd1; font-size:11px; font-variant-numeric:tabular-nums; }
    .ar-setting input { grid-column:1/-1; width:100%; accent-color:#49d4d9; cursor:pointer; }
    .ar-setting select { background:#172128; color:#c6d3dc; border:1px solid #4b616f; border-radius:4px; padding:8px; }
    .ar-toggle { display:flex; justify-content:space-between; align-items:center; font-size:12px; margin:18px 0; color:#c6d3dc; }
    .ar-toggle input { accent-color:#49d4d9; width:17px; height:17px; }
    .ar-record-page { padding:34px 40px; }
    .ar-record-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
    .ar-best-number { display:block; font-size:42px; color:#c9f2f2; font-weight:500; margin:18px 0; }
    .ar-best-number small { font-size:15px; color:#809cae; }
    .ar-history { margin-top:25px; }
    .ar-history table { width:100%; border-collapse:collapse; text-align:left; font-size:11px; }
    .ar-history th { color:#7896a9; font-weight:500; padding:10px 8px; }
    .ar-history td { padding:12px 8px; border-top:1px solid #394851; color:#b5c8d3; }
    .ar-legacy { padding:20px 0; font-size:10px; color:#6d8a9b; line-height:1.8; }
    .ar-empty-records { text-align:center; padding:40px; margin-top:24px; color:#8ca5b3; }
    .ar-empty-records>span { font-size:35px; color:#52cbd2; }
    .ar-empty-records h3 { margin:15px 0; }
    .ar-empty-records p { font-size:12px; }
    .at-vs { max-width:880px; margin:0 auto; padding:30px; gap:15px; }
    .at-vs:has(.ar-range-play) { position:static; }
    .at-input { background:#222d35; border-color:#435866; color:#d0e1eb; padding:12px; border-radius:5px; min-height:42px; }
    .at-label,.at-note,.at-status,.at-record { color:#8fa6b5; }
    .at-player,.at-codebox,.at-duel-line,.at-banner { background:#232e36; border-color:#3b515e; color:#ccdde7; border-radius:6px; }
    .at-player-name,.at-player-value,.at-code,.at-record strong,.at-duel-line strong { color:#dae7ed; }
    .at-chip { border-color:#3f6169; color:#9ebbc9; }
    .at-chip.at-on { color:#76e7ce; }
    .at-modes.at-two { display:grid; grid-template-columns:1fr 1fr; }
    .at-modes.at-two .at-mode { display:block; text-align:center; min-height:44px; }
    .at-launch { background:#202a31; border-color:#43545e; color:#6fe0e1; }
    @container (max-width:900px) {
     .at-training-shell { grid-template-columns:165px minmax(0,1fr); }
     .at-main-training { padding:20px; }
     .at-sidebar { padding:20px 9px; }
     .at-app-nav { margin-left:8px; }
     .at-app-nav .at-tab { padding:0 11px; }
     .at-brand b { font-size:14px; }
     .ar-task-duration { display:none; }
     .ar-task-notes { gap:10px; }
     .ar-hud-name { min-width:100px; }
     .ar-hud-stat { min-width:90px; padding:8px 15px; }
     .ar-record-page { padding:25px; }
    }
    @container (max-width:620px) {
     .at-bar { padding:0 10px; gap:6px; min-height:54px; }
     .at-brand svg { width:23px; height:23px; }
     .at-brand b { font-size:12px; }
     .at-brand small,.at-version,.at-side-bottom,.ar-scene-badge,.ar-task-notes { display:none; }
     .at-app-nav { margin-left:0; }
     .at-app-nav .at-tab { padding:0 7px; font-size:10px; min-height:50px; }
     .at-app-nav .at-tab[aria-selected="true"]:after { left:7px; right:7px; }
     .at-bar .at-ico { width:23px; height:23px; }
     .at-training-shell { grid-template-columns:1fr; }
     .at-sidebar { border-right:0; border-bottom:1px solid #343d43; padding:12px; }
     .at-side-label { display:none; }
     .at-modes { flex-direction:row; }
     .at-mode { flex:1; min-height:50px; padding:8px; font-size:10px; justify-content:center; }
     .at-mode svg,.at-mode small,.at-mode[aria-pressed="true"]:before { display:none; }
     .at-main-training { padding:16px; }
     .ar-range .ar-scene { height:260px; }
     .ar-range-play .ar-scene,.ar-range-result .ar-scene { height:100%; }
     .ar-hero-text { left:20px; top:22px; }
     .ar-hero-text h1 { font-size:32px; }
     .ar-hero-text p { max-width:230px; font-size:10px; }
     .ar-task-info { gap:10px; padding:18px 0; }
     .ar-task-info h2 { font-size:17px; }
     .ar-task-info p { font-size:10px; }
     .ar-start { min-width:110px; padding:12px 14px; }
     .ar-hud { gap:0; padding:12px 10px; }
     .ar-hud-name { display:none; }
     .ar-hud-stat { min-width:72px; flex:1; padding:8px 12px; }
     .ar-hud-stat strong { font-size:22px; }
     .ar-hud-stat>span { font-size:8px; }
     .ar-hud-pause { margin-left:5px; }
     .ar-game-help { left:15px; bottom:15px; }
     .ar-online-progress { top:93px; left:15px; width:180px; padding:5px 8px; }
     .ar-ghost-strip { bottom:45px; white-space:nowrap; padding:8px 12px; }
     .ar-results { padding:28px 20px; }
     .ar-result-score { font-size:55px; }
     .ar-result-charts { gap:12px; }
     .ar-result-charts .ar-panel { padding:14px; }
     .ar-trend,.ar-chart-empty { height:90px; }
     .ar-result-stats { gap:0; }
     .ar-result-stats .ar-hud-stat { padding:8px 4px; min-width:0; }
     .ar-result-stats .ar-hud-stat strong { font-size:20px; }
     .ar-result-actions { flex-wrap:wrap; }
     .ar-result-actions>span { flex-basis:100%; }
     .ar-record-grid { grid-template-columns:1fr; }
     .ar-settings-page,.ar-record-page { padding:22px 16px; }
     .ar-history { overflow:auto; }
     .at-footer { font-size:8px; }
    }
    @container (max-width:420px) {
     .at-brand b { display:none; }
     .at-brand { gap:0; }
     .at-bar { gap:4px; }
     .at-app-nav .at-tab { padding:0 6px; }
    }
    @media(prefers-reduced-motion:reduce) { .at-win * { scroll-behavior:auto; } }
    `;

    // ---- src/trainer.js ----
    const h = React.createElement;
    const NS = 'aim-trainer';
    const REC_KEY = RANGE_RECORDS_KEY;
    const POS_KEY = 'aim-trainer:3d:panel:v1';
    const NAME_KEY = 'aim-trainer:name:v1';
    const PID_KEY = 'aim-trainer:player:v1';
    const WIDTH = 1040;
    const HEIGHT = 780;
    const SIZE_KEY = 'aim-trainer:3d:size:v1';
    const { RangeGame, RangeSettings, RangeRecords } = createRange(React);

    const DICTS = {
      en: {
        brandTagline: 'PRECISION TRAINING', settingsTab: 'Settings', settingsHint: 'Tune your controls and the look of your range.',
        trainingLibrary: 'TRAINING LIBRARY', localTraining: 'Your personal range', localTrainingHint: 'Train at your own pace. Completed solo sessions stay in this browser.',
        gridshot: 'GRIDSHOT', reactionTask: 'REFLEX SHOT', trackingTask: 'SPHERE TRACK',
        clickCategory: 'Precision & speed', reactionCategory: 'Reaction & timing', trackCategory: 'Control & consistency',
        clickHint3d: 'Move your view to bring each sphere into the centre crosshair. Left-click to fire. Keep a steady rhythm across all three targets.',
        reactionHint3d: 'Wait for the sphere to appear, then move your view and fire. Only hits count toward your reaction time.',
        trackHint3d: 'Move your view to keep the centre crosshair on the moving sphere. Stay on target for as much of the session as possible.',
        mouseLookHint: 'Mouse to look · Left-click to fire · Esc to pause',
        focusTitle: 'Build control', improveTitle: 'Measure your progress', improveHint: 'Stay precise before increasing speed. Compare your completed sessions in Records.',
        sensitivity: 'Mouse sensitivity', fieldOfView: 'Field of view', settingsControls: 'CONTROLS', settingsPresentation: 'PRESENTATION',
        sensitivityHint: 'Sensitivity is measured in degrees per mouse pixel. These settings are shared by all three tasks and saved in this browser.',
        sceneLabel: 'Three-dimensional aim training range', pause: 'Pause and release mouse', paused: 'Training paused',
        pauseHint: 'Your training clock is paused. Continue to capture the mouse and return to the range.',
        inputReleased: 'Mouse released', onlineClockContinues: 'This is an online match. The match clock keeps running while your mouse is released.',
        resumeTraining: 'Continue training', backToTasks: 'Back to tasks', escapePause: 'ESC  ·  Release mouse / pause', waitForTarget: 'Wait for the target…',
        webglUnavailable: 'This browser could not start WebGL. Enable hardware graphics or try a supported browser, then retry.',
        webglLost: 'The graphics context was lost. Retry graphics to restore the range.',
        pointerLockUnavailable: 'Mouse capture is unavailable here. Open the plugin in a browser that supports Pointer Lock.',
        pointerLockFailed: 'Mouse capture failed. Click Continue or Start again to retry.', retryGraphics: 'Retry graphics',
        sessionComplete: 'SESSION COMPLETE', sessionTrend: 'This session', recentRuns: 'Recent sessions',
        score: 'Score', duration: 'Duration', targetsHit: 'Hits / shots', averageHitTime: 'Average time per hit', onTargetTime: 'Time on target', fastestReaction: 'Fastest reaction',
        savedLocally: 'Saved in this browser', historyHint: 'Complete a training session to build your own performance history.',
        saveFailed: 'Could not save this session. Your browser storage may be full or unavailable.', ghostSaveFailed: 'Could not save the new ghost.',
        completedRuns: 'completed sessions', trainingTask: 'Training task', date: 'Date', legacyRecords: 'Previous 2D records',
        updateTitle: 'Plugin updates', currentVersion: 'Current version', latestVersion: 'Latest on GitHub',
        checkUpdates: 'Check for updates', checkingUpdates: 'Checking…', updateAvailable: 'A newer version is available.',
        updateCurrent: 'You are up to date.', updateAhead: 'This local version is newer than GitHub.',
        updateFailed: 'Check failed. Verify your connection to GitHub and retry.',
        updateSteps: 'Copy the address below. In the Plugins page, remove Aim Trainer, then use Install to install this address. Refresh the page afterwards. All players should update and create a new room.',
        updateCopy: 'Copy installation address', updateCopyFailed: 'Copy failed. Select and copy the address below.',
        updateSource: 'View checked commit', updatePrivacy: 'Checks GitHub only when clicked. Does not install automatically.',
        updateLocalHint: 'Local Git clone: run git pull in its directory instead, then refresh the page.',
        title: 'Aim Trainer', open: 'Open Aim Trainer', close: 'Close',
        center: 'Centre window', drag: 'Drag to move',
        feelSound: 'Sound', feelCrosshair: 'Crosshair', feelGun: 'Weapon view', feelEffects: 'Hit effects',
        feelCross: 'Cross', feelDot: 'Dot', feelRing: 'Ring',
        rangeTitle: 'Precision range', rangeSubtitle: 'Find your rhythm. Make every shot count.',
        shortcuts: 'Space · Start    Esc · Pause / release mouse', resize: 'Resize window', expand: 'Expand / restore',
        resizeHint: 'Drag the corner to resize; arrow keys when focused.',
        trainTab: 'Drills', recordTab: 'Records',
        click: 'Click', reaction: 'Reaction', track: 'Tracking',
        start: 'Start drill', again: 'Run it again',
        clickHint: 'Hit every target. Background clicks lower your accuracy.',
        reactionHint: 'Wait for the target, then click it as fast as you can.',
        trackHint: 'Keep the centre crosshair on the moving target until time runs out.',
        hits: 'Hits', accuracy: 'Accuracy', timeLeft: 'Time left', round: 'Round',
        clickBest: 'Most hits', reactionBest: 'Fastest average', trackBest: 'Best on target',
        noRecord: 'No record yet', done: 'Drill over', ready: 'Get ready', now: 'Now!',
        early: 'Too soon — wait for the target.', timeUp: 'Time is up.',
        ms: 'ms', sec: 's', newRecord: 'New record',
        ghost: 'Ghost opponent', ghostHint: 'Race the pace of your best completed click run. Target positions are random.',
        ghostEmpty: 'Finish a click drill to record your first ghost.', ghostSaved: 'New ghost saved for next time.',
        ghostStorage: 'Ghost recording is unavailable. Check browser storage.',
        ghostAhead: 'Ahead by', ghostBehind: 'Behind by', ghostTied: 'Tied with ghost', ghostBest: 'Ghost final score',
        versusTab: 'Versus',
        nameLabel: 'Your name', codeLabel: 'Room code',
        createRoom: 'Create room', joinRoom: 'Join room', connect: 'Connect',
        joinHint: 'Paste the whole code your friend sends, relay letter included (e.g. ABC234-E).',
        relayHint: 'The last letter names the relay. Send the whole code.',
        connecting: 'Connecting to the relay…', online: 'Relay', latency: 'Latency',
        copyCode: 'Copy code', copied: 'Copied', leaveRoom: 'Leave room',
        waitingFriend: 'Waiting for a friend to join…', rivalJoined: 'Rival joined',
        hostTag: 'Host', youTag: 'You', readyChip: 'Ready', waitingChip: 'Not ready',
        readyButton: 'Ready up', unready: 'Stand down', startMatch: 'Start match',
        needReady: 'At least 2 players must join, and all online players must be ready.', matchIn: 'Starts in',
        roomSize: 'Players', roomHint: '2–5 players. The host starts when everyone is ready.',
        reactionRounds: 'Reaction rounds', roundsHint: 'The host chooses 5–20 rounds before starting.',
        rank: 'Rank', leaderboard: 'Standings', completed: 'Finished', withdrawn: 'Withdrew', playerOffline: 'Offline',
        hostLeft: 'The host has left. Leave this room and create or join another.',
        roomFull: 'This room already has 5 players.', matchInProgress: 'A match is in progress. Join when the room returns to the lobby.',
        versionMismatch: 'Room versions differ. All players must update to the same version.',
        you: 'You', rival: 'Rival', youWin: 'You win', youLose: 'You lose', draw: 'Draw',
        rematch: 'Rematch', waitingHost: 'Waiting for the host…', results: 'Result',
        offline: 'Relay connection lost.', roomMissing: 'No live room with that code yet.',
        relayUnreachable: 'Cannot reach the relay that hosts this room. Check your network and try again.',
        unknownRelay: 'That relay letter is not recognised. Ask the host to share the code again.',
        connectTimeout: 'Timed out reaching the relay. Check your network and try again.',
        codeUnavailable: 'No free room code right now. Please try again.',
        webSocketUnavailable: 'This environment cannot open a WebSocket, so multiplayer is unavailable.',
        badCode: 'That room code looks incomplete. Check all characters and try again.',
        cancel: 'Back', syncHint: 'Clock sync in progress…',
        backToRoom: 'Back to room', waitingResult: 'Score submitted. Waiting for the other players…',
        requestRematch: 'Request rematch', rematchRequested: 'Rematch requested',
        rivalWantsRematch: 'A player requested a rematch.',
        clickRule: 'More hits wins. Equal hits is a draw.',
        reactionRule: 'Lower average reaction time wins. Equal times is a draw.',
      },
      zh: {
        brandTagline: '精准瞄准训练', settingsTab: '设置', settingsHint: '调整操作手感和训练场的呈现方式。',
        trainingLibrary: '训练项目', localTraining: '你的专属训练场', localTrainingHint: '按自己的节奏训练。单人训练成绩保存在当前浏览器。',
        gridshot: '三点速射', reactionTask: '反应射击', trackingTask: '动态跟枪',
        clickCategory: '精准度与速度', reactionCategory: '反应与时机', trackCategory: '控制与稳定',
        clickHint3d: '移动鼠标转动视角，让球靶进入中央准星，按左键射击。在三个目标之间保持稳定的命中节奏。',
        reactionHint3d: '等待球靶出现，再转动视角并射击。成功命中后记录本轮反应时间。',
        trackHint3d: '移动鼠标转动视角，让中央准星持续跟随移动球靶，尽可能延长瞄准目标的时间。',
        mouseLookHint: '鼠标转动视角 · 左键射击 · Esc 暂停',
        focusTitle: '练习稳定控制', improveTitle: '看见训练进步', improveHint: '先保证精准，再逐渐提速。在记录页对比每次完成的训练。',
        sensitivity: '鼠标灵敏度', fieldOfView: '视野角度', settingsControls: '操作设置', settingsPresentation: '画面与声音',
        sensitivityHint: '灵敏度单位为每像素鼠标移动对应的视角度数。这些设置适用于全部训练项目，并保存在当前浏览器。',
        sceneLabel: '三维瞄准训练场', pause: '暂停并释放鼠标', paused: '训练已暂停',
        pauseHint: '训练计时已暂停。点击继续后将重新锁定鼠标，返回训练场。',
        inputReleased: '鼠标已释放', onlineClockContinues: '当前为联机对战。释放鼠标期间，对局计时仍会继续。',
        resumeTraining: '继续训练', backToTasks: '返回训练项目', escapePause: 'ESC  ·  释放鼠标 / 暂停', waitForTarget: '等待球靶出现…',
        webglUnavailable: '浏览器未能启动 WebGL。请启用硬件图形加速，或换用支持的浏览器后重试。',
        webglLost: '图形上下文已丢失。请重新初始化画面，恢复训练场。',
        pointerLockUnavailable: '当前环境不支持鼠标锁定。请在支持 Pointer Lock 的浏览器中打开插件。',
        pointerLockFailed: '未能锁定鼠标。请再次点击继续或开始重试。', retryGraphics: '重新初始化画面',
        sessionComplete: '本次训练完成', sessionTrend: '本局表现', recentRuns: '最近训练',
        score: '成绩', duration: '训练时长', targetsHit: '命中 / 射击', averageHitTime: '平均命中耗时', onTargetTime: '瞄准目标时间', fastestReaction: '最快单次反应',
        savedLocally: '已保存在当前浏览器', historyHint: '完成一次训练，即可开始积累自己的成绩记录。',
        saveFailed: '本局未能保存，请检查浏览器存储空间或权限。', ghostSaveFailed: '新幽灵未能保存。',
        completedRuns: '次已完成训练', trainingTask: '训练项目', date: '时间', legacyRecords: '原二维训练成绩',
        updateTitle: '插件更新', currentVersion: '当前版本', latestVersion: 'GitHub 最新版本',
        checkUpdates: '检查更新', checkingUpdates: '正在检查…', updateAvailable: '发现新版本。',
        updateCurrent: '已是最新版本。', updateAhead: '当前本地版本比 GitHub 更新。',
        updateFailed: '检查失败，请确认能访问 GitHub 后重试。',
        updateSteps: '复制下方地址，在插件页面移除「瞄准训练」，再通过「安装」填入此地址。安装后刷新页面。所有玩家都更新后，请重新创建房间。',
        updateCopy: '复制安装地址', updateCopyFailed: '复制失败，请手动选中并复制下方地址。',
        updateSource: '查看本次检查的提交', updatePrivacy: '点击时才访问 GitHub，不会自动安装。',
        updateLocalHint: '如果通过本地 Git 克隆安装，在克隆目录执行 git pull 后刷新即可。',
        title: '瞄准训练', open: '打开瞄准训练', close: '关闭',
        center: '窗口回到中间', drag: '拖动移动窗口',
        feelSound: '音效', feelCrosshair: '准星', feelGun: '枪械视角', feelEffects: '命中特效',
        feelCross: '十字', feelDot: '圆点', feelRing: '圆环',
        rangeTitle: '精准训练场', rangeSubtitle: '找到节奏，让每一次命中都更稳。',
        shortcuts: '空格 · 开始    Esc · 暂停 / 释放鼠标', resize: '调整窗口大小', expand: '放大 / 还原',
        resizeHint: '拖动右下角缩放；聚焦后可用方向键调整。',
        trainTab: '训练', recordTab: '记录',
        click: '点击', reaction: '反应', track: '跟枪',
        start: '开始训练', again: '再来一局',
        clickHint: '打中出现的靶子，点空白处会拉低命中率。',
        reactionHint: '等靶子出现，尽快点中它。',
        trackHint: '让中央准星持续跟随移动球靶，直到时间结束。',
        hits: '命中', accuracy: '命中率', timeLeft: '剩余', round: '回合',
        clickBest: '最高命中', reactionBest: '最快平均反应', trackBest: '最佳跟枪',
        noRecord: '还没有记录', done: '训练结束', ready: '准备', now: '点它！',
        early: '太早了，等靶子出现。', timeUp: '时间到。',
        ms: '毫秒', sec: '秒', newRecord: '新纪录',
        ghost: '幽灵对手', ghostHint: '跟自己最好一局的命中节奏竞速，靶子位置仍随机生成。',
        ghostEmpty: '完成一局点击训练，就能录下你的第一个幽灵。', ghostSaved: '已保存新幽灵，下局即可挑战。',
        ghostStorage: '无法保存幽灵记录，请检查浏览器存储设置。',
        ghostAhead: '领先', ghostBehind: '落后', ghostTied: '与幽灵持平', ghostBest: '幽灵最终成绩',
        versusTab: '对战',
        nameLabel: '你的昵称', codeLabel: '房间码',
        createRoom: '创建房间', joinRoom: '加入房间', connect: '连接',
        joinHint: '粘贴好友发来的完整房间码，末尾的中继字母也要带上，例如 ABC234-E。',
        relayHint: '末位字母代表中继，转发时请整串发送。',
        connecting: '正在连接中继…', online: '中继', latency: '延迟',
        copyCode: '复制房间码', copied: '已复制', leaveRoom: '离开房间',
        waitingFriend: '等待好友加入…', rivalJoined: '对手已加入',
        hostTag: '房主', youTag: '你', readyChip: '已准备', waitingChip: '未准备',
        readyButton: '准备', unready: '取消准备', startMatch: '开始对战',
        needReady: '至少 2 人加入，且所有在线玩家准备好才能开始。', matchIn: '倒计时',
        roomSize: '房间人数', roomHint: '2～5 人，所有人准备后由房主开局。',
        reactionRounds: '反应赛轮数', roundsHint: '房主可在开局前选择 5～20 轮。',
        rank: '名次', leaderboard: '排行榜', completed: '已完成', withdrawn: '已退出', playerOffline: '已离线',
        hostLeft: '房主已离开，请退出后创建或加入其他房间。',
        roomFull: '房间已满，最多 5 人。', matchInProgress: '对局正在进行，请等房间返回大厅后再加入。',
        versionMismatch: '房间版本不一致，请所有玩家更新到相同版本。',
        you: '你', rival: '对手', youWin: '你赢了', youLose: '你输了', draw: '平局',
        rematch: '再来一局', waitingHost: '等待房主开始…', results: '结果',
        offline: '中继连接已断开。', roomMissing: '还没有这个房间码的对局。',
        relayUnreachable: '连不上房主所在的中继，请检查网络后重试。',
        unknownRelay: '房间码里的中继标识无法识别，请让房主重新分享。',
        connectTimeout: '连接中继超时，请检查网络后重试。',
        codeUnavailable: '暂时找不到空闲房间码，请再试一次。',
        webSocketUnavailable: '当前环境不支持 WebSocket，无法联机。',
        badCode: '房间码不完整，请检查后重试。',
        cancel: '返回', syncHint: '正在同步时钟…',
        backToRoom: '返回房间', waitingResult: '成绩已提交，等待其他玩家完成…',
        requestRematch: '请求再来一局', rematchRequested: '已请求重开',
        rivalWantsRematch: '有玩家请求再来一局。',
        clickRule: '命中数多者获胜，命中数相同则平局。',
        reactionRule: '平均反应时间短者获胜，时间相同则平局。',
      },
    };

    const CSS = `
      .at-root { position:fixed; right:70px; top:74px; z-index:46; pointer-events:none; }
      .at-root * { box-sizing:border-box; }
      .at-launch { pointer-events:auto; display:grid; place-items:center; width:46px; height:46px; margin-left:auto; border:1px solid; border-radius:8px; box-shadow:0 5px 16px #0003; cursor:pointer; font-size:23px; }
      .at-launch svg { width:26px; height:26px; }
      .at-win { pointer-events:auto; position:fixed; z-index:61; display:flex; flex-direction:column; max-height:calc(100dvh - 16px); outline:none; }
      .at-bar { display:flex; align-items:center; flex-shrink:0; cursor:grab; user-select:none; touch-action:none; }
      .at-bar.at-drag { cursor:grabbing; }
      .at-spacer { flex:1; }
      .at-ico { display:grid; place-items:center; padding:0; font-size:15px; cursor:pointer; flex-shrink:0; }
      .at-tab { border:0; font:inherit; cursor:pointer; }
      .at-mode { font:inherit; cursor:pointer; }
      .at-content { overscroll-behavior:contain; scrollbar-width:thin; }
      .at-footer { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; font-size:10px; }
      .at-resize { width:30px; height:25px; padding:0; border:0; background:transparent; cursor:nwse-resize; touch-action:none; }
      .at-vs { display:flex; flex-direction:column; }
      .at-field { display:flex; flex-direction:column; gap:6px; }
      .at-label { font-size:10px; letter-spacing:.1em; }
      .at-input { width:100%; font:inherit; font-size:12px; }
      .at-row { display:flex; gap:10px; }
      .at-row > * { flex:1; }
      .at-codebox { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border:1px solid; }
      .at-code { font-size:26px; font-weight:700; letter-spacing:.2em; font-variant-numeric:tabular-nums; }
      .at-ghost { cursor:pointer; }
      .at-players { display:flex; flex-direction:column; border:1px solid #3b515e; border-radius:6px; overflow:hidden; }
      .at-player { display:flex; align-items:center; gap:8px; padding:12px; font-size:12px; }
      .at-player + .at-player { border-top:1px solid #3b515e; }
      .at-player-name { flex:1; min-width:0; overflow-wrap:anywhere; font-weight:600; }
      .at-player-value { font-variant-numeric:tabular-nums; white-space:nowrap; }
      .at-rank { width:24px; color:#48d2d7; font-weight:700; text-align:center; }
      .at-chip { padding:3px 7px; border:1px solid; border-radius:3px; font-size:9px; letter-spacing:.08em; }
      .at-chip.at-on { background:#173b36; }
      .at-duel-line { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid; font-size:11px; }
      .at-duel-line strong { font-size:15px; font-variant-numeric:tabular-nums; }
      .at-count-big { display:grid; place-items:center; gap:6px; min-height:200px; }
      .at-count-num { color:#c4f4f3; font-size:74px; font-weight:700; font-variant-numeric:tabular-nums; }
      .at-banner { display:grid; place-items:center; gap:6px; padding:20px; border:1px solid; text-align:center; }
      .at-banner-big { font-size:26px; font-weight:700; }
      .at-note { margin:0; font-size:11px; line-height:1.7; }
      @media (max-width:600px) { .at-root { right:62px; top:62px; } }
    `;

    function readRecords() {
      const empty = { click: null, reaction: null, track: null };
      let raw = {};
      try {
        raw = JSON.parse(window.localStorage.getItem(REC_KEY) || '{}');
      } catch (_) { /* Recover available bests from valid history. */ }
      const history = readRunHistory();
      for (const key of Object.keys(empty)) empty[key] = bestRunScore(key, raw, history);
      const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      if (Object.keys(empty).some((key) => empty[key] !== null && empty[key] !== stored[key])) {
        try { window.localStorage.setItem(REC_KEY, JSON.stringify(empty)); } catch (_) { /* Recovered bests remain available this session. */ }
      }
      return empty;
    }

    function fitSize(width, height) {
      const maxW = Math.max(240, window.innerWidth - 16);
      const maxH = Math.max(280, window.innerHeight - 16);
      return { width: Math.min(maxW, Math.max(Math.min(460, maxW), width)), height: Math.min(maxH, Math.max(Math.min(520, maxH), height)) };
    }
    function loadSize() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(SIZE_KEY) || 'null');
        if (raw && Number.isFinite(raw.width) && Number.isFinite(raw.height)) return raw.expanded ? fitSize(window.innerWidth - 16, window.innerHeight - 16) : fitSize(raw.width, raw.height);
      } catch (_) { /* Use defaults. */ }
      return fitSize(window.innerWidth - 16, window.innerHeight - 16);
    }

    function loadPosition() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(POS_KEY) || 'null');
        if (raw && Number.isFinite(raw.left) && Number.isFinite(raw.top)) return { left: raw.left, top: raw.top };
      } catch (_) { /* Fall back to the centred default. */ }
      return null;
    }

    function defaultPosition() {
      const size = loadSize();
      return { left: Math.max(8, Math.round((window.innerWidth - size.width) / 2)), top: Math.max(8, Math.round((window.innerHeight - size.height) / 2)) };
    }

    function isExpanded(size) {
      return size.width >= window.innerWidth - 18 && size.height >= window.innerHeight - 18;
    }

    function clampToViewport(left, top, width, height) {
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      return {
        left: Math.min(Math.max(8, left), maxLeft),
        top: Math.min(Math.max(8, top), maxTop),
      };
    }

    function ClickGame(props) { return h(RangeGame, { ...props, mode: 'click' }); }
    function ReactionGame(props) { return h(RangeGame, { ...props, mode: 'reaction' }); }
    function TrackGame(props) { return h(RangeGame, { ...props, mode: 'track' }); }

    function tabPlayerId() {
      try {
        const existing = window.sessionStorage.getItem(PID_KEY);
        if (existing) return existing;
        const created = newPlayerId();
        window.sessionStorage.setItem(PID_KEY, created);
        return created;
      } catch (_) {
        return newPlayerId();
      }
    }

    function readName() {
      try { return window.localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; }
    }

    function saveName(value) {
      try { window.localStorage.setItem(NAME_KEY, value); } catch (_) { /* session only */ }
    }

    function useTicker(active, step = 200) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        if (!active) return undefined;
        const id = window.setInterval(() => setNow(Date.now()), step);
        return () => window.clearInterval(id);
      }, [active, step]);
      return now;
    }

    function useVersus() {
      const [stage, setStage] = React.useState('idle');
      const [error, setError] = React.useState('');
      const [status, setStatus] = React.useState({ phase: 'idle', broker: '' });
      const [snap, setSnap] = React.useState(null);
      const [name, setName] = React.useState(readName);
      const linkRef = React.useRef(null);
      const nameRef = React.useRef(name);
      nameRef.current = name;

      const sync = React.useCallback(() => {
        const link = linkRef.current;
        if (!link) return;
        const room = link.room;
        setSnap({
          code: link.code,
          shareCode: link.shareCode || link.code,
          broker: link.broker,
          role: room.role,
          hostId: room.state.hostId,
          me: room.playerId,
          phase: room.state.phase,
          players: room.state.players.map((player) => ({ ...player })),
          results: { ...room.state.results },
          mode: room.state.mode,
          seed: room.state.seed,
          startAt: room.state.startAt,
          matchId: room.state.matchId,
          rematchRequested: room.state.rematchRequested,
          durationMs: room.state.durationMs,
          offset: room.clock.offset,
          rtt: room.clock.rtt,
          rounds: room.state.rounds,
          participantIds: [...(room.state.participantIds || [])],
          progress: Object.fromEntries(Object.entries(room.progress || {}).map(([id, value]) => [id, { ...value }])),
        });
      }, []);

      const act = React.useCallback((fn) => {
        const link = linkRef.current;
        if (!link) return undefined;
        const value = fn(link.room);
        sync();
        return value;
      }, [sync]);

      const connect = React.useCallback(async (role, code) => {
        if (linkRef.current) { linkRef.current.close(); linkRef.current = null; }
        setStage('connecting');
        setError('');
        try {
          const link = await openRoom({
            role,
            code,
            name: (nameRef.current || '').trim() || 'Player',
            playerId: tabPlayerId(),
            onStatus: (next) => setStatus(next),
            onUpdate: sync,
          });
          linkRef.current = link;
          setStatus({ phase: 'online', broker: link.broker });
          setStage('room');
          sync();
        } catch (err) {
          setError(String((err && err.message) || err));
          setStage('error');
          setStatus({ phase: 'idle', broker: '' });
        }
      }, [sync]);

      const leave = React.useCallback(() => {
        if (linkRef.current) linkRef.current.close();
        linkRef.current = null;
        setSnap(null);
        setStage('idle');
        setStatus({ phase: 'idle', broker: '' });
        setError('');
      }, []);

      React.useEffect(() => () => { if (linkRef.current) linkRef.current.close(); }, []);

      return { stage, error, status, snap, name, setName, connect, leave, act };
    }

    function DuelGame({ vs, ...props }) {
      const report = (data) => ({
        score: data.score, hits: data.hits,
        misses: Math.max(0, data.shots - data.hits), acc: data.accuracy,
      });
      return h(RangeGame, {
        ...props, multiplayer: true,
        onLeave: vs.leave,
        statusPanel: h(MatchProgress, { snap: vs.snap, t: props.t }),
        onFinish: (_mode, _score, data) => vs.act((room) => room.finish(report(data))),
        onProgress: (data) => vs.act((room) => room.reportProgress(report(data))),
      });
    }
    function DuelClick(props) { return h(DuelGame, { ...props, mode: 'click' }); }
    function DuelReaction(props) { return h(DuelGame, { ...props, mode: 'reaction' }); }

    function matchPlayers(snap) {
      const ids = snap.participantIds;
      return ids && ids.length ? snap.players.filter((player) => ids.includes(player.id)) : snap.players;
    }

    function scoreText(result, mode, t) {
      if (!result) return '—';
      if (result.dnf || result.withdrawn) return t('withdrawn');
      return result.score + (mode === 'reaction' ? ' ' + t('ms') : '');
    }

    function MatchProgress({ snap, t }) {
      return h('div', { className: 'at-players', 'aria-label': t('leaderboard') },
        matchPlayers(snap).map((player) => {
          const result = snap.results[player.id];
          const progress = (snap.progress || {})[player.id];
          const value = result ? scoreText(result, snap.mode, t)
            : snap.mode === 'reaction' ? `${progress ? progress.hits : 0}/${snap.rounds || 8}`
              : progress ? progress.score : 0;
          return h('div', { key: player.id, className: 'at-player' },
            h('span', { className: 'at-player-name' }, `${player.name || player.id}${player.id === snap.me ? ' · ' + t('youTag') : ''}`),
            result && !result.dnf ? h('span', { className: 'at-chip at-on' }, t('completed')) : null,
            h('strong', { className: 'at-player-value' }, value),
          );
        }),
      );
    }

    function DuelResults({ vs, t }) {
      const snap = vs.snap;
      const participants = matchPlayers(snap);
      const lowerWins = snap.mode === 'reaction';
      const pending = participants.some((player) => !snap.results[player.id]);
      const entries = participants.map((player) => ({ player, result: snap.results[player.id] }));
      const valid = (entry) => Boolean(entry.result && !entry.result.dnf && !entry.result.withdrawn);
      entries.sort((a, b) => {
        if (valid(a) !== valid(b)) return valid(a) ? -1 : 1;
        if (!valid(a)) return 0;
        return lowerWins ? a.result.score - b.result.score : b.result.score - a.result.score;
      });
      let lastScore = null;
      let rank = 0;
      const ranked = entries.map((entry, index) => {
        if (!valid(entry)) return { ...entry, rank: null };
        if (lastScore !== entry.result.score) rank = index + 1;
        lastScore = entry.result.score;
        return { ...entry, rank };
      });
      const mine = ranked.find((entry) => entry.player.id === snap.me);
      const leaders = ranked.filter((entry) => entry.rank === 1);
      let verdict = t('results');
      if (!pending && mine) {
        verdict = mine.rank === 1 ? t(leaders.length > 1 ? 'draw' : 'youWin') : t('youLose');
      }
      const online = snap.players.filter((player) => player.online !== false && !player.withdrawn);
      const canRematch = online.length >= 2 && online.every((player) => player.ready);

      return h('div', { className: 'at-vs' },
        h('div', { className: 'at-banner' },
          h('span', { className: 'at-banner-big' }, verdict),
          mine && mine.rank ? h('span', { className: 'at-note' }, `${t('rank')} · ${mine.rank} / ${participants.length}`) : null,
          pending ? h('span', { className: 'at-note' }, t('waitingResult')) : null,
        ),
        h('p', { className: 'at-note' }, lowerWins ? t('reactionRule') : t('clickRule')),
        h('div', { className: 'at-players', 'aria-label': t('leaderboard') },
          ranked.map((entry) => h('div', { key: entry.player.id, className: 'at-player' },
            h('span', { className: 'at-rank' }, entry.rank || '—'),
            h('span', { className: 'at-player-name' }, `${entry.player.name || entry.player.id}${entry.player.id === snap.me ? ' · ' + t('youTag') : ''}`),
            h('strong', { className: 'at-player-value' }, scoreText(entry.result, snap.mode, t)),
          )),
        ),
        snap.role === 'host' && snap.rematchRequested ? h('p', { className: 'at-note' }, t('rivalWantsRematch')) : null,
        snap.role === 'host' && !canRematch ? h('p', { className: 'at-note' }, t('needReady')) : null,
        h('div', { className: 'at-row' },
          h('button', {
            className: 'at-primary',
            type: 'button',
            disabled: pending || (snap.role === 'host' ? !canRematch : snap.rematchRequested === snap.me),
            onClick: () => vs.act((room) => room.rematch()),
          }, snap.role === 'host' ? t('rematch') : snap.rematchRequested === snap.me ? t('rematchRequested') : t('requestRematch')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.act((room) => room.returnToLobby()) }, t('backToRoom')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        ),
      );
    }

    function VersusPanel({ vs, t, visible = true }) {
      const now = useTicker(true);
      const [codeInput, setCodeInput] = React.useState('');
      const [copied, setCopied] = React.useState(false);
      const snap = vs.snap;

      const me = snap ? snap.players.find((player) => player.id === snap.me) : null;
      const host = snap ? snap.players.find((player) => player.id === snap.hostId) : null;
      const startLocal = snap && snap.startAt ? snap.startAt - snap.offset : 0;
      const finished = Boolean(snap && snap.phase === 'finished');
      const submitted = Boolean(snap && snap.results[snap.me]);
      const playing = Boolean(snap && startLocal && now >= startLocal && !finished && !submitted);

      function copyCode() {
        const code = snap ? snap.shareCode || snap.code : '';
        if (!code) return;
        const done = () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        };
        try {
          navigator.clipboard.writeText(code).then(done, done);
        } catch (_) {
          done();
        }
      }

      if (vs.stage === 'connecting') {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, `${t('connecting')} ${vs.status.broker || ''}`),
        );
      }

      if (vs.stage !== 'room' || !snap) {
        return h('div', { className: 'at-vs' },
          h('label', { className: 'at-field' },
            h('span', { className: 'at-label' }, t('nameLabel')),
            h('input', {
              className: 'at-input',
              value: vs.name,
              maxLength: 16,
              onChange: (event) => { vs.setName(event.target.value); saveName(event.target.value); },
            }),
          ),
          h('button', { className: 'at-primary', type: 'button', onClick: () => vs.connect('host') }, t('createRoom')),
          h('label', { className: 'at-field' },
            h('span', { className: 'at-label' }, t('codeLabel')),
            h('input', {
              className: 'at-input',
              value: codeInput,
              maxLength: 10,
              placeholder: 'ABC234-E',
              onChange: (event) => setCodeInput(event.target.value.toUpperCase()),
            }),
          ),
          h('button', {
            className: 'at-ghost',
            type: 'button',
            disabled: parseInvite(codeInput).code.length !== 6,
            onClick: () => vs.connect('guest', parseInvite(codeInput).code ? codeInput : ''),
          }, t('joinRoom')),
          h('p', { className: 'at-note' }, vs.stage === 'error' ? ({
            'no-broker': t('offline'),
            'room-full': t('roomFull'),
            'match-in-progress': t('matchInProgress'),
            'app-mismatch': t('versionMismatch'),
            'room-not-found': t('roomMissing'),
            'relay-unreachable': t('relayUnreachable'),
            'unknown-relay': t('unknownRelay'),
            'connect-timeout': t('connectTimeout'),
            'room-code-unavailable': t('codeUnavailable'),
            'websocket-unavailable': t('webSocketUnavailable'),
            'bad-code': t('badCode'),
          }[vs.error] || vs.error) : t('joinHint')),
        );
      }

      if (host && host.online === false) {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, t('hostLeft')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (finished) return h(DuelResults, { vs, t });

      if (submitted) {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, vs.status.phase === 'offline' ? t('offline') : t('waitingResult')),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (playing) {
        return h('div', { className: 'at-vs' },
          snap.mode === 'reaction'
            ? h(DuelReaction, { key: snap.matchId, vs, t, visible, seed: snap.seed, rounds: snap.rounds || 8, startLocal })
            : h(DuelClick, { key: snap.matchId, vs, t, visible, seed: snap.seed, durationMs: snap.durationMs || 30000, startLocal }),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (snap.startAt) {
        const remain = Math.max(0, Math.ceil((startLocal - now) / 1000));
        return h('div', { className: 'at-vs' },
          h('div', { className: 'at-count-big' },
            h('span', { className: 'at-count-num' }, remain),
            h('span', { className: 'at-label' }, t('matchIn')),
          ),
          h('p', { className: 'at-note' }, `${t(snap.mode)}${snap.mode === 'reaction' ? ' · ' + snap.rounds + ' ' + t('round') : ''}`),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      const ready = Boolean(me && me.ready);
      const online = snap.players.filter((player) => player.online !== false && !player.withdrawn);
      const allReady = online.length >= 2 && online.every((player) => player.ready);

      return h('div', { className: 'at-vs' },
        h('div', { className: 'at-codebox' },
          h('div', null,
            h('div', { className: 'at-label' }, t('codeLabel')),
            h('div', { className: 'at-code' }, snap.shareCode || snap.code),
            h('div', { className: 'at-note' }, t('relayHint')),
          ),
          h('button', { className: 'at-ghost', type: 'button', onClick: copyCode }, copied ? t('copied') : t('copyCode')),
        ),
        h('p', { className: 'at-note' }, `${t('roomSize')} · ${online.length} / 5 — ${t('roomHint')}`),
        h('div', { className: 'at-players' },
          snap.players.map((player) => h('div', { key: player.id, className: 'at-player' },
            h('span', { className: 'at-player-name' }, player.id === snap.me ? `${player.name} · ${t('youTag')}` : player.name),
            player.id === snap.hostId ? h('span', { className: 'at-chip' }, t('hostTag')) : null,
            h('span', { className: 'at-chip' + (player.ready ? ' at-on' : '') }, player.online === false ? t('playerOffline') : player.ready ? t('readyChip') : t('waitingChip')),
          )),
        ),
        !allReady ? h('p', { className: 'at-note' }, online.length < 2 ? t('waitingFriend') : t('needReady')) : null,
        h('div', { className: 'at-modes at-two' },
          ['click', 'reaction'].map((key) => h('button', {
            key,
            type: 'button',
            className: 'at-mode',
            'aria-pressed': snap.mode === key,
            disabled: snap.role !== 'host',
            onClick: () => vs.act((room) => { room.state.mode = key; room.publishState(); }),
          }, t(key))),
        ),
        snap.mode === 'reaction' ? h('label', { className: 'at-field' },
          h('span', { className: 'at-label' }, t('reactionRounds')),
          h('select', {
            className: 'at-input', value: snap.rounds || 8, disabled: snap.role !== 'host',
            onChange: (event) => vs.act((room) => room.setReactionRounds(Number(event.target.value))),
          }, Array.from({ length: 16 }, (_, index) => index + 5).map((rounds) => h('option', { key: rounds, value: rounds }, rounds))),
          h('span', { className: 'at-note' }, t('roundsHint')),
        ) : null,
        h('div', { className: 'at-row' },
          h('button', { className: 'at-primary', type: 'button', onClick: () => vs.act((room) => room.setReady(!ready)) }, ready ? t('unready') : t('readyButton')),
          h('button', {
            className: 'at-primary',
            type: 'button',
            disabled: snap.role !== 'host' || !allReady,
            'data-shortcut-start': '',
            onClick: () => vs.act((room) => room.startMatch(snap.mode, { rounds: snap.rounds || 8 })),
          }, t('startMatch')),
        ),
        h('div', { className: 'at-duel-line' },
          h('span', null, `${t('online')} · ${snap.broker}`),
          h('strong', null, snap.rtt > 0 ? `${Math.round(snap.rtt)} ms` : '—'),
        ),
        h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
      );
    }

    function targetIcon(mode = 'click') {
      return h('svg', { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true },
        mode === 'track'
          ? h('path', { d: 'M3 22c7 0 5-14 12-14s5 16 14 16M22 20l7 4-6 4' })
          : mode === 'reaction'
            ? h('path', { d: 'M18 2 7 18h8l-1 12 11-17h-8l1-11Z' })
            : h(React.Fragment, null, h('circle', { cx: 16, cy: 16, r: 10 }), h('circle', { cx: 16, cy: 16, r: 4 }), h('path', { d: 'M16 1v6m0 18v6M1 16h6m18 0h6' })));
    }

    function createTrainer(ctx, t) {
      return function AimTrainer() {
        const [open, setOpen] = React.useState(false);
        const [tab, setTab] = React.useState('train');
        const [mode, setMode] = React.useState('click');
        const [records, setRecords] = React.useState(readRecords);
        const [pos, setPosState] = React.useState(() => loadPosition() || defaultPosition());
        const [dragging, setDragging] = React.useState(false);
        const [, bump] = React.useState(0);
        const winRef = React.useRef(null);
        const posRef = React.useRef(pos);
        const grabRef = React.useRef(null);
        const vs = useVersus();
        const [size, setSize] = React.useState(loadSize);
        const resizeRef = React.useRef(null);
        const sizeRef = React.useRef(size);
        const expandedRef = React.useRef(isExpanded(size));
        sizeRef.current = size;

        function setPos(next) { posRef.current = next; setPosState(next); }
        function savePosition() {
          try { window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch (_) { /* Session only. */ }
        }
        React.useEffect(() => ctx.locale.subscribe(() => bump((n) => n + 1)), []);
        React.useEffect(() => {
          if (open) winRef.current?.focus({ preventScroll: true });
        }, [open]);
        React.useEffect(() => {
          if (!open) return undefined;
          const onResize = () => {
            const next = expandedRef.current
              ? fitSize(window.innerWidth - 16, window.innerHeight - 16)
              : fitSize(sizeRef.current.width, sizeRef.current.height);
            sizeRef.current = next; setSize(next);
            setPos(clampToViewport(posRef.current.left, posRef.current.top, next.width, next.height));
          };
          onResize();
          window.addEventListener('resize', onResize);
          return () => window.removeEventListener('resize', onResize);
        }, [open]);

        function grab(event) {
          if (event.button !== 0 || event.target.closest?.('button,input,select,a,[role="tablist"]')) return;
          const node = winRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          grabRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        function drag(event) {
          if (!grabRef.current || !winRef.current) return;
          const rect = winRef.current.getBoundingClientRect();
          setPos(clampToViewport(event.clientX - grabRef.current.dx, event.clientY - grabRef.current.dy, rect.width, rect.height));
        }
        function drop(event) {
          if (!grabRef.current) return;
          grabRef.current = null; setDragging(false); savePosition();
          event?.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        function resizeTo(width, height, expanded = false) {
          const next = fitSize(width, height);
          expandedRef.current = expanded;
          sizeRef.current = next; setSize(next);
          setPos(clampToViewport(posRef.current.left, posRef.current.top, next.width, next.height));
          try { window.localStorage.setItem(SIZE_KEY, JSON.stringify({ ...next, expanded })); } catch (_) { /* Session only. */ }
        }
        function centre() {
          const current = sizeRef.current;
          setPos(clampToViewport(Math.round((window.innerWidth - current.width) / 2), Math.round((window.innerHeight - current.height) / 2), current.width, current.height));
          savePosition();
        }
        function expand() {
          if (expandedRef.current) resizeTo(WIDTH, HEIGHT);
          else resizeTo(window.innerWidth - 16, window.innerHeight - 16, true);
          centre();
        }
        function startResize(event) {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          resizeRef.current = { x: event.clientX, y: event.clientY, ...sizeRef.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        function moveResize(event) {
          const start = resizeRef.current;
          if (start) resizeTo(start.width + event.clientX - start.x, start.height + event.clientY - start.y);
        }
        function stopResize(event) { resizeRef.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); }
        function onGameKey(event) {
          if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
          const panel = winRef.current?.querySelector('[data-active-panel="true"]');
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            if (panel?.querySelector('.ar-range[data-active="true"]')) document.exitPointerLock?.();
            else setOpen(false);
            return;
          }
          if (event.code !== 'Space' && event.key !== ' ') return;
          if (event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="slider"]')) return;
          event.preventDefault(); event.stopPropagation();
          panel?.querySelector('[data-shortcut-start]:not(:disabled)')?.click();
        }
        function record(kind, value) {
          if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) return false;
          const previous = records[kind];
          if (previous !== null && !(kind === 'reaction' ? value < previous : value > previous)) return false;
          const next = { ...records, [kind]: value }; setRecords(next);
          try { window.localStorage.setItem(REC_KEY, JSON.stringify(next)); } catch (_) { /* Session only. */ }
          return true;
        }
        const soloVisible = open && tab === 'train';
        const taskTitle = (key) => t(key === 'click' ? 'gridshot' : key === 'reaction' ? 'reactionTask' : 'trackingTask');
        const game = mode === 'click' ? ClickGame : mode === 'reaction' ? ReactionGame : TrackGame;
        return h('div', { className: 'at-root' },
          h('style', null, CSS + APP_CSS),
          h('button', { type: 'button', className: 'at-launch', title: t(open ? 'close' : 'open'), 'aria-label': t(open ? 'close' : 'open'), 'aria-expanded': open, onClick: () => setOpen(!open) }, targetIcon()),
          h('section', {
            className: 'at-win', ref: winRef,
            style: { left: pos.left + 'px', top: pos.top + 'px', width: size.width + 'px', height: size.height + 'px', display: open ? 'flex' : 'none' },
            role: 'dialog', tabIndex: -1, onKeyDown: onGameKey, 'aria-label': t('title'),
            onPointerDownCapture: (event) => { if (!event.target.closest?.('button,input,textarea,select,a,[contenteditable]')) winRef.current?.focus({ preventScroll: true }); },
          },
            h('header', { className: 'at-bar' + (dragging ? ' at-drag' : ''), onPointerDown: grab, onPointerMove: drag, onPointerUp: drop, onPointerCancel: drop, title: t('drag') },
              h('div', { className: 'at-brand' }, targetIcon(), h('div', null, h('b', null, 'Aim Trainer'), h('small', null, t('brandTagline')))),
              h('nav', { className: 'at-app-nav', role: 'tablist', 'aria-label': t('title') },
                ...[['train', 'trainTab'], ['versus', 'versusTab'], ['records', 'recordTab'], ['settings', 'settingsTab']].map(([key, label]) =>
                  h('button', { key, className: 'at-tab', type: 'button', role: 'tab', 'aria-selected': tab === key, onClick: () => setTab(key) }, t(label)))),
              h('span', { className: 'at-spacer' }), h('span', { className: 'at-version' }, `v${APP_VERSION}`),
              h('button', { className: 'at-ico', type: 'button', title: t('expand'), 'aria-label': t('expand'), onClick: expand }, '⛶'),
              h('button', { className: 'at-ico', type: 'button', title: t('center'), 'aria-label': t('center'), onClick: centre }, '⌖'),
              h('button', { className: 'at-ico', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: () => setOpen(false) }, '×')),
            h('main', { className: 'at-content' },
              h('div', { className: 'at-training-shell', 'data-active-panel': tab === 'train' ? 'true' : 'false', style: { display: tab === 'train' ? 'grid' : 'none' } },
                h('aside', { className: 'at-sidebar' },
                  h('div', { className: 'at-side-label' }, t('trainingLibrary')),
                  h('div', { className: 'at-modes' }, ...['click', 'reaction', 'track'].map(key => h('button', {
                    key, className: 'at-mode', type: 'button', 'aria-pressed': mode === key, onClick: () => setMode(key),
                  }, targetIcon(key), h('span', null, taskTitle(key), h('small', null, t(`${key}Category`)))))),
                  h('div', { className: 'at-side-bottom' }, h('strong', null, t('localTraining')), h('p', null, t('localTrainingHint')))),
                h('div', { className: 'at-main-training' },
                  h('div', { className: 'at-breadcrumb' }, h('span', null, t('trainTab')), h('span', null, '/'), h('span', null, taskTitle(mode))),
                  h(game, { key: mode, t, onFinish: record, visible: soloVisible, onBack: () => setTab('train') }))),
              h('div', { 'data-active-panel': tab === 'versus' ? 'true' : 'false', style: { display: tab === 'versus' ? 'block' : 'none' } },
                h(VersusPanel, { vs, t, visible: open && tab === 'versus' })),
              tab === 'records' && h('div', { 'data-active-panel': 'true' }, h(RangeRecords, { t })),
              tab === 'settings' && h('div', { className: 'ar-settings-page', 'data-active-panel': 'true' },
                h('div', { className: 'ar-page-heading' }, h('span', { className: 'ar-eyebrow' }, 'AIM TRAINER'), h('h2', null, t('settingsTab')), h('p', null, t('settingsHint'))),
                h(RangeSettings, { t }))),
            h('footer', { className: 'at-footer' }, h('span', null, t('shortcuts')),
              h('button', { type: 'button', className: 'at-resize', 'aria-label': t('resize'), title: t('resizeHint'),
                onPointerDown: startResize, onPointerMove: moveResize, onPointerUp: stopResize, onPointerCancel: stopResize,
                onKeyDown: (event) => {
                  const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
                  if (delta) { event.preventDefault(); event.stopPropagation(); resizeTo(size.width + delta[0], size.height + delta[1]); }
                },
              }, '◢'))));
      };
    }

    function createUpdatePanel(ctx, t) {
      return function UpdatePanel({ view }) {
        const [result, setResult] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [copyStatus, setCopyStatus] = React.useState('');
        const request = React.useRef(null);
        const [, setLocale] = React.useState(0);
        React.useEffect(() => ctx.locale.subscribe(() => setLocale((n) => n + 1)), []);
        React.useEffect(() => () => {
          if (request.current) {
            clearTimeout(request.current.timer);
            request.current.controller.abort();
            request.current = null;
          }
        }, []);
        if (view !== 'page') return null;

        async function check() {
          if (request.current) return;
          const controller = new AbortController();
          const pending = { controller, timer: setTimeout(() => controller.abort(), 12000) };
          request.current = pending;
          setBusy(true);
          setResult(null);
          setCopyStatus('');
          try {
            const next = await checkForUpdates(APP_VERSION, { signal: controller.signal });
            if (request.current === pending) setResult(next);
          } catch (_) {
            if (request.current === pending) setResult({ status: 'error' });
          } finally {
            clearTimeout(pending.timer);
            if (request.current === pending) { request.current = null; setBusy(false); }
          }
        }
        async function copy() {
          try {
            await navigator.clipboard.writeText(result.spec);
            setCopyStatus('copied');
          } catch (_) { setCopyStatus('updateCopyFailed'); }
        }
        const statusKey = { available: 'updateAvailable', current: 'updateCurrent', ahead: 'updateAhead', error: 'updateFailed' };
        return h('section', { className: 'at-update', 'aria-label': t('updateTitle') },
          h('style', null, `
            .at-update { display:flex; flex-direction:column; gap:12px; padding:16px; margin:16px 0; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:1.6; }
            .at-update p, .at-update h3 { margin:0; }
            .at-update h3 { font-size:15px; font-weight:600; }
            .at-update-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
            .at-update button { border:1px solid var(--dsw-alias-border-l2); border-radius:8px; min-height:36px; padding:6px 14px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; }
            .at-update button:disabled { opacity:.6; cursor:wait; }
            .at-update button:focus-visible, .at-update a:focus-visible, .at-update textarea:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
            .at-update textarea { width:100%; min-height:74px; resize:vertical; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; overflow-wrap:anywhere; }
            .at-update a { color:var(--dsw-alias-brand-primary); }
            .at-update-note { color:var(--dsw-alias-label-secondary); font-size:13px; }
          `),
          h('h3', null, t('updateTitle')),
          h('p', null, `${t('currentVersion')}: ${APP_VERSION}`),
          h('div', { className: 'at-update-actions' }, h('button', { type: 'button', disabled: busy, onClick: check }, t(busy ? 'checkingUpdates' : 'checkUpdates'))),
          h('div', { role: 'status', 'aria-live': 'polite' }, busy ? t('checkingUpdates') : result ? t(statusKey[result.status]) : ''),
          result?.version && h('p', null, `${t('latestVersion')}: ${result.version}`),
          result?.status === 'available' && h(React.Fragment, null,
            h('p', null, t('updateSteps')),
            h('textarea', { readOnly: true, value: result.spec, 'aria-label': t('updateCopy'), spellCheck: false }),
            h('div', { className: 'at-update-actions' },
              h('button', { type: 'button', onClick: copy }, t('updateCopy')),
              h('a', { href: result.url, target: '_blank', rel: 'noopener noreferrer' }, t('updateSource')),
            ),
            h('p', { role: 'status' }, copyStatus ? t(copyStatus) : ''),
            h('p', { className: 'at-update-note' }, t('updateLocalHint')),
          ),
          h('p', { className: 'at-update-note' }, t('updatePrivacy')),
        );
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', DICTS.en));
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICTS.zh));
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: '@local/aim-trainer' }, createUpdatePanel(ctx, t)));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'aim-trainer', order: 80 }, createTrainer(ctx, t)));
      },
    };
  },
});
