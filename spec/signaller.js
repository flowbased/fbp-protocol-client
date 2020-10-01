describe('Signaller', () => {
  const connectSignaller = (signaller, callback) => {
    if (signaller.isConnected()) {
      callback();
      return;
    }
    signaller.once('error', callback);
    signaller.once('connected', () => {
      signaller.removeListener('error', callback);
      callback();
    });
    signaller.connect();
  };
  const disconnectSignaller = (signaller, callback) => {
    if (!signaller.isConnected()) {
      callback();
      return;
    }
    signaller.once('error', callback);
    signaller.once('disconnected', () => {
      signaller.removeListener('error', callback);
      callback();
    });
    signaller.disconnect();
  };
  [
    {
      name: 'with default server',
      browser: true,
    },
  ].forEach((variant) => {
    if (noflo.isBrowser() && !variant.browser) {
      return;
    }

    describe(`${variant.name}`, () => {
      if (variant.before) {
        before(variant.before);
      }
      if (variant.after) {
        after(variant.after);
      }
      const getSignaller = () => {
        if (variant.instantiate) {
          return variant.instantiate();
        }
        return new client.Signaller(uuid());
      };
      const signaller1 = getSignaller();
      const signaller2 = getSignaller();
      it('should be able to connect', (done) => {
        connectSignaller(signaller1, done);
      });
      describe('during session', () => {
        const roomId = uuid();
        before((done) => {
          connectSignaller(signaller2, (err) => {
            if (err) {
              done(err);
              return;
            }
            signaller2.join(roomId);
            setTimeout(done, 100);
          });
        });
        after((done) => {
          disconnectSignaller(signaller2, done);
        });
        it('should be able to join a room', (done) => {
          signaller2.once('join', (peer) => {
            chai.expect(peer.id).to.equal(signaller1.id);
            done();
          });
          signaller1.join(roomId);
        });
        it('should be able to receive a DM from a peer', (done) => {
          signaller1.once('signal', (signal, peer) => {
            chai.expect(signal.hello).to.equal('World');
            chai.expect(peer.id).to.equal(signaller2.id);
            done();
          });
          signaller2.signal(signaller1.id, {
            hello: 'World',
          });
        });
        it('should be able to send a DM to a peer', (done) => {
          signaller2.once('signal', (signal, peer) => {
            chai.expect(signal.hello).to.equal('NoFlo');
            chai.expect(peer.id).to.equal(signaller1.id);
            done();
          });
          signaller1.signal(signaller2.id, {
            hello: 'NoFlo',
          });
        });
        it('should be able to disconnect', (done) => {
          disconnectSignaller(signaller1, done);
        });
      });
    });
  });
});
