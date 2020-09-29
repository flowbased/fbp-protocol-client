const Base = require('./base');

class OpenerRuntime extends Base {
  constructor(definition) {
    super(definition);
    this.onMessage = this.onMessage.bind(this);
    this.connecting = false;
    this.connected = false;
    this.buffer = [];
  }

  getElement() { return null; }

  isConnected() { return this.connected; }

  setParentElement() {
  }

  connect() {
    // Let the UI know we're connecting
    let timeout;
    this.connecting = true;
    this.emit('status', {
      online: false,
      label: 'connecting',
    });

    // Start listening for messages from the iframe
    window.addEventListener('message', this.onMessage, false);

    this.once('capabilities', () => {
      // Runtime responded with a capabilities message. We're live!
      if (timeout) { clearTimeout(timeout); }
      this.connecting = false;
      this.connected = true;
      this.emit('status', {
        online: true,
        label: 'connected',
      });
      this.emit('connected');
      this.flush();
    });

    // Request capabilities from opener
    this.postMessage('runtime', 'getruntime', {});
    timeout = setTimeout(() => {
      // Keep trying until runtime responds
      this.postMessage('runtime', 'getruntime', {});
    }, 500);
  }

  updateIframe() {
  }

  disconnect() {
    this.connected = false;

    // Stop listening to messages
    window.removeEventListener('message', this.onMessage, false);

    this.emit('status', {
      online: false,
      label: 'disconnected',
    });
    this.emit('disconnected');
  }

  send(protocol, command, payload) {
    if (this.connecting) {
      this.buffer.push({
        protocol,
        command,
        payload,
      });
      return;
    }
    this.postMessage(protocol, command, payload);
  }

  postMessage(protocol, command, payload) {
    if (!window.opener) { return; }
    window.opener.postMessage(JSON.stringify({
      protocol,
      command,
      payload,
    }), '*');
  }

  onMessage(message) {
    let data;
    if (message.source && (message.source !== window.opener)) {
      // Message from unrelated source
      return;
    }
    if (typeof message.data === 'string') {
      data = JSON.parse(message.data);
    } else {
      ({
        data,
      } = message);
    }
    this.recvMessage(data);
  }

  flush() {
    this.buffer.forEach((item) => {
      this.postMessage(item.protocol, item.command, item.payload);
    });
    this.buffer = [];
  }
}

module.exports = OpenerRuntime;
