const exported = {
  // eslint-disable-next-line import/no-extraneous-dependencies
  noflo: require('noflo'),
  events: require('events'),
  'simple-peer': require('simple-peer'),
  'uuid': require('uuid'),
  'fbp-protocol-client': require('./index'),
};

if (window) {
  window.require = function (moduleName) {
    if (exported[moduleName]) {
      return exported[moduleName];
    }
    throw new Error(`Module ${moduleName} not available`);
  };
}
