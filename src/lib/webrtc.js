const debug = require('debug')('fbp-protocol-client:webrtc');
const Peer = require('simple-peer');
const { v4: uuid } = require('uuid');
const Base = require('./base');
const { isBrowser } = require('../helpers/platform');
const Signaller = require('../helpers/signaller');

class WebRTCRuntime extends Base {
  constructor(definition) {
    super(definition);
    this.id = uuid();
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.peer = null;
    this.signaller = null;
    this.connecting = false;
    this.connection = null;
    this.protocol = 'webrtc';
    this.buffer = [];
    this.peers = [];
  }

  getElement() {
    return null;
  }

  isConnected() {
    if (this.peer && this.connection) {
      return true;
    }
    return false;
  }

  connect() {
    let roomId; let signaller;
    if (this.isConnected() || this.connecting) { return; }

    const address = this.getAddress();
    if (address.indexOf('#') !== -1) {
      [signaller, roomId] = address.split('#');
    } else {
      signaller = 'ws://api.flowhub.io/';
      roomId = address;
    }
    this.signaller = new Signaller(signaller, this.id);

    const options = {
      channelName: roomId,
      initiator: true,
    };
    if (!isBrowser()) {
      // eslint-disable-next-line
      options.wrtc = require('wrtc');
    }

    this.signaller.connect();
    this.signaller.once('connected', () => {
      this.signaller.announce(roomId);
      this.peer = new Peer(options);
      this.subscribePeer(roomId);
    });
    this.signaller.on('signal', (data) => {
      if (!this.peer && !this.peer.destroyed) {
        return;
      }
      try {
        this.peer.signal(data);
      } catch (e) {
        this.handleError(e);
      }
    });
    this.signaller.on('error', this.handleError);
    this.connecting = true;
  }

  subscribePeer(roomId) {
    this.peer.on('signal', (data) => {
      debug(`${this.id} transmitting signalling data`);
      this.signaller.announce(roomId, data);
    });
    this.peer.on('connect', () => {
      debug(`${this.id} connected to peer`);
      this.connecting = false;
      this.connection = true;
      this.emit('status', {
        online: true,
        label: 'connected',
      });
      this.emit('connected');
      this.sendRuntime('getruntime', {});
      this.flush();
    });
    this.peer.on('data', this.handleMessage);
    this.peer.on('close', () => {
      debug(`${this.id} disconnected from peer`);
      this.connection = null;
      this.signaller.disconnect();
      this.signaller = null;
      this.emit('status', {
        online: false,
        label: 'disconnected',
      });
      this.emit('disconnected');
    });
    this.peer.on('error', this.handleError);
  }

  disconnect() {
    if (!this.connection) { return; }
    this.connecting = false;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connection = null;
    if (this.signaller) {
      this.signaller.disconnect();
      this.signaller = null;
    }
    this.emit('disconnected');
  }

  send(protocol, command, payload) {
    const m = {
      protocol,
      command,
      payload,
    };
    if (this.connecting) {
      this.buffer.push(m);
      return;
    }

    if (!this.connection) { return; }
    this.peer.send(JSON.stringify(m));
  }

  handleError(error) {
    debug(`${this.id} errored`, error);
    this.connection = null;
    this.connecting = false;
    this.emit('error', error);
  }

  handleMessage(message) {
    const msg = JSON.parse(message);
    return this.recvMessage(msg);
  }

  flush() {
    this.buffer.forEach((item) => {
      this.send(item.protocol, item.command, item.payload);
    });
    this.buffer = [];
  }
}

module.exports = WebRTCRuntime;
