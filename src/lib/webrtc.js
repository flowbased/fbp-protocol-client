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
    this.signaller = null;
    this.connecting = false;
    this.protocol = 'webrtc';
    this.buffer = [];
    this.peers = {};
  }

  getElement() {
    return null;
  }

  isConnected() {
    // TODO: Only consider runtime peers
    const connectedPeers = Object.keys(this.peers).filter((p) => this.peers[p].connected());
    if (connectedPeers.length) {
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
      signaller = 'wss://api.flowhub.io/';
      roomId = address;
    }
    this.signaller = new Signaller(this.id, signaller);

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
      // Join the Runtime ID room
      this.signaller.join(roomId);
    });
    this.signaller.on('join', (member) => {
      // Another peer has joined. Likely the runtime
      this.connectPeer(member, options);
    });
    this.signaller.on('signal', (data, member) => {
      // Getting signalling information for a peer
      const peer = this.peers[member.id];
      if (!peer && !peer.destroyed) {
        return;
      }
      peer.signal(data);
    });
    this.signaller.on('error', this.handleError);
    this.connecting = true;
  }

  connectPeer(member, options) {
    const peer = new Peer(options);
    this.peers[member.id] = peer;
    peer.on('signal', (data) => {
      // Send connection details to peer via signalling server
      this.signaller.signal(member.id, data);
    });
    peer.on('connect', () => {
      debug(`${this.id} connected to peer ${member.id}`);
      this.connecting = false;
      this.emit('status', {
        online: true,
        label: 'connected',
      });
      this.emit('connected');
      this.sendRuntime('getruntime', {});
      this.flush();
    });
    peer.on('data', this.handleMessage);
    peer.on('close', () => {
      debug(`${this.id} disconnected from peer ${member.id}`);
      delete this.peers[member.id];
      this.emit('status', {
        online: false,
        label: 'disconnected',
      });
      this.emit('disconnected');
      this.connecting = false;
    });
    peer.on('error', this.handleError);
  }

  disconnect() {
    this.connecting = false;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
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
    if (!this.isConnected()) {
      this.buffer.push(m);
      return;
    }

    Object.keys(this.peers).forEach((p) => {
      const peer = this.peers[p];
      if (!peer.connected()) {
        return;
      }
      peer.send(JSON.stringify(m));
    });
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
