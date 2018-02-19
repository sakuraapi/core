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
import {
  Routable,
  Route,
  SapiRoutableMixin
}                        from './@routable/';
import {
  OK,
  UNAUTHORIZED
}                        from './helpers';
import {
  Anonymous,
  AuthenticatorPlugin,
  AuthenticatorPluginResult,
  IAuthenticator,
  IAuthenticatorConstructor,
  SakuraApiPluginResult
}                        from './plugins';
import {SakuraApi}       from './sakura-api';

describe('core/SakuraApi', () => {

  @Routable()
  class RoutableTest {
    response = 'testRouterGet worked';

    @Route({
      method: 'get',
      path: 'testRouterGet'
    })
    testRouterGet(req, res) {
      res.status(OK)
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
          .status(OK)
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
            .expect(OK);
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
                .status(OK)
                .json({isTest: true});
            });

          // test it
          request(sapi.app)
            .get('/middleWareTest')
            .expect('Content-Type', /json/)
            .expect('Content-Length', '15')
            .expect('{"isTest":true}')
            .expect(OK)
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
                .status(OK)
                .json({isTest: true});
            });

          request(sapi.app)
            .get('/middleWareTest')
            .expect('Content-Type', /json/)
            .expect('Content-Length', '15')
            .expect('{"isTest":true}')
            .expect(OK)
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
            .expect(OK);
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

  describe('authentication plugins', () => {

    @AuthenticatorPlugin()
    class SomeAuthenticatorSuccess implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: OK, success: true};
      }
    }

    @AuthenticatorPlugin()
    class SomeAuthenticatorFail implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {error: 'AUTHENTICATION_FAILURE'}, status: UNAUTHORIZED, success: false};
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
          .expect(UNAUTHORIZED);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(UNAUTHORIZED);

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
          .expect(OK);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler1'))
          .expect(OK);

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
          .expect(OK);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler2'))
          .expect(UNAUTHORIZED);

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
          .expect(OK);

        await request(sapi.app)
          .get(testUrl('/someapi/routeHandler2'))
          .expect(OK);

        done();
      });

      it('should not call next on failure (#120)', async (done) => {
        let fallthrough = false;

        @Routable({
          authenticator: SomeAuthenticatorFail,
          baseUrl: 'someapi'
        })
        class SomeApi extends SapiRoutableMixin() {
          @Route({
            method: 'get',
            path: 'routeHandler1'
          })
          routeHandler1(req, res, next) {
            fallthrough = true;
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

        expect(fallthrough).toBeFalsy('Sakura improperly called next on an auth failture');

        done();
      });
    });
  });
});
// tslint:enable:no-shadowed-variable
