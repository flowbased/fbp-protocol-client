Base = require './base'
debug = require('debug') 'fbp-protocol-client:webrtc'

class WebRTCRuntime extends Base
  constructor: (definition) ->
    super definition
    @peer = null
    @connecting = false
    @connection = null
    @protocol = 'webrtc'
    @buffer = []

  getElement: ->
    return null

  isConnected: ->
    return @connection != null

  connect: ->
    return if @connection or @connecting

    address = @getAddress()
    if (address.indexOf('#') != -1)
      signaller = address.split('#')[0]
      id = address.split('#')[1]
    else
      signaller = 'https://api.flowhub.io'
      id = address

    options =
      room: id
      debug: true
      channels:
        chat: true
      signaller: signaller
      capture: false
      constraints: false
      expectedLocalStreams: 0

    @peer = RTC options
    @peer.on 'channel:opened:chat', (id, dc) =>
      @connection = dc
      @connection.onmessage = (data) =>
        debug 'message', data.data
        @handleMessage data.data
      @connecting = false
      @sendRuntime 'getruntime', {}
      @emit 'status',
        online: true
        label: 'connected'
      @emit 'connected'
      @flush()

    @peer.on 'channel:closed:chat', (id, dc) =>
      dc.onmessage = null
      @connection = null
      @emit 'status',
        online: false
        label: 'disconnected'
      @emit 'disconnected'

    @connecting = true

  disconnect: ->
    return unless @connection
    @connecting = false
    @connection.close()
    @connection = null
    @emit 'disconnected'

  send: (protocol, command, payload) ->
    m = @_prepareMessage protocol, command, payload
    if @connecting
      @buffer.push m
      return

    return unless @connection
    debug 'send', m
    @connection.send JSON.stringify m

  handleError: (error) =>
    @connection = null
    @connecting = false

  handleMessage: (message) =>
    msg = JSON.parse message
    @recvMessage msg

  flush: ->
    for item in @buffer
      @send item.protocol, item.command, item.payload
    @buffer = []

module.exports = WebRTCRuntime
