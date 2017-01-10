Base = require './base'

class IframeRuntime extends Base
  constructor: (definition) ->
    @origin = window.location.origin
    @connecting = false
    @connected = false
    @buffer = []
    @iframe = null
    super definition

  getElement: -> @iframe

  isConnected: -> @connected

  setMain: (graph) ->
    if @graph
      # Unsubscribe from previous main graph
      @graph.removeListener 'changeProperties', @updateIframe

    # Update contents on property changes
    graph.on 'changeProperties', @updateIframe
    super graph

  setParentElement: (parent) ->
    @iframe = document.createElement 'iframe'
    @iframe.setAttribute 'sandbox', 'allow-scripts allow-same-origin allow-forms'
    parent.appendChild @iframe

  connect: ->
    unless @iframe
      throw new Error 'Unable to connect without a parent element'

    @iframe.addEventListener 'load', @onLoaded, false

    # Let the UI know we're connecting
    @connecting = true
    @emit 'status',
      online: false
      label: 'connecting'

    # Set the source to the iframe so that it can load
    @iframe.setAttribute 'src', @getAddress()

    # Set an ID for targeting purposes
    @iframe.id = 'preview-iframe'

    # Start listening for messages from the iframe
    window.addEventListener 'message', @onMessage, false

  updateIframe: =>
    return if !@iframe or !@graph
    env = @graph.properties.environment
    return if !env or !env.content
    @send 'iframe', 'setcontent', env.content

  disconnect: ->
    @iframe.removeEventListener 'load', @onLoaded, false
    @connected = false

    # Stop listening to messages
    window.removeEventListener 'message', @onMessage, false

    @emit 'status',
      online: false
      label: 'disconnected'
    @emit 'disconnected'

  # Called every time the iframe has loaded successfully
  onLoaded: =>
    @connecting = false
    @connected = true

    # Perform capability discovery
    @sendRuntime 'getruntime', {}

    @emit 'status',
      online: true
      label: 'connected'
    @emit 'connected'

    do @updateIframe

    @flush()

  send: (protocol, command, payload) ->
    if @connecting
      @buffer.push
        protocol: protocol
        command: command
        payload: payload
      return

    w = @iframe.contentWindow
    return unless w
    try
      return if w.location.href is 'about:blank'
      if w.location.href.indexOf('chrome-extension://') isnt -1
        throw new Error 'Use * for IFRAME communications in a Chrome app'
    catch e
      # Chrome Apps
      w.postMessage JSON.stringify(
        protocol: protocol
        command: command
        payload: payload
      ), '*'
      return
    w.postMessage JSON.stringify(
      protocol: protocol
      command: command
      payload: payload
    ), w.location.href

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
      @send item.protocol, item.command, item.payload
    @buffer = []

module.exports = IframeRuntime
