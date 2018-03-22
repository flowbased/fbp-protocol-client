Base = require './base'

class OpenerRuntime extends Base
  constructor: (definition) ->
    super definition
    @connecting = false
    @connected = false
    @buffer = []

  getElement: -> null

  isConnected: -> @connected

  setMain: (graph) ->
    if @graph
      # Unsubscribe from previous main graph
      @graph.removeListener 'changeProperties', @updateIframe

    # Update contents on property changes
    graph.on 'changeProperties', @updateIframe

    super graph

  setParentElement: (parent) ->
    return

  connect: ->
    # Let the UI know we're connecting
    @connecting = true
    @emit 'status',
      online: false
      label: 'connecting'

    # Start listening for messages from the iframe
    window.addEventListener 'message', @onMessage, false

    @once 'capabilities', =>
      # Runtime responded with a capabilities message. We're live!
      @connecting = false
      @connected = true
      @emit 'status',
        online: true
        label: 'connected'
      @emit 'connected'
      @flush()

    # Request capabilities from opener
    @postMessage 'runtime', 'getruntime', {}
    timeout = setTimeout =>
      # Keep trying until runtime responds
      @postMessage 'runtime', 'getruntime', {}
    , 500

  updateIframe: ->
    return

  disconnect: ->
    @connected = false

    # Stop listening to messages
    window.removeEventListener 'message', @onMessage, false

    @emit 'status',
      online: false
      label: 'disconnected'
    @emit 'disconnected'

  send: (protocol, command, payload) ->
    if @connecting
      @buffer.push
        protocol: protocol
        command: command
        payload: payload
      return
    @postMessage protocol, command, payload

  postMessage: (protocol, command, payload) ->
    return unless window.opener
    window.opener.postMessage JSON.stringify(
      protocol: protocol
      command: command
      payload: payload
    ), '*'

  onMessage: (message) =>
    if message.source and message.source isnt @iframe.contentWindow
      # Message from unrelated source
      return
    if typeof message.data is 'string'
      data = JSON.parse message.data
    else
      data = message.data
    @recvMessage data

  flush: ->
    for item in @buffer
      @postMessage item.protocol, item.command, item.payload
    @buffer = []

module.exports = OpenerRuntime
