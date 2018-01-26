import {
  NextFunction,
  Request,
  Response
}                   from 'express';
import * as request from 'supertest';
import {
  testSapi,
  testUrl
}                   from '../../spec/helpers/sakuraapi';
import {
  Json,
  Model,
  SapiModelMixin
}                   from './@model';
import {
  Routable,
  Route
}                   from './@routable';
import {OK} from './helpers/http-status';
import {
  AuthenticatorPlugin,
  AuthenticatorPluginResult,
  authenticatorPluginSymbols,
  IAuthenticator,
  IAuthenticatorConstructor,
  SakuraApiPluginResult
}                   from './plugins';
import {SakuraApi}  from './sakura-api';

// tslint:disable:no-shadowed-variable

describe('@AuthenticatorPlugin', () => {

  it('injects an id', () => {
    @AuthenticatorPlugin()
    class TestPlugin {

    }

    expect(TestPlugin[authenticatorPluginSymbols.id]).toBeDefined();
  });

  it('injects isAuthenticator', () => {
    @AuthenticatorPlugin()
    class TestPlugin {
    }

    expect(TestPlugin[authenticatorPluginSymbols.isAuthenticator]).toBeTruthy();
  });

  describe('SakuraApi', () => {

    describe('models and routables', () => {
      function testPluginA(sapi: SakuraApi, options: any): SakuraApiPluginResult {

        function testHandler(req: Request, res: Response, next: NextFunction) {
          if (!res.locals.handlerTrace) {
            res.locals.handlerTrace = '';
          }
          res.locals.handlerTrace += res.locals.handlerTrace = options.value;
          next();
        }

        @Model()
        class TestModelPlugin extends SapiModelMixin() {
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
              .status(OK)
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
            .status(OK)
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
          .expect(OK)
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
          .expect(OK)
          .then((result) => {
            const body = result.body;
            expect(body.modelValue).toBe('found');
          })
          .then(done)
          .catch(done.fail);
      });

    });

    describe('Authenticators', () => {

      @AuthenticatorPlugin()
      class TestAuthenticatorAuthenticates implements IAuthenticator, IAuthenticatorConstructor {

        constructor() {
        }

        async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
          return {
            data: {},
            status: OK,
            success: true
          };
        }
      }

      function testPluginA(sapi: SakuraApi, options: any): SakuraApiPluginResult {
        return {
          authenticators: [new TestAuthenticatorAuthenticates()]
        };
      }

      let sapi: SakuraApi;
      afterEach(async (done) => {
        await sapi.close();
        done();
      });

      it('registers AuthenticatorPlugins', async (done) => {
        sapi = testSapi({
          plugins: [
            {
              options: {},
              plugin: testPluginA
            }
          ]
        });

        try {
          await sapi.listen({bootMessage: ''});

          const result = sapi.getAuthenticator(TestAuthenticatorAuthenticates);

          expect(result.constructor[authenticatorPluginSymbols.id])
            .toBe(TestAuthenticatorAuthenticates[authenticatorPluginSymbols.id]);

          done();
        } catch (err) {
          done.fail(err);
        }

      });
    });
  });
});
// tslint:enable:no-shadowed-variable
