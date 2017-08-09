exports.transports = {
  'websocket': require('./src/websocket'),
  'iframe': require('./src/iframe'),
  'opener': require('./src/opener'),
  'webrtc': require('./src/webrtc'),
  'base': require('./src/base')
};
exports.connection = require('./helpers/connection');

try {
  exports.transports.microflo = require('./src/microflo');
} catch (e) {
  console.log('fbp-protocol-client: MicroFlo transport unavailable: ' + e.message);
}

exports.getTransport = function (transport) {
  return exports.transports[transport];
};
