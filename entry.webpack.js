var exported = {
  'fbp-protocol-client': require('./index'),
  'events': require('events')
};

if (window) {
  window.require = function (moduleName) {
    if (exported[moduleName]) {
      return exported[moduleName];
    }
    throw new Error('Module ' + moduleName + ' not available');
  };
}


