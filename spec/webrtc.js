const noflo = require('noflo');

const {
  EventEmitter,
} = require('events');

let client;
if (!noflo.isBrowser()) {
  client = require('../index');
} else {
  // eslint-disable-next-line
  client = require('fbp-protocol-client');
}

const Base = client.getTransport('base');
const WebRtcRuntime = client.getTransport('webrtc');

const describeIfBrowser = noflo.isBrowser() ? describe : describe.skip;

class FakeRuntime extends EventEmitter {
  constructor(address) {
    super();
    if (address.indexOf('#') !== -1) {
      this.signaller = address.split('#')[0];
      this.id = address.split('#')[1];
    } else {
      this.signaller = 'https://api.flowhub.io';
      this.id = address;
    }

    console.log(this.signaller, this.id);

    this.channel = null;
    const options = {
      room: this.id,
      debug: true,
      channels: {
        chat: true,
      },
      signaller: this.signaller,
      capture: false,
      constraints: false,
      expectedLocalStreams: 0,
    };
    // eslint-disable-next-line
    const peer = RTC(options);
    peer.on('channel:opened:chat', (id, dc) => {
      console.log('fakeruntime opened');
      this.channel = dc;
      this.channel.onmessage = (data) => {
        const msg = JSON.parse(data.data);
        this.emit('message', msg);
        if ((msg.protocol === 'runtime') && (msg.command === 'getruntime')) {
          // reply so we are considered to be connected
          this.send('runtime', 'runtime', {
            type: 'noflo-browser',
            version: '0.4',
            capabilities: ['protocol:graph'],
          });
        }
      };
    });
  }

  send(protocol, topic, payload) {
    const msg = {
      protocol,
      command: topic,
      payload,
    };
    const m = JSON.stringify(msg);
    this.channel.send(m);
  }
}

describeIfBrowser('WebRTC', () => describeIfBrowser('transport', () => {
  let runtime = null;
  const id = '2ef763ff-1f28-49b8-b58f-5c9a5c23af2f';
  const def = {
    label: 'NoFlo over WebRTC',
    description: 'Open any client-side NoFlo app in Flowhub',
    type: 'noflo-browser',
    protocol: 'webrtc',
    address: id,
    secret: 'my-super-secret',
    id,
    user: '3f3a8187-0931-4611-8963-239c0dff1931',
    seenHoursAgo: 11,
  };

  let target;
  before((done) => {
    target = new FakeRuntime(def.address);
    console.log(target);
    done();
  });
  after((done) => {
    target = null;
    done();
  });

  it('should be instantiable', () => {
    runtime = new WebRtcRuntime(def);
    chai.expect(runtime).to.be.an.instanceof(Base);
  });
  it('should not be connected initially', () => chai.expect(runtime.isConnected()).to.equal(false));
  it('should emit "connected" on connect()', function (done) {
    if (window._phantom) {
      this.skip();
      return;
    }
    this.timeout(10000);
    console.log('running connect()');
    runtime.once('connected', () => {
      const connected = runtime.isConnected();
      console.log('connected', connected);
      chai.expect(connected).to.equal(true);
      done();
    });
    runtime.connect();
    console.log('connect() done');
  });
  it('should emit "disconnected" on disconnect()', function (done) {
    if (window._phantom) {
      this.skip();
      return;
    }
    this.timeout(10000);
    runtime.once('disconnected', () => {
      chai.expect(runtime.isConnected()).to.equal(false);
      done();
    });
    runtime.disconnect();
  });
}));
