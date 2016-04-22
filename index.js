exports.transports = {
  'websocket': require('./src/websocket'),
  'iframe': require('./src/iframe'),
  'webrtc': require('./src/webrtc')
};

try {
  exports.transports.microflo = require('./src/microflo');
} catch (e) {
  console.log('fbp-protocol-client: microflo:// transport unavailable: ' + e.message);
}

exports.getTransport = function (transport) {
  return exports.transports[transport];
};
