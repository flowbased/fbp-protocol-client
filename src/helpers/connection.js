// Code for connecting between a noflo.Graph instance and a noflo-runtime

exports.sendGraph = function (graph, runtime, callback, main) {
  if (graph.properties.environment != null ? graph.properties.environment.type : undefined) {
    if (!['all', runtime.definition.type].includes(graph.properties.environment.type)) {
      callback(new Error(`Graph type ${graph.properties.environment.type} doesn't match runtime type ${runtime.definition.type}`));
      return;
    }
  }

  if (!runtime.canDo('protocol:graph')) {
    callback(new Error('Runtime doesn\'t support graph protocol'));
    return;
  }

  const graphId = graph.name || graph.properties.id;
  runtime.sendGraph('clear', {
    id: graphId,
    name: graph.name,
    main,
    library: graph.properties.project,
    icon: graph.properties.icon || '',
    description: graph.properties.description || '',
  });
  graph.nodes.forEach((node) => {
    runtime.sendGraph('addnode', {
      id: node.id,
      component: node.component,
      metadata: node.metadata,
      graph: graphId,
    });
  });
  graph.edges.forEach((edge) => {
    runtime.sendGraph('addedge', {
      src: {
        node: edge.from.node,
        port: edge.from.port,
      },
      tgt: {
        node: edge.to.node,
        port: edge.to.port,
      },
      metadata: edge.metadata,
      graph: graphId,
    });
  });
  graph.initializers.forEach((iip) => {
    runtime.sendGraph('addinitial', {
      src: {
        data: iip.from.data,
      },
      tgt: {
        node: iip.to.node,
        port: iip.to.port,
      },
      metadata: iip.metadata,
      graph: graphId,
    });
  });
  if (graph.inports) {
    Object.keys(graph.inports).forEach((pub) => {
      const priv = graph.inports[pub];
      runtime.sendGraph('addinport', {
        public: pub,
        node: priv.process,
        port: priv.port,
        graph: graphId,
      });
    });
  }
  if (graph.outports) {
    Object.keys(graph.outports).forEach((pub) => {
      const priv = graph.outports[pub];
      runtime.sendGraph('addoutport', {
        public: pub,
        node: priv.process,
        port: priv.port,
        graph: graphId,
      });
    });
  }

  callback();
};
