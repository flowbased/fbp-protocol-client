var debug = require('debug')('fbp-protocol-client');
exports.transports = {
  'websocket': require('./lib/websocket'),
  'iframe': require('./lib/iframe'),
  'opener': require('./lib/opener'),
  'webrtc': require('./lib/webrtc'),
  'base': require('./lib/base')
};
exports.connection = require('./helpers/connection');

try {
  exports.transports.microflo = require('./lib/microflo');
} catch (e) {
  debug('MicroFlo transport unavailable: ' + e.message);
}

exports.getTransport = function (transport) {
  return exports.transports[transport];
};
