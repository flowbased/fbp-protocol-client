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
    let id; let signaller;
    if (this.isConnected() || this.connecting) { return; }

    const address = this.getAddress();
    if (address.indexOf('#') !== -1) {
      [signaller, id] = address.split('#');
    } else {
      signaller = 'https://api.flowhub.io/';
      id = address;
    }
    this.signaller = new Signaller(signaller, this.id);

    const options = {
      channelName: id,
      initiator: true,
    };
    if (!isBrowser()) {
      // eslint-disable-next-line
      options.wrtc = require('wrtc');
    }

    this.peer = new Peer(options);
    this.signaller.connect();
    this.signaller.once('connected', () => {
      this.signaller.announce(id);
    });
    this.signaller.on('signal', (data) => {
      this.peer.signal(data);
    });
    this.signaller.on('error', this.handleError);
    this.peer.on('signal', (data) => {
      this.signaller.announce(id, data);
    });
    this.peer.on('connect', () => {
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

    this.connecting = true;
  }

  disconnect() {
    if (!this.connection) { return; }
    this.connecting = false;
    this.peer.destroy();
    this.peer = null;
    this.connection = null;
    this.signaller.disconnect();
    this.signaller = null;
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
    debug('send', m);
    this.peer.send(JSON.stringify(m));
  }

  handleError(error) {
    debug('error', error);
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
