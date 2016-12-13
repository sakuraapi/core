import {
  SakuraApi,
  ServerConfig
}                   from './sakura-api';
import {
  Routable,
  Route
}                   from './@routable/routable';
import * as request from 'supertest';

describe('core/SakuraApi', function () {

  beforeEach(function () {
    this.config = new ServerConfig();
    this.config.port = 9000;
    this.config.address = '127.0.0.1';

    spyOn(this.sapi.server, 'listen').and.callThrough();
    spyOn(console, 'log');
  });

  afterEach(function (done) {
    this.sapi
      .close()
      .then(done)
      .catch(done.fail);
  });

  it('port property defaults to a valid integer > 1000', function () {
    expect(this.sapi.port).toBeDefined();
    expect(typeof  this.sapi.port).toBe('number');
    expect(this.sapi.port).toBeGreaterThanOrEqual(1000);
  });

  it('app property exposes the Express app object used for construction', function () {
    expect(this.sapi.app).toBeDefined();
    expect(typeof this.sapi.app).toBe('function');
  });

  it('config is loaded properly', function () {
    expect(this.sapi.config.SAKURA_API_CONFIG_TEST).toBe('found');
  });

  describe('listen(...)', function () {
    it('bootstraps Express with defaulting settings when no parameters are provided', function (done) {
      this.sapi
        .listen()
        .then(() => {
          expect(this.sapi.server.listen).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledTimes(1);
          expect(this.sapi.port).toBeGreaterThanOrEqual(1000);
          expect(this.sapi.address).toEqual('127.0.0.1');
          done();
        })
        .catch((err) => {
          expect(err).toBeUndefined();
          done();
        });
    });

    it('sets the port, when provided', function (done) {
      this.config.port = 7777;

      this.sapi
        .listen(this.config)
        .then(() => {
          expect(this.sapi.port).toEqual(this.config.port);
          expect(this.sapi.server.listening).toEqual(true);
          expect(this.sapi.server.address().port).toEqual(this.config.port);
          done();
        })
        .catch(done.fail);
    });

    it('sets the address, when provided', function (done) {
      this.config.address = 'localhost';

      this.sapi
        .listen(this.config)
        .then(() => {
          expect(this.sapi.port).toEqual(this.config.port);
          expect(this.sapi.server.listening).toEqual(true);
          expect(this.sapi.server.address().address).toEqual('127.0.0.1');
          done();
        })
        .catch(done.fail);
    });

    it('responds to a route setup in middleware', function (done) {
      this.sapi
        .listen(this.config)
        .then(() => {
          this.sapi
            .app
            .get('/middleWareTest', function (req, res) {
              res.status(200).json({isTest: true});
            });

          request(this.sapi.app)
            .get('/middleWareTest')
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

  describe('close(...)', function () {
    it('closes the port when told to', function (done) {
      this.sapi
        .listen()
        .then(() => {
          expect(this.sapi.server.listening).toBe(true);
          this.sapi
            .close()
            .then(() => {
              expect(this.sapi.server.listening).toBe(false);
              done();
            })
            .catch(done.fail);
        })
        .catch(done.fail);
    });
  });

  describe('route(...)', function () {
    it('takes a @Routable class and adds the proper routes to express', function (done) {
      // note: the @Routable decorator logic called the route(...) method and passed its Class instance
      // that it instantiated, which caused .route(...) to be called (magic)
      this.sapi
        .listen(this.config)
        .then(() => {
          request(this.sapi.app)
            .get(this.uri('/testRouterGet'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '40')
            .expect('{"testRouterGet":"testRouterGet worked"}')
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

});

@Routable()
class RoutableTest {
  response = 'testRouterGet worked';

  constructor() {
  }

  @Route({
    path: 'testRouterGet',
    method: 'get'
  })
  testRouterGet(req, res) {
    res.status(200).json({
      testRouterGet: this.response
    });
  }
}
