Base = require './base'

class OpenerRuntime extends Base
  constructor: (definition) ->
    @connecting = false
    @connected = false
    @buffer = []
    super definition

  getElement: -> @window.opener

  isConnected: -> @connected

  setMain: (graph) ->
    if @graph
      # Unsubscribe from previous main graph
      @graph.removeListener 'changeProperties', @updateIframe

    # Update contents on property changes
    graph.on 'changeProperties', @updateIframe

    # Ensure iframe gets updated
    do @updateIframe

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
      clearTimeout timeout if timeout
      @connecting = false
      @connected = true
      @emit 'status',
        online: true
        label: 'connected'
      @emit 'connected'
      @flush()

    # Request capabilities from opener
    @postMessage 'runtime', 'getruntime', {}

  updateIframe: =>
    return unless @graph
    env = @graph.properties.environment
    return if !env or !env.content
    @send 'iframe', 'setcontent', env.content

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
    if typeof message.data is 'string'
      data = JSON.parse message.data
    else
      data = message.data
    switch data.protocol
      when 'runtime' then @recvRuntime data.command, data.payload
      when 'graph' then @recvGraph data.command, data.payload
      when 'network' then @recvNetwork data.command, data.payload
      when 'component' then @recvComponent data.command, data.payload

  flush: ->
    for item in @buffer
      @postMessage item.protocol, item.command, item.payload
    @buffer = []

module.exports = OpenerRuntime
