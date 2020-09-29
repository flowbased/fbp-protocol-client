const noflo = require('noflo');
const Peer = require('simple-peer');
const { v4: uuid } = require('uuid');

const {
  EventEmitter,
} = require('events');

const Base = client.getTransport('base');
const WebRtcRuntime = client.getTransport('webrtc');
const Signaller = client.signaller;

class FakeRuntime extends EventEmitter {
  constructor(address) {
    super();
    if (address.indexOf('#') !== -1) {
      this.signaller = address.split('#')[0];
      this.id = address.split('#')[1];
    } else {
      this.signaller = 'ws://api.flowhub.io/';
      this.id = address;
    }

    const signaller = new Signaller(this.signaller, uuid());

    this.channel = null;
    const options = {
      channelName: this.id,
    };
    if (!noflo.isBrowser()) {
      // eslint-disable-next-line
      options.wrtc = require('wrtc');
    }
    this.peer = new Peer(options);
    signaller.connect();
    signaller.once('connected', () => {
      signaller.announce(this.id);
    });
    signaller.on('signal', (data) => {
      if (!this.peer && !this.peer.destroyed) {
        return;
      }
      this.peer.signal(data);
    });
    this.peer.on('signal', (data) => {
      signaller.announce(this.id, data);
    });
    this.peer.on('data', (data) => {
      const msg = JSON.parse(data);
      this.emit('message', msg);
      if ((msg.protocol === 'runtime') && (msg.command === 'getruntime')) {
        // reply so we are considered to be connected
        this.send('runtime', 'runtime', {
          type: 'noflo-browser',
          version: '0.7',
          capabilities: ['protocol:graph'],
        });
      }
    });
  }

  send(protocol, topic, payload) {
    const msg = {
      protocol,
      command: topic,
      payload,
    };
    const m = JSON.stringify(msg);
    this.peer.send(m);
  }
}

describe('WebRTC', () => {
  describe('transport', () => {
    let runtime = null;
    const id = uuid();
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
      console.log(target.signaller, target.id);
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
    it('should not be connected initially', () => {
      chai.expect(runtime.isConnected()).to.equal(false);
    });
    it('should emit "connected" on connect()', function (done) {
      this.timeout(5000);
      runtime.once('connected', () => {
        const connected = runtime.isConnected();
        chai.expect(connected).to.equal(true);
        runtime.removeListener('error', done);
        done();
      });
      runtime.once('error', done);
      runtime.connect();
    });
    it('should send runtime details when requested', function (done) {
      if (!runtime.isConnected()) {
        this.skip();
        return;
      }
      runtime.once('runtime', (data) => {
        chai.expect(data.command).to.equal('runtime');
        chai.expect(data.payload.type).to.equal('noflo-browser');
        done();
      });
      runtime.sendRuntime('getruntime', {});
    });
    it('should emit "disconnected" on disconnect()', function (done) {
      if (!runtime.isConnected()) {
        this.skip();
        return;
      }
      runtime.once('disconnected', () => {
        chai.expect(runtime.isConnected()).to.equal(false);
        done();
      });
      runtime.disconnect();
    });
  });
});
