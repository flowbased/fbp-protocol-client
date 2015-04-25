exports.transports = {
  'websocket': require('./src/websocket'),
  'microflo': require('./src/microflo'),
  'iframe': require('./src/iframe'),
  'webrtc': require('./src/webrtc')
};

exports.getTransport = function (transport) {
  return exports.transports[transport];
};
