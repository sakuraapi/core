// tslint:disable:no-shadowed-variable

import {NextFunction, Request, Response} from 'express';
import {MongoClient} from 'mongodb';
import * as request from 'supertest';
import {SakuraApiConfig} from '../boot/sakura-api-config';
import {testMongoDbUrl, testSapi, testUrl} from '../spec/helpers/sakuraapi';
import {Json} from './@model/json';
import {Model} from './@model/model';
import {SakuraApiModel} from './@model/sakura-api-model';
import {Routable, Route} from './@routable/';
import {SakuraApi, SakuraApiPluginResult} from './sakura-api';
import Spy = jasmine.Spy;

describe('core/SakuraApi', () => {

  @Routable()
  class RoutableTest {
    response = 'testRouterGet worked';

    @Route({
      method: 'get',
      path: 'testRouterGet'
    })
    testRouterGet(req, res) {
      res.status(200)
        .json({
          testRouterGet: this.response
        });
    }
  }

  const sapi = testSapi({
    models: [],
    routables: [RoutableTest]
  });

  beforeEach(() => {
    this.config = {bootMessage: ''};
    this.config.port = 9000;
    this.config.address = '127.0.0.1';
    this.config.bootMessage = '';

    spyOn(sapi.server, 'listen').and.callThrough();
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

  it('config is loaded properly', () => {
    expect(sapi.config.SAKURA_API_CONFIG_TEST).toBe('found');
  });

  describe('middleware', () => {

    @Routable({
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

    const sapi = testSapi({
      models: [],
      routables: [MiddleWareTest]
    });

    it('injects middleware before @Routable classes', (done) => {
      sapi
        .addMiddleware((req, res, next) => {
          (req as any).bootStrapTest = 778;
          next();
        });

      sapi
        .listen({bootMessage: ''})
        .then(() => {
          return request(sapi.app)
            .get(testUrl('/middleware/test'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '14')
            .expect('{"result":778}')
            .expect(200);
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });
  });

  describe('listen(...)', () => {
    it('bootstraps Express with defaulting settings when no parameters are provided', (done) => {
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

    it('sets the port, when provided', (done) => {
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

    it('sets the address, when provided', (done) => {
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

    it('responds to a route setup in middleware', (done) => {
      sapi
        .listen(this.config)
        .then(() => {
          // setup middleware
          sapi
            .app
            .get('/middleWareTest', (req, res) => {
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

    it('connects to databases', (done) => {
      spyOn(MongoClient, 'connect').and.callThrough();

      (sapi as any)._dbConnections = SakuraApiConfig.dataSources({
        dbConnections: [
          {
            name: 'testDb',
            url: `${testMongoDbUrl(sapi)}/testDb`
          }
        ]
      });

      sapi
        .listen(this.config)
        .then(() => {
          sapi
            .app
            .get('/middleWareTest', (req, res) => {
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
                .catch(done.fail);
            })
            .catch(done.fail);
        })
        .catch(done.fail);
    });
  });

  describe('close(...)', () => {
    it('closes the port when told to', (done) => {
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

  describe('route(...)', () => {

    it('takes a @Routable class and adds the proper routes to express', (done) => {
      // note: the @Routable decorator logic called the route(...) method and passed its Class instance
      // that it instantiated, which caused .route(...) to be called (magic)
      sapi
        .listen(this.config)
        .then(() => {
          return request(sapi.app)
            .get(testUrl('/testRouterGet'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '40')
            .expect('{"testRouterGet":"testRouterGet worked"}')
            .expect(200);
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });

    it('injects res.locals and sends a response', (done) => {

      @Routable()
      class InjectsResBodyDataTest {
        @Route({
          method: 'get',
          path: 'injectsResBodyDataTest'
        })
        testRouterGet(req, res, next) {
          res.locals.send(277, {test: 'injected'}, res);
          next();
        }
      }

      const sapi = testSapi({
        models: [],
        routables: [InjectsResBodyDataTest]
      });

      sapi
        .listen(this.config)
        .then(() => {
          return request(sapi.app)
            .get(testUrl('/injectsResBodyDataTest'))
            .expect('{"test":"injected"}')
            .expect(277);
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });
  });

  describe('plugins', () => {

    function testPluginA(sapi: SakuraApi, options: any): SakuraApiPluginResult {

      function testHandler(req: Request, res: Response, next: NextFunction) {
        if (!res.locals.handlerTrace) {
          res.locals.handlerTrace = '';
        }
        res.locals.handlerTrace += res.locals.handlerTrace = options.value;
        next();
      }

      @Model()
      class TestModelPlugin extends SakuraApiModel {
        @Json()
        modelValue = 'found';
      }

      @Routable()
      class TestRoutablePlugin {
        @Route({
          method: 'get',
          path: 'TestRoutablePlugin'
        })
        getHandler(req: Request, res: Response, next: NextFunction) {
          const result = new TestModelPlugin();

          res
            .status(200)
            .json(result.toJson());
        }
      }

      return {
        middlewareHandlers: [testHandler],
        models: [TestModelPlugin],
        routables: [TestRoutablePlugin]
      };
    }

    function testPluginB(sapi: SakuraApi, options: any): SakuraApiPluginResult {
      function testHandler(req: Request, res: Response, next: NextFunction) {
        if (!res.locals.handlerTrace) {
          res.locals.handlerTrace = '';
        }
        res.locals.handlerTrace += res.locals.handlerTrace = options.value;
        next();
      }

      return {
        middlewareHandlers: [testHandler]
      };
    }

    @Routable()
    class RoutableTestStub {
      response = 'testRouterGet worked';

      @Route({
        method: 'get',
        path: 'plugins_test'
      })
      testRouterGet(req, res) {
        res
          .status(200)
          .json({
            testHandlerResult: res.locals.handlerTrace
          });
      }
    }

    const sapi = testSapi({
      plugins: [
        {
          options: {
            value: 'A'
          },
          order: 1,
          plugin: testPluginA
        },
        {
          options: {
            value: 'B'
          },
          order: 0,
          plugin: testPluginB
        }
      ],
      routables: [
        RoutableTestStub
      ]
    });

    beforeEach((done) => {
      sapi
        .listen({bootMessage: ''})
        .then(done)
        .catch(done.fail);
    });

    afterEach((done) => {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('adds plugin handlers in the proper order', (done) => {
      request(sapi.app)
        .get(testUrl('plugins_test'))
        .expect(200)
        .then((result) => {
          const body = result.body;
          expect(body.testHandlerResult).toBe('BA');
        })
        .then(done)
        .catch(done.fail);
    });

    it('adds plugin models and routables', (done) => {
      request(sapi.app)
        .get(testUrl('TestRoutablePlugin'))
        .expect(200)
        .then((result) => {
          const body = result.body;
          expect(body.modelValue).toBe('found');
        })
        .then(done)
        .catch(done.fail);
    });
  });
});
// tslint:enable:no-shadowed-variable
