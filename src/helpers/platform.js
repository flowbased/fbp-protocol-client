const {
  EventEmitter,
} = require('events');

const isBrowser = () => !((typeof (process) !== 'undefined') && process.execPath && (process.execPath.indexOf('node') !== -1));

module.exports = {
  isBrowser,
  EventEmitter,
  WebSocket: isBrowser() ? window.WebSocket : require('websocket').w3cwebsocket,
};
