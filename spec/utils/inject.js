/* eslint-disable */
if (typeof global !== 'undefined') {
  // Node.js injections for Mocha tests
  global.chai = require('chai');
  global.client = require('../../index');
  global.uuid = require('uuid').v4;
  global.noflo = require('noflo');
} else {
  window.client = require('fbp-protocol-client');
  window.uuid = require('uuid').v4;
  window.noflo = require('noflo');
}
