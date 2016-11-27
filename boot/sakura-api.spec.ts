import {
  SakuraApi,
  ServerConfig
}                   from './sakura-api';
import * as request from 'supertest';
import * as http    from 'http';

describe('SakuraApi', () => {

  let config = new ServerConfig();
  let sapi: SakuraApi;
  beforeEach(() => {
    config.port = 9000;
    config.address = '127.0.0.1';

    sapi = SakuraApi.instance;

    spyOn(sapi.server, 'listen').and.callThrough();
    spyOn(console, 'log');
  });

  afterEach((done) => {
    sapi
      .close()
      .then(done)
      .catch(done.fail);
  });

  it('port property defaults to a valid integer > 1000', () => {
    expect(sapi.port).toBeDefined();
    expect(typeof  sapi.port).toBe('number');
    expect(sapi.port).toBeGreaterThanOrEqual(1000);
  });

  it('app property exposes the Express app object used for construction', () => {
    expect(sapi.app).toBeDefined();
    expect(typeof sapi.app).toBe('function');
  });

  describe('listen(...)', () => {
    it('bootstraps Express with defaulting settings when no parameters are provided', (done) => {
      sapi
        .listen()
        .then(() => {
          expect(sapi.server.listen).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledTimes(1);
          expect(sapi.port).toBeGreaterThanOrEqual(1000);
          expect(sapi.address).toEqual('127.0.0.1');
          done();
        })
        .catch((err) => {
          expect(err).toBeUndefined();
          done();
        });
    });

    it('sets the port, when provided', (done) => {
      config.port = 7777;

      sapi
        .listen(config)
        .then(() => {
          expect(sapi.port).toEqual(config.port);
          expect(sapi.server.listening).toEqual(true);
          expect(sapi.server.address().port).toEqual(config.port);
          done();
        })
        .catch(done.fail);
    });

    it('sets the address, when provided', (done) => {
      config.address = 'localhost';

      sapi
        .listen(config)
        .then(() => {
          expect(sapi.port).toEqual(config.port);
          expect(sapi.server.listening).toEqual(true);
          expect(sapi.server.address().address).toEqual('127.0.0.1');
          done();
        })
        .catch(done.fail);
    });

    it('responds to a route setup in middleware', (done) => {
      sapi
        .listen(config)
        .then(() => {
          sapi
            .app
            .get('/test', function (req, res) {
              res.status(200).json({isTest: true});
            });

          request(sapi.app)
            .get('/test')
            .expect('Content-Type', /json/)
            .expect('Content-Length', '15')
            .expect('{"isTest":true}')
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done.fail(err);
              }
              done();
            });
        })
        .catch(done.fail);
    });
  });

  describe('close(...)', () => {
    it('closes the port when told to', (done) => {
      sapi
        .listen()
        .then(() => {
          expect(sapi.server.listening).toBe(true);
          sapi
            .close()
            .then(() => {
              expect(sapi.server.listening).toBe(false);
              done();
            })
            .catch(done.fail);
        })
        .catch(done.fail);
    });
  });
});
