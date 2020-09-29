const debug = require('debug')('fbp-protocol-client:signaller');
const { WebSocket, EventEmitter } = require('./platform');

class Signaller extends EventEmitter {
  constructor(signaller, id) {
    super();
    this.signaller = signaller;
    this.id = id;
    this.connection = null;
    this.connecting = false;
    this.buffer = [];
    this.signals = [];
    this.room = null;
    this.memberCount = 0;
  }

  connect() {
    if (this.connection || this.connecting) {
      return;
    }
    const connection = new WebSocket(this.signaller);
    this.connecting = true;
    connection.addEventListener('open', () => {
      debug(`connected to ${this.signaller}`);
      this.connection = connection;
      this.connecting = false;
      this.emit('connected');
      this.flush();
    });
    connection.addEventListener('message', (msg) => {
      debug('receive', msg.data);
      const [command, peer, data] = msg.data.split('|');
      let payload = null;
      if (data) {
        payload = JSON.parse(data);
      } else {
        payload = JSON.parse(peer);
      }
      switch (command) {
        case '/announce': {
          if (!payload.signal) {
            return;
          }
          this.emit('signal', payload.signal, peer);
          break;
        }
        case '/roominfo': {
          if (payload.memberCount > this.memberCount) {
            // New members have joined, send connection details
            this.signals.forEach((signal) => {
              this.announce(this.room, signal);
            });
          }
          this.memberCount = payload.memberCount;
          break;
        }
        default: {
          debug(`unhandled command ${command}`, payload);
        }
      }
    });
    connection.addEventListener('close', () => {
      this.connection = null;
      this.connecting = false;
      this.emit('disconnected');
      debug('disconnected');
    });
    connection.addEventListener('error', (err) => {
      this.connection = null;
      this.connecting = false;
      this.emit('error', err);
    });
  }

  announce(room, signal = null) {
    const identifier = {
      id: this.id,
    };
    const announcement = {
      signal,
      room,
      id: this.id,
    };
    this.signals.push(signal);
    this.room = room;
    this.send(`/announce|${JSON.stringify(identifier)}|${JSON.stringify(announcement)}`);
  }

  send(data) {
    if (!this.connection) {
      this.buffer.push(data);
      return;
    }
    debug('send', data);
    this.connection.send(data);
  }

  disconnect() {
    this.signals = [];
    if (!this.connection) { return; }
    this.connection.close();
  }

  flush() {
    this.buffer.forEach((msg) => {
      this.send(msg);
    });
    this.buffer = [];
  }
}

module.exports = Signaller;
