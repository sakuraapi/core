// tslint:disable:no-shadowed-variable

import {
  Request,
  Response
}                        from 'express';
import {MongoClient}     from 'mongodb';
import * as request      from 'supertest';
import {
  testMongoDbUrl,
  testSapi,
  testUrl
}                        from '../../spec/helpers/sakuraapi';
import {SakuraApiConfig} from '../../src/boot';
import {Model}           from './@model';

import {
  Routable,
  Route,
  SapiRoutableMixin
}                  from './@routable/';
import {
  Anonymous,
  AuthenticatorPlugin,
  AuthenticatorPluginResult,
  IAuthenticator,
  IAuthenticatorConstructor,
  SakuraApiPluginResult
}                  from './plugins';
import {SakuraApi} from './sakura-api';

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

  describe('dependency injection', () => {

    @Model()
    class TestDIModel {
    }

    @Model()
    class TestDIModelOverride {
    }

    @Routable({
      model: TestDIModel
    })
    class TestDIRoutable {
    }

    @Routable({
      model: TestDIModel
    })
    class TestDIRoutableOverride {
    }

    const sapi = testSapi({
      models: [TestDIModel],
      routables: [TestDIRoutable]
    });

    it('can retrieve Model by name', () => {
      // tslint:disable-next-line:variable-name
      const TestModel = sapi.getModelByName('TestDIModel');

      expect(TestModel).toBeDefined('Model should have been defined');
      expect(TestModel.fromJson({}) instanceof TestDIModel).toBeTruthy('Should have been an instance of TestDIModel ' +
        `but instead was an instsance of ${(TestModel.constructor || {} as any).name || TestModel.name}`);
    });

    it('can retrieve Routable by name', () => {
      // tslint:disable-next-line:variable-name
      const Routable = sapi.getRoutableByName('TestDIRoutable');

      expect(Routable).toBeDefined('Routable should have been defined');
      expect(new Routable() instanceof TestDIRoutable).toBeTruthy('Should have been an instance of TestDIRoutable ' +
        `but instead was an instsance of ${(Routable.constructor || {} as any).name || Routable.name}`);
    });

    it('allows allows overriding of @Model decorated class', () => {
      const sapi = testSapi({
        models: [{use: TestDIModelOverride, for: TestDIModel}],
        routables: [TestDIRoutable]
      });

      // tslint:disable-next-line:variable-name
      const TestModel = sapi.getModelByName('TestDIModel');
      const testModel = TestModel.fromJson({});

      expect(TestModel).toBeDefined('Model should have been defined');
      expect(testModel instanceof TestDIModelOverride).toBeTruthy('Should have been an instance of ' +
        `TestDIModelOverride but instead was an instsance of ` +
        `${(testModel.constructor || {} as any).name || testModel.name}`);
    });

    it('allows allows overriding of @Routable decorated class', () => {
      const sapi = testSapi({
        models: [TestDIModel],
        routables: [{use: TestDIRoutableOverride, for: TestDIRoutable}]
      });

      // tslint:disable-next-line:variable-name
      const TestRoutable = sapi.getRoutableByName('TestDIRoutable');
      const testRoutable = new TestRoutable();

      expect(TestRoutable).toBeDefined('Routable should have been defined');
      expect(testRoutable instanceof TestDIRoutableOverride).toBeTruthy('Should have been an instance of ' +
        `TestDIRoutableOverride but instead was an instsance of ` +
        `${(testRoutable.constructor || {} as any).name || testRoutable.name}`);
    });
  });

  describe('authentication plugins', () => {

    @AuthenticatorPlugin()
    class SomeAuthenticatorSuccess implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: 200, success: true};
      }
    }

    @AuthenticatorPlugin()
    class SomeAuthenticatorFail implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {error: 'AUTHENTICATION_FAILURE'}, status: 401, success: false};
      }
    }

    function addMockAuthPlugin(): SakuraApiPluginResult {
      return {
        authenticators: [new SomeAuthenticatorSuccess(), new SomeAuthenticatorFail()]
      };
    }

    describe('Anonymous Authenticator', () => {
      it('injects Anonymous authenticator when other Authenticators are provided ', () => {
        const sapi = testSapi({plugins: [{plugin: addMockAuthPlugin}]});

        expect(sapi.getAuthenticator(Anonymous) instanceof Anonymous).toBeTruthy();
        expect(sapi.getAuthenticator(SomeAuthenticatorSuccess) instanceof SomeAuthenticatorSuccess).toBeTruthy();
      });

      it('does not inject anonymous authentication when no other Authenticators are provided', () => {
        const sapi = testSapi({});

        expect(() => {
          sapi.getAuthenticator(Anonymous);
        }).toThrowError('Anonymous is not registered as an Authenticator with SakuraApi');

      });

      it('suppresses Anonymous authenticator when told to do so', () => {
        const sapi = testSapi({
          plugins: [{plugin: addMockAuthPlugin}],
          suppressAnonymousAuthenticatorInjection: true
        });

        expect(sapi.getAuthenticator(SomeAuthenticatorSuccess) instanceof SomeAuthenticatorSuccess).toBeTruthy();
        expect(() => {
          sapi.getAuthenticator(Anonymous);
        }).toThrowError('Anonymous is not registered as an Authenticator with SakuraApi');
      });
    });

    describe('middleware', () => {

      let sapi: SakuraApi;

      afterEach(async (done) => {
        (sapi)
          ? await sapi.close()
          : sapi = null;
        done();
      });

      it('@Routable.authenticator adds authentication to all paths when defined', async (done) => {
        @Routable({
          authenticator: [SomeAuthenticatorFail],
          baseUrl: 'someapi'
        })
        class SomeApi extends SapiRoutableMixin() {
          @Route({method: 'get', path: 'routeHandler1'})
          routeHandler1(req, res, next) {
            next();
          }

          @Route({method: 'get', path: 'routeHandler2'})
          routeHandler2(req, res, next) {
            next();
          }
        }

        sapi = testSapi({
          plugins: [{
            plugin: addMockAuthPlugin
          }],
          routables: [SomeApi]
        });
        await sapi.listen({bootMessage: ''});

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(401);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(401);

        done();
      });

      it('@Routable.authenticator adds authentication to all paths when defined and works left to right ' +
        'through those authenticators', async (done) => {
        @Routable({
          authenticator: [SomeAuthenticatorFail, Anonymous],
          baseUrl: 'someapi'
        })
        class SomeApi extends SapiRoutableMixin() {
          @Route({method: 'get', path: 'routeHandler1'})
          routeHandler1(req, res, next) {
            next();
          }

          @Route({method: 'get', path: 'routeHandler2'})
          routeHandler2(req, res, next) {
            next();
          }
        }

        sapi = testSapi({
          plugins: [{
            plugin: addMockAuthPlugin
          }],
          routables: [SomeApi]
        });
        await sapi.listen({bootMessage: ''});

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(200);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(200);

        done();
      });

      it('@Routable.authenticator & @Rout.authenticator properly stack left to right (1)', async (done) => {
        @Routable({
          authenticator: [SomeAuthenticatorFail],
          baseUrl: 'someapi'
        })
        class SomeApi extends SapiRoutableMixin() {
          @Route({
            authenticator: Anonymous,
            method: 'get',
            path: 'routeHandler1'
          })
          routeHandler1(req, res, next) {
            next();
          }

          @Route({method: 'get', path: 'routeHandler2'})
          routeHandler2(req, res, next) {
            next();
          }
        }

        sapi = testSapi({
          plugins: [{
            plugin: addMockAuthPlugin
          }],
          routables: [SomeApi]
        });
        await sapi.listen({bootMessage: ''});

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(200);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler2'))
          .expect(401);

        done();
      });

      it('@Routable.authenticator & @Rout.authenticator properly stack left to right (2)', async (done) => {
        @Routable({
          authenticator: [Anonymous],
          baseUrl: 'someapi'
        })
        class SomeApi extends SapiRoutableMixin() {
          @Route({
            authenticator: SomeAuthenticatorFail,
            method: 'get',
            path: 'routeHandler1'
          })
          routeHandler1(req, res, next) {
            next();
          }

          @Route({
            method: 'get',
            path: 'routeHandler2'
          })
          routeHandler2(req, res, next) {
            next();
          }
        }

        sapi = testSapi({
          plugins: [{
            plugin: addMockAuthPlugin
          }],
          routables: [SomeApi]
        });
        await sapi.listen({bootMessage: ''});

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(200);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler2'))
          .expect(200);

        done();
      });
    });
  });
});
// tslint:enable:no-shadowed-variable
