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
    const connectedPeers = Object.keys(this.peers).filter((p) => this.peers[p].connected);
    if (connectedPeers.length) {
      return true;
    }
    return false;
  }

  maybeDisconnected() {
    if (this.signaller && !this.signaller.isConnected()) {
      this.signaller = null;
      this.connecting = false;
    }
    if (this.isConnected()) {
      return;
    }
    this.emit('status', {
      online: false,
      label: 'disconnected',
    });
    this.emit('disconnected');
  }

  connect() {
    let roomId; let signaller;
    if (this.isConnected() || this.connecting) { return; }
    if (this.signaller && this.signaller.isConnected()) { return; }

    const address = this.getAddress();
    if (address.indexOf('#') !== -1) {
      [signaller, roomId] = address.split('#');
      if (signaller === 'webrtc://') {
        signaller = null;
      }
    } else {
      roomId = address;
    }
    if (!signaller) {
      signaller = 'wss://api.flowhub.io/';
    }
    this.signaller = new Signaller(this.id, 'client', signaller);

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
      if (this.peers[member.id]) {
        return;
      }
      // Another peer has joined. Likely the runtime
      this.signaller.joinReply(member.id, this.id);
      this.connectPeer(member, options);
    });
    this.signaller.on('signal', (data, member) => {
      // Getting signalling information for a peer
      const peer = this.peers[member.id];
      if (!peer && !peer.destroyed) {
        debug(`${this.id} received signalling data for unknown/destroyed peer ${member.id}`);
        return;
      }
      debug(`${this.id} received signalling data for peer ${member.id}`);
      peer.signal(data);
    });
    this.signaller.on('error', (error) => {
      debug(`${this.id} signaller errored`, error);
      this.connecting = false;
      this.signaller = null;
      this.emit('error', error);
      this.maybeDisconnected();
    });
    this.signaller.on('disconnected', () => {
      this.signaller = null;
      this.connecting = false;
      // We may retain peer connections even without signaller
      this.maybeDisconnected();
    });
    this.connecting = true;
  }

  connectPeer(member, options) {
    debug(`${this.id} connecting to peer ${member.id}`);
    const peer = new Peer(options);
    this.peers[member.id] = peer;
    peer.on('signal', (data) => {
      // Send connection details to peer via signalling server
      debug(`${this.id} sending signalling data to peer ${member.id}`);
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
      this.maybeDisconnected();
    });
    peer.on('error', (error) => {
      debug(`${this.id} peer ${member.id} errored`, error);
      this.emit('error', error);
      delete this.peers[member.id];
      this.maybeDisconnected();
    });
  }

  disconnect() {
    this.connecting = false;
    Object.keys(this.peers).forEach((p) => {
      this.peers[p].destroy();
      delete this.peers[p];
    });
    if (this.signaller) {
      this.signaller.disconnect();
      this.signaller = null;
    }
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
      if (!peer.connected) {
        return;
      }
      peer.send(JSON.stringify(m));
    });
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
