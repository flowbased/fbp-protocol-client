# fbp-protocol-client [![Build Status](https://travis-ci.org/flowbased/fbp-protocol-client.svg?branch=master)](https://travis-ci.org/flowbased/fbp-protocol-client) [![Greenkeeper badge](https://badges.greenkeeper.io/flowbased/fbp-protocol-client.svg)](https://greenkeeper.io/)

Implementation of [FBP runtime protocol](https://flowbased.github.io/fbp-protocol/)
for JavaScript (node.js + browser).

Changes
-------

* 0.2.3 (March 21 2018)
  - Added `sendTrace` method for sending trace subprotocol messages
  - Added `trace` event for incoming trace subprotocol messages
  - Added `message` event for all incoming protocol messages
