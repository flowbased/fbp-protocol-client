const debug = require('debug')('fbp-protocol-client:platform');

const {
  EventEmitter,
} = require('events');

const isBrowser = () => !((typeof (process) !== 'undefined') && process.execPath && (process.execPath.indexOf('node') !== -1));

// Simple compatibility layer between node.js WebSocket client and native browser APIs
// Respects events: open, close, message, error
// Note: no data is passed with open and close events
class NodeWebSocketClient extends EventEmitter {
  constructor(address, protocol) {
    super();
    const WebSocketClient = require('websocket').client;
    this.client = new WebSocketClient(); // the real client
    this.connection = null;

    this.client.on('connectFailed', (error) => this.emit('error', error));
    this.client.on('connect', (connection) => {
      if (this.connection) { debug('WARNING: multiple connections for one NodeWebSocketClient'); }
      this.connection = connection;
      connection.on('error', (error) => {
        this.connection = null;
        this.emit('error', error);
      });
      connection.on('close', () => {
        this.connection = null;
        this.emit('close');
      });
      connection.on('message', (message) => {
        this.emit('message', {
          ...message,
          data: message.utf8Data,
        });
      });

      this.emit('open');
    });

    this.client.connect(address, protocol);
  }

  addEventListener(event, listener) {
    this.on(event, listener);
  }

  close() {
    if (!this.connection) { return; }
    this.connection.close();
    this.connection = null;
  }

  send(msg) {
    this.connection.sendUTF(msg);
  }
}

module.exports = {
  isBrowser,
  EventEmitter,
  WebSocket: isBrowser() ? window.WebSocket : NodeWebSocketClient,
};
