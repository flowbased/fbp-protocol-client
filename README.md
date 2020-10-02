# fbp-protocol-client

Implementation of [FBP runtime protocol](https://flowbased.github.io/fbp-protocol/)
connection handling for JavaScript (node.js + browser).

For higher-level FBP protocol client, please take a look at [fbp-client](https://github.com/flowbased/fbp-client).

Changes
-------

* 0.3.3 (October 02 2020)
  - Improved connection error handling for both WebSocket and WebRTC runtimes
* 0.3.2 (October 01 2020)
  - Support for `webrtc://#<runtimeId>` address shorthand
* 0.3.1 (October 01 2020)
  - Improved WebRTC signalling reliability
* 0.3.0 (September 29 2020)
  - WebRTC transport is now also supported on Node.js
  - Fixed an issue with `opener` transport message filtering
  - Ported from CoffeeScript to modern ES6
* 0.2.5 (March 28 2018)
  - Fixed `iframe` transport updating iframe contents after main graph is set
  - Added support for setting main graph to `NULL`
* 0.2.4 (March 22 2018)
  - Made `iframe` and `opener` transports filter out messages coming from elsewhere than the runtime. Fixes compatibility with es6-shim
* 0.2.3 (March 21 2018)
  - Added `sendTrace` method for sending trace subprotocol messages
  - Added `trace` event for incoming trace subprotocol messages
  - Added `message` event for all incoming protocol messages
