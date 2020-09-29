const Base = require('./base');

class IframeRuntime extends Base {
  constructor(definition) {
    super(definition);
    this.updateIframe = this.updateIframe.bind(this);
    this.onLoaded = this.onLoaded.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.origin = window.location.origin;
    this.connecting = false;
    this.connected = false;
    this.buffer = [];
    this.iframe = null;
  }

  getElement() { return this.iframe; }

  isConnected() { return this.connected; }

  setMain(graph) {
    if (this.graph) {
      // Unsubscribe from previous main graph
      this.graph.removeListener('changeProperties', this.updateIframe);
    }

    if (!graph) {
      super.setMain(graph);
      return;
    }

    // Update contents on property changes
    graph.on('changeProperties', this.updateIframe);

    super.setMain(graph);

    // Ensure iframe gets updated
    this.updateIframe();
  }

  setParentElement(parent) {
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    return parent.appendChild(this.iframe);
  }

  connect() {
    if (!this.iframe) {
      throw new Error('Unable to connect without a parent element');
    }

    this.iframe.addEventListener('load', this.onLoaded, false);

    // Let the UI know we're connecting
    this.connecting = true;
    this.emit('status', {
      online: false,
      label: 'connecting',
    });

    // Set the source to the iframe so that it can load
    this.iframe.setAttribute('src', this.getAddress());

    // Set an ID for targeting purposes
    this.iframe.id = 'preview-iframe';

    // Start listening for messages from the iframe
    return window.addEventListener('message', this.onMessage, false);
  }

  updateIframe() {
    if (!this.iframe || !this.graph) { return; }
    const env = this.graph.properties.environment;
    if (!env || !env.content) { return; }
    this.send('iframe', 'setcontent', env.content);
  }

  disconnect() {
    if (this.iframe) {
      this.iframe.removeEventListener('load', this.onLoaded, false);
    }
    this.connected = false;

    // Stop listening to messages
    window.removeEventListener('message', this.onMessage, false);

    this.emit('status', {
      online: false,
      label: 'disconnected',
    });
    return this.emit('disconnected');
  }

  // Called every time the iframe has loaded successfully
  onLoaded() {
    // Since the iframe runtime runs in user's browser, being loaded doesn't
    // necessarily mean that the runtime has started. Especially on slower
    // mobile devices the runtime initialization can still take a while.
    // Because of this we loop requesting runtime info until runtime
    // responds and only then consider ourselves connected.
    let timeout;
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

      (this.updateIframe)();

      return this.flush();
    });

    // Start requesting capabilities
    this.postMessage('runtime', 'getruntime', {});
    timeout = setTimeout(() => {
      // Keep trying until runtime responds
      this.postMessage('runtime', 'getruntime', {});
    }, 500);
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
    const w = this.iframe.contentWindow;
    if (!w) { return; }
    try {
      if (w.location.href === 'about:blank') { return; }
      if (w.location.href.indexOf('chrome-extension://') !== -1) {
        throw new Error('Use * for IFRAME communications in a Chrome app');
      }
    } catch (e) {
      // Chrome Apps
      w.postMessage(JSON.stringify({
        protocol,
        command,
        payload,
      }), '*');
      return;
    }
    w.postMessage(JSON.stringify({
      protocol,
      command,
      payload,
    }), w.location.href);
  }

  onMessage(message) {
    let data;
    if (message.source && (message.source !== this.iframe.contentWindow)) {
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

module.exports = IframeRuntime;
