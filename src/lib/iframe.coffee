Base = require './base'

class IframeRuntime extends Base
  constructor: (definition) ->
    super definition
    @origin = window.location.origin
    @connecting = false
    @connected = false
    @buffer = []
    @iframe = null

  getElement: -> @iframe

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
    if @iframe
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
    # Since the iframe runtime runs in user's browser, being loaded doesn't
    # necessarily mean that the runtime has started. Especially on slower
    # mobile devices the runtime initialization can still take a while.
    # Because of this we loop requesting runtime info until runtime
    # responds and only then consider ourselves connected.
    @once 'capabilities', =>
      # Runtime responded with a capabilities message. We're live!
      clearTimeout timeout if timeout
      @connecting = false
      @connected = true
      @emit 'status',
        online: true
        label: 'connected'
      @emit 'connected'

      do @updateIframe

      @flush()

    # Start requesting capabilities
    @postMessage 'runtime', 'getruntime', {}
    timeout = setTimeout =>
      # Keep trying until runtime responds
      @postMessage 'runtime', 'getruntime', {}
    , 500

  send: (protocol, command, payload) ->
    if @connecting
      @buffer.push
        protocol: protocol
        command: command
        payload: payload
      return
    @postMessage protocol, command, payload

  postMessage: (protocol, command, payload) ->
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
      @postMessage item.protocol, item.command, item.payload
    @buffer = []

module.exports = IframeRuntime
