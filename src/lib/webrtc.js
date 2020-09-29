const debug = require('debug')('fbp-protocol-client:webrtc');
const Base = require('./base');

class WebRTCRuntime extends Base {
  constructor(definition) {
    super(definition);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.peer = null;
    this.connecting = false;
    this.connection = null;
    this.protocol = 'webrtc';
    this.buffer = [];
  }

  getElement() {
    return null;
  }

  isConnected() {
    return this.connection !== null;
  }

  connect() {
    let id; let signaller;
    if (this.connection || this.connecting) { return; }

    const address = this.getAddress();
    if (address.indexOf('#') !== -1) {
      [signaller, id] = address.split('#');
    } else {
      signaller = 'https://api.flowhub.io';
      id = address;
    }

    const options = {
      room: id,
      debug: true,
      channels: {
        chat: true,
      },
      capture: false,
      constraints: false,
      expectedLocalStreams: 0,
    };

    // eslint-disable-next-line
    this.peer = quickconnect(signaller, options);
    this.peer.on('channel:opened:chat', (chatId, dc) => {
      this.connection = dc;
      this.connection.onmessage = (data) => {
        debug('message', data.data);
        return this.handleMessage(data.data);
      };
      this.connecting = false;
      this.sendRuntime('getruntime', {});
      this.emit('status', {
        online: true,
        label: 'connected',
      });
      this.emit('connected');
      this.flush();
    });

    this.peer.on('channel:closed:chat', () => {
      this.connection.onmessage = null;
      this.connection = null;
      this.emit('status', {
        online: false,
        label: 'disconnected',
      });
      this.emit('disconnected');
    });

    this.connecting = true;
  }

  disconnect() {
    if (!this.connection) { return; }
    this.connecting = false;
    this.connection.close();
    this.connection = null;
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
    this.connection.send(JSON.stringify(m));
  }

  handleError(error) {
    debug('error', error);
    this.connection = null;
    this.connecting = false;
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
