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
  }

  connect() {
    if (this.connection || this.connecting) {
      return;
    }
    const connection = new WebSocket(this.signaller);
    this.connecting = true;
    connection.addEventListener('open', () => {
      this.connection = connection;
      this.connecting = false;
      this.emit('connected');
      this.flush();
    });
    connection.addEventListener('message', (msg) => {
      const [command, peer, data] = msg.data.split('|');
      let payload = null;
      if (data) {
        payload = JSON.parse(data);
      }
      switch (command) {
        case '/announce': {
          if (!payload.signal) {
            return;
          }
          debug(payload.signal);
          this.emit('signal', payload.signal, peer);
          break;
        }
        default: {
          debug(command, payload.signal);
        }
      }
    });
    connection.addEventListener('close', () => {
      this.connection = null;
      this.connecting = false;
      this.emit('disconnected');
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
    this.send(`/announce|${JSON.stringify(identifier)}|${JSON.stringify(announcement)}`);
  }

  send(data) {
    if (!this.connection) {
      this.buffer.push(data);
      return;
    }
    this.connection.send(data);
  }

  disconnect() {
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
