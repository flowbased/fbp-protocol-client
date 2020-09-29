/* eslint max-classes-per-file: "warn" */
const {
  EventEmitter,
} = require('events');
const WebSocketServer = require('websocket').server;
const http = require('http');
const path = require('path');
const runtime = require('noflo-runtime-websocket');

const normalizePorts = function (ports) {
  const defaults = {
    type: 'any',
    description: '',
    addressable: false,
    required: false,
  };
  let p = ports;
  if ((ports.length == null)) {
    p = [ports];
  }
  const normalizePort = function (port) {
    return {
      ...defaults,
      ...port,
    };
  };
  return p.map((port) => normalizePort(port));
};

// TODO: implement array ports such that each connection gets its own index,
// and that data send on a specific index is only sent to that connection
class PseudoComponent extends EventEmitter {
  constructor() {
    super();
    // eslint-disable-next-line no-underscore-dangle
    this._receiveFunc = null;
    this.ports = {
      inPorts: {},
      outPorts: {},
    };
  }

  inports(p) {
    this.ports.inPorts = normalizePorts(p);
    return this;
  }

  outports(p) {
    this.ports.outPorts = normalizePorts(p);
    return this;
  }

  receive(f) {
    this.receiveFunc = f;
    return this;
  }

  send(port, event, index, payload) {
    return this.emit('output', port, event, index, payload);
  }

  // eslint-disable-next-line no-underscore-dangle
  _receive(port, event, index, payload) {
    const send = function (...rest) {
      return this.send(...rest);
    }.bind(this);
    return this.receiveFunc(port, event, index, payload, send);
  }
}

class PseudoRuntime extends EventEmitter {
  constructor(httpServer) {
    super();
    this.connections = [];
    this.wsServer = new WebSocketServer({ httpServer });
    this.wsServer.on('request', (request) => {
      const connection = request.accept('noflo', request.origin);
      this.connections.push(connection);
      connection.on('message', (message) => this.handleMessage(message, connection));
      connection.on('close', () => {
        if (this.connections.indexOf(connection) === -1) {
          return;
        }
        this.connections.splice(this.connections.indexOf(connection), 1);
      });
    });
  }

  handleMessage(message, connection) {
    let msg;
    if (!message.type === 'utf8') { return; }
    try {
      msg = JSON.parse(message.utf8Data);
    } catch (e) {
      return;
    }

    if ((msg.protocol === 'runtime') && (msg.command === 'getruntime')) {
      const rt = {
        type: 'remote-subgraph-test',
        version: '0.4',
        capabilities: ['protocol:runtime'],
      };
      connection.sendUTF(JSON.stringify({
        protocol: 'runtime',
        command: 'runtime',
        payload: rt,
      }));
      this.sendPorts();
    } if ((msg.protocol === 'runtime') && (msg.command === 'packet')) {
      this.receivePacket(msg.payload, connection);
    }
  }

  setComponent(component) {
    this.component = component;
    this.component.on('output', (port, event, index, payload) => {
      const packet = {
        port,
        event,
        payload,
        index,
      };
      this.sendPacket(packet);
    });
  }

  receivePacket(p) {
    // eslint-disable-next-line no-underscore-dangle
    this.component._receive(p.port, p.event, p.index, p.payload);
  }

  sendPacket(p) {
    const msg = {
      protocol: 'runtime',
      command: 'packet',
      payload: p,
    };
    this.sendAll(msg);
  }

  sendPorts() {
    const msg = {
      protocol: 'runtime',
      command: 'ports',
      payload: this.component.ports,
    };
    this.sendAll(msg);
  }

  sendAll(msg) {
    Array.from(this.connections).map((connection) => connection.sendUTF(JSON.stringify(msg)));
  }
}

const component = function (name) {
  return new PseudoComponent(name);
};

const Echo = function () {
  return component('Echo')
    .inports({ id: 'in', description: 'Data to echo' })
    .outports({ id: 'out', description: 'Echoed data' })
    .receive((port, index, event, payload, send) => send('out', index, event, payload));
};

const createServer = function (port, callback) {
  const server = new http.Server();
  const rt = new PseudoRuntime(server);
  runtime.setComponent(Echo());
  server.listen(port, (err) => callback(err, server));
  console.log(rt);
};

const createNoFloServer = function (port, callback) {
  const baseDir = path.join(__dirname, '../');

  const server = http.createServer(() => {});
  const options = {
    baseDir,
    captureOutput: false,
    catchExceptions: false,
  };
  runtime(server, options);
  server.listen(port, () => callback(null, server));
};

module.exports = {
  Echo,
  Component: PseudoComponent,
  Server: PseudoRuntime,
  createServer,
  createNoFloServer,
};
