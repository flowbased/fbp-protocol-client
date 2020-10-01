const debug = require('debug')('fbp-protocol-client:signaller');
const { WebSocket, EventEmitter } = require('./platform');

class Signaller extends EventEmitter {
  constructor(id, signaller = 'wss://api.flowhub.io') {
    super();
    this.signaller = signaller;
    this.id = id;
    this.connection = null;
    this.connecting = false;
    this.buffer = [];
  }

  isConnected() {
    if (this.connection && this.connection.readyState === this.connection.OPEN) {
      return true;
    }
    return false;
  }

  connect() {
    if (this.isConnected() || this.connecting) {
      return;
    }
    debug(`${this.id} connecting`);
    const connection = new WebSocket(this.signaller);
    this.connecting = true;
    connection.addEventListener('open', () => {
      debug(`${this.id} connected to ${this.signaller}`);
      this.connection = connection;
      this.connecting = false;
      this.emit('connected');
      this.flush();
    });
    connection.addEventListener('message', (msg) => {
      this.handleMessage(msg);
    });
    connection.addEventListener('close', () => {
      this.connection = null;
      this.connecting = false;
      this.emit('disconnected');
      debug(`${this.id} disconnected`);
    });
    connection.addEventListener('error', (err) => {
      this.connection = null;
      this.connecting = false;
      this.emit('error', err);
      debug(`${this.id} error`, err);
    });
  }

  signal(to, signal = {}) {
    const identifier = {
      id: this.id,
    };
    this.send(`/to|${to}|/signal|${JSON.stringify(identifier)}|${JSON.stringify(signal)}`);
  }

  join(room) {
    const identifier = {
      id: this.id,
    };
    const announcement = {
      room,
      id: this.id,
    };
    this.send(`/announce|${JSON.stringify(identifier)}|${JSON.stringify(announcement)}`);
  }

  send(data) {
    if (!this.isConnected()) {
      debug(`${this.id} push buffer`);
      this.buffer.push(data);
      return;
    }
    const [command] = data.split('|');
    debug(this.id, 'send', command);
    this.connection.send(data);
  }

  disconnect() {
    if (!this.isConnected()) { return; }
    debug(`${this.id} disconnecting`);
    this.connection.close();
  }

  handleMessage(msg) {
    const [command, peer, data, ...rest] = msg.data.split('|');
    if (command === '/to') {
      // Direct Message, process the payload
      if (peer !== this.id) {
        debug(`${this.id} wrongly-addressed DM, was sent to ${peer}`);
        return;
      }
      const dm = `${data}|${rest.join('|')}`;
      this.handleMessage({
        ...msg,
        data: dm,
      });
      return;
    }
    debug(this.id, 'recv', command);
    let payload = null;
    if (data) {
      payload = JSON.parse(data);
    } else {
      payload = JSON.parse(peer);
    }
    switch (command) {
      case '/announce': {
        this.emit('join', payload, JSON.parse(peer));
        break;
      }
      case '/signal': {
        this.emit('signal', payload, JSON.parse(peer));
        break;
      }
      case '/roominfo': {
        break;
      }
      default: {
        debug(`${this.id} unhandled command ${command}`, payload);
      }
    }
  }

  flush() {
    if (!this.buffer.length) {
      return;
    }
    debug(this.id, 'flush buffer', this.buffer.length);
    this.buffer.forEach((msg) => {
      this.send(msg);
    });
    this.buffer = [];
  }
}

module.exports = Signaller;
