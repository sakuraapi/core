import {
  SakuraApi,
  ServerConfig
} from './sakura-api';
import {
  Routable,
  Route
} from './@routable/';
import {MongoClient} from 'mongodb';
import {SakuraApiConfig} from '../boot/sakura-api-config';
import {Sapi} from '../spec/helpers/sakuraapi';

import * as request from 'supertest';
import Spy = jasmine.Spy;

describe('core/SakuraApi', function() {
  const sapi = Sapi();

  @Routable(sapi)
  class RoutableTest {
    response = 'testRouterGet worked';

    constructor() {
    }

    @Route({
      path: 'testRouterGet',
      method: 'get'
    })
    testRouterGet(req, res) {
      res.status(200)
         .json({
           testRouterGet: this.response
         });
    }
  }

  beforeEach(function() {
    this.config = {bootMessage: ''} as ServerConfig;
    this.config.port = 9000;
    this.config.address = '127.0.0.1';
    this.config.bootMessage = '';

    spyOn(sapi.server, 'listen').and.callThrough();
  });

  afterEach(function(done) {
    sapi
      .close()
      .then(done)
      .catch(done.fail);
  });

  it('port property defaults to a valid integer > 1000', function() {
    expect(sapi.port).toBeDefined();
    expect(typeof  sapi.port).toBe('number');
    expect(sapi.port).toBeGreaterThanOrEqual(1000);
  });

  it('app property exposes the Express app object used for construction', function() {
    expect(sapi.app).toBeDefined();
    expect(typeof sapi.app).toBe('function');
  });

  it('config is loaded properly', function() {
    expect(sapi.config.SAKURA_API_CONFIG_TEST).toBe('found');
  });

  describe('middleware', function() {
    let sak = new SakuraApi();
    sak.baseUri = '/testApi';

    @Routable(sak, {
      baseUrl: 'middleware'
    })
    class MiddleWareTest {
      @Route({
        method: 'get',
        path: 'test'
      })
      test(req, res) {
        res
          .status(200)
          .json({result: req.bootStrapTest});
      }
    }

    afterEach(function(done) {
      sak
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('injects middleware before @Routable classes', function(done) {
      sak
        .addMiddleware((req, res, next) => {
          (req as any).bootStrapTest = 778;
          next();
        });

      sak
        .listen({bootMessage: ''})
        .then(() => {
          request(sak.app)
            .get(this.uri('/middleware/test'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '14')
            .expect('{"result":778}')
            .expect(200)
            .then(() => {
              sak
                .close()
                .then(done)
                .catch(done.fail);
            });
        })
        .catch(done.fail);
    });

  });

  describe('listen(...)', function() {
    it('bootstraps Express with defaulting settings when no parameters are provided', function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => {
          expect(sapi.server.listen).toHaveBeenCalledTimes(1);
          expect(sapi.port).toBeGreaterThanOrEqual(1000);
          expect(sapi.address).toEqual('127.0.0.1');
        })
        .then(() => {
          sapi
            .close()
            .then(done)
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('sets the port, when provided', function(done) {
      this.config.port = 7777;

      sapi
        .listen(this.config)
        .then(() => {
          expect(sapi.port).toEqual(this.config.port);
          expect(sapi.server.listening).toEqual(true);
          expect(sapi.server.address().port).toEqual(this.config.port);
        })
        .then(() => {
          sapi
            .close()
            .then(done)
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('sets the address, when provided', function(done) {
      this.config.address = 'localhost';

      sapi
        .listen(this.config)
        .then(() => {
          expect(sapi.port).toEqual(this.config.port);
          expect(sapi.server.listening).toEqual(true);
          expect(sapi.server.address().address).toEqual('127.0.0.1');
        })
        .then(() => {
          sapi
            .close()
            .then(done)
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('responds to a route setup in middleware', function(done) {
      sapi
        .listen(this.config)
        .then(() => {
          // setup middleware
          sapi
            .app
            .get('/middleWareTest', function(req, res) {
              res
                .status(200)
                .json({isTest: true});
            });

          // test it
          request(sapi.app)
            .get('/middleWareTest')
            .expect('Content-Type', /json/)
            .expect('Content-Length', '15')
            .expect('{"isTest":true}')
            .expect(200)
            .then(() => {
              sapi
                .close()
                .then(done)
                .catch(done.fail);
            })
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('connects to databases', function(done) {
      spyOn(MongoClient, 'connect').and.callThrough();

      sapi['_dbConnections'] = SakuraApiConfig.dataSources({
        dbConnections: [
          {
            name: 'testDb',
            url: `${this.mongoDbBaseUri(sapi)}/testDb`
          }
        ]
      });

      sapi
        .listen(this.config)
        .then(() => {
          sapi
            .app
            .get('/middleWareTest', function(req, res) {
              res
                .status(200)
                .json({isTest: true});
            });

          request(sapi.app)
            .get('/middleWareTest')
            .expect('Content-Type', /json/)
            .expect('Content-Length', '15')
            .expect('{"isTest":true}')
            .expect(200)
            .then(() => {
              expect(MongoClient.connect).toHaveBeenCalledTimes(1);

              sapi
                .dbConnections
                .getDb('testDb')
                .collection('testCollection')
                .insertOne({someValue: 777})
                .then((results) => {
                  expect(results.insertedCount).toBe(1);
                })
                .then(() => {
                  sapi
                    .close()
                    .then(done)
                    .catch(done.fail);
                })
                .catch(done.fail)
            })
            .catch(done.fail)
        })
        .catch(done.fail);
    });
  });

  describe('close(...)', function() {
    it('closes the port when told to', function(done) {
      sapi
        .listen({bootMessage: ''})
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

  describe('route(...)', function() {
    it('takes a @Routable class and adds the proper routes to express', function(done) {
      // note: the @Routable decorator logic called the route(...) method and passed its Class instance
      // that it instantiated, which caused .route(...) to be called (magic)
      sapi
        .listen(this.config)
        .then(() => {
          return request(sapi.app)
            .get(this.uri('/testRouterGet'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '40')
            .expect('{"testRouterGet":"testRouterGet worked"}')
            .expect(200)
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });

    it('injects res.locals and sends a response', function(done) {

      @Routable(sapi)
      class InjectsResBodyDataTest {
        @Route({
          path: 'injectsResBodyDataTest',
          method: 'get'
        })
        testRouterGet(req, res, next) {

          res.locals.data.test = 'injected';
          res.locals.status = 277;
          next();
        }
      }

      sapi
        .listen(this.config)
        .then(() => {
          return request(sapi.app)
            .get(this.uri('/injectsResBodyDataTest'))
            .expect('{"test":"injected"}')
            .expect(277);
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });
  });
});

