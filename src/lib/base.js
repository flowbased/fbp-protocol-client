const platform = require('../helpers/platform');

class BaseRuntime extends platform.EventEmitter {
  constructor(definition) {
    super();
    this.definition = definition;
    if (!this.definition.capabilities) { this.definition.capabilities = []; }
    this.graph = null;
  }

  setMain(graph) {
    this.graph = graph;
  }

  getType() { return this.definition.protocol; }

  getAddress() { return this.definition.address; }

  canDo(capability) {
    return this.definition.capabilities.indexOf(capability) !== -1;
  }

  isConnected() { return false; }

  // Connect to the target runtime environment (iframe URL, WebSocket address)
  connect() {}

  disconnect() {}

  reconnect() {
    (this.disconnect)();
    return (this.connect)();
  }

  // Start a NoFlo Network
  start() {
    if (!this.graph) {
      throw new Error('No graph defined for execution');
    }
    return this.sendNetwork('start',
      { graph: this.graph.name || this.graph.properties.id });
  }

  // Stop a NoFlo network
  stop() {
    if (!this.graph) {
      throw new Error('No graph defined for execution');
    }
    return this.sendNetwork('stop',
      { graph: this.graph.name || this.graph.properties.id });
  }

  // Set the parent element that some runtime types need
  setParentElement() {}

  // Get a DOM element rendered by the runtime for preview purposes
  getElement() {}

  recvMessage(message) {
    this.emit('message', message);
    switch (message.protocol) {
      case 'runtime': return this.recvRuntime(message.command, message.payload);
      case 'graph': return this.recvGraph(message.command, message.payload);
      case 'network': return this.recvNetwork(message.command, message.payload);
      case 'component': return this.recvComponent(message.command, message.payload);
      case 'trace': return this.recvTrace(message.command, message.payload);
      default: return null;
    }
  }

  recvRuntime(command, payload) {
    if (command === 'runtime') {
      Object.keys(payload).forEach((key) => {
        const val = payload[key];
        this.definition[key] = val;
      });
      this.emit('capabilities', payload.capabilities || []);
    }
    this.emit('runtime', {
      command,
      payload,
    });
  }

  recvComponent(command, payload) {
    switch (command) {
      case 'error':
        this.emit('network', {
          command,
          payload,
        });
        return;
      default:
        this.emit('component', {
          command,
          payload,
        });
    }
  }

  recvGraph(command, payload) {
    this.emit('graph', {
      command,
      payload,
    });
  }

  recvNetwork(command, payload) {
    switch (command) {
      case 'started':
        this.emit('execution', {
          running: (payload != null) && (payload.running != null) ? payload.running : true,
          started: (payload != null) && payload.started ? payload.started : true,
        });
        return;
      case 'stopped':
        this.emit('execution', {
          running: (payload != null) && (payload.running != null) ? payload.running : false,
          started: (payload != null) && payload.started ? payload.started : false,
        });
        return;
      case 'status':
        this.emit('execution', {
          running: payload.running,
          started: payload.started,
        });
        return;
      case 'icon':
        this.emit('icon', payload);
        return;
      default:
        this.emit('network', {
          command,
          payload,
        });
    }
  }

  recvTrace(command, payload) {
    this.emit('trace', {
      command,
      payload,
    });
  }

  sendRuntime(command, payload = {}) {
    return this.send('runtime', command, {
      ...payload,
      secret: this.definition.secret,
    });
  }

  sendGraph(command, payload = {}) {
    return this.send('graph', command, {
      ...payload,
      secret: this.definition.secret,
    });
  }

  sendNetwork(command, payload = {}) {
    return this.send('network', command, {
      ...payload,
      secret: this.definition.secret,
    });
  }

  sendComponent(command, payload = {}) {
    return this.send('component', command, {
      ...payload,
      secret: this.definition.secret,
    });
  }

  sendTrace(command, payload = {}) {
    return this.send('trace', command, {
      ...payload,
      secret: this.definition.secret,
    });
  }

  send() {}
}

module.exports = BaseRuntime;
