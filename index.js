exports.transports = {
  'websocket': require('./src/websocket'),
  'microflo': require('./src/microflo'),
  'iframe': require('./src/iframe'),
  'webrtc': require('./src/webrtc')
};

try {
  exports.transports.microflo = require('./src/microflo');
} catch (e) {
  console.log('MicroFlo transport unavailable: ' + e.message);
}

exports.getTransport = function (transport) {
  return exports.transports[transport];
};
