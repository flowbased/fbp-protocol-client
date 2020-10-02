const Base = require('./base');
const platform = require('../helpers/platform');

class WebSocketRuntime extends Base {
  constructor(definition) {
    super(definition);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.connecting = false;
    this.connection = null;
    this.protocol = 'noflo';
    this.buffer = [];
    this.container = null;
  }

  getElement() {
    if (this.container) { return this.container; }

    // DOM visualization for remote runtime output
    this.container = document.createElement('div');
    this.container.classList.add('preview-container');
    const messageConsole = document.createElement('pre');
    const previewImage = document.createElement('img');
    this.container.appendChild(previewImage);
    this.container.appendChild(messageConsole);

    this.on('network', (message) => {
      if (message.command !== 'output') { return; }

      const p = message.payload;
      if ((p.type != null) && (p.type === 'previewurl')) {
        const hasQuery = p.url.indexOf('?' !== -1);
        const separator = hasQuery ? '&' : '?';
        previewImage.src = `${p.url + separator}timestamp=${new Date().getTime()}`;
      }
      if (p.message != null) {
        const encoded = p.message.replace(/[\u00A0-\u99999<>&]/gim, (i) => `&#${i.charCodeAt(0)};`);
        messageConsole.innerHTML += `${encoded}\n`;
        messageConsole.scrollTop = messageConsole.scrollHeight;
      }
    });
    this.on('disconnected', () => {
      messageConsole.innerHTML = '';
    });

    return this.container;
  }

  isConnected() { return this.connection && (this.connecting === false); }

  connect() {
    if (this.connection || this.connecting) { return; }

    if (this.protocol) {
      this.connection = new platform.WebSocket(this.getAddress(), this.protocol);
    } else {
      this.connection = new platform.WebSocket(this.getAddress());
    }
    this.connection.addEventListener('open', () => {
      this.connecting = false;

      // Perform capability discovery
      this.sendRuntime('getruntime', {});

      this.emit('status', {
        online: true,
        label: 'connected',
      });
      this.emit('connected');

      return this.flush();
    },
    false);
    this.connection.addEventListener('message', this.handleMessage, false);
    this.connection.addEventListener('error', this.handleError, false);
    this.connection.addEventListener('close', () => {
      this.connection = null;
      this.emit('status', {
        online: false,
        label: 'disconnected',
      });
      this.emit('disconnected');
    },
    false);

    this.connecting = true;
  }

  disconnect() {
    if (!this.connection) { return; }
    this.connecting = false;
    this.connection.close();
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

    if (!this.connection) { return; }
    this.connection.send(JSON.stringify({
      protocol,
      command,
      payload,
    }));
  }

  handleError(errorEvent) {
    if (this.protocol === 'noflo') {
      // Try without the legacy protocol
      delete this.protocol;
      this.connecting = false;
      this.connection = null;
      setTimeout(() => {
        this.connect();
      }, 1);
      return;
    }
    this.connection = null;
    this.connecting = false;
    // Create an error object for the event
    const error = new Error('Connection failed');
    error.event = errorEvent;
    this.emit('error', error);
  }

  handleMessage(message) {
    const msg = JSON.parse(message.data);
    return this.recvMessage(msg);
  }

  flush() {
    this.buffer.forEach((item) => {
      this.send(item.protocol, item.command, item.payload);
    });
    this.buffer = [];
  }
}

module.exports = WebSocketRuntime;
