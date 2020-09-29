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
    this.announcements = [];
    this.room = null;
    this.hasPeers = false;
    this.memberCount = 0;
  }

  connect() {
    if (this.connection || this.connecting) {
      return;
    }
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
      const [command, peer, data] = msg.data.split('|');
      let payload = null;
      if (data) {
        payload = JSON.parse(data);
      } else {
        payload = JSON.parse(peer);
      }
      switch (command) {
        case '/announce': {
          debug(this.id, 'recv', command);
          setTimeout(() => {
            this.hasPeers = true;
            this.flushAnnouncements();
          }, 0);
          if (payload.signal) {
            this.emit('signal', payload.signal, peer);
          } else {
            this.emit('join');
          }
          break;
        }
        case '/roominfo': {
          // Ignore for now
          if (payload.memberCount > this.memberCount) {
            setTimeout(() => {
              this.hasPeers = true;
              this.flushAnnouncements();
            }, 0);
          }
          this.memberCount = payload.memberCount;
          break;
        }
        default: {
          debug(`${this.id} unhandled command ${command}`, payload);
        }
      }
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
    if (signal && !this.hasPeers) {
      debug(`${this.id} push announcement`);
      this.announcements.push(announcement.signal);
      this.room = room;
      return;
    }
    this.send(`/announce|${JSON.stringify(identifier)}|${JSON.stringify(announcement)}`);
  }

  send(data) {
    if (!this.connection) {
      debug(`${this.id} push buffer`);
      this.buffer.push(data);
      return;
    }
    const [command] = data.split('|');
    debug(this.id, 'send', command);
    this.connection.send(data);
  }

  disconnect() {
    if (!this.connection) { return; }
    this.connection.close();
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

  flushAnnouncements() {
    if (!this.announcements.length) {
      return;
    }
    debug(this.id, 'flush announcements', this.announcements.length);
    this.hasPeers = true;
    this.announcements.forEach((announcement) => {
      this.announce(this.room, announcement);
    });
    this.announcements = [];
  }
}

module.exports = Signaller;
