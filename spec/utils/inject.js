/* eslint-disable */
if (typeof global !== 'undefined') {
  // Node.js injections for Mocha tests
  global.chai = require('chai');
  global.client = require('../../index');
} else {
  window.client = require('fbp-protocol-client');
}
