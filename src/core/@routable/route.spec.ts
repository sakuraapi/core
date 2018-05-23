import { NextFunction, Request, Response } from 'express';
import { ObjectID } from 'mongodb';
import * as request from 'supertest';
import { testSapi, testUrl } from '../../../spec/helpers/sakuraapi';
import { Db, Json, Model, SapiModelMixin } from '../@model';
import { Id } from '../@model/id';
import { OK } from '../lib';
import { AuthenticatorPlugin, AuthenticatorPluginResult, IAuthenticator, IAuthenticatorConstructor } from '../plugins';
import { SakuraApi } from '../sakura-api';
import { IRoutableLocals, Routable, routableSymbols, Route } from './';
import { ISakuraApiClassRoute } from './routable';
import { validHttpMethods } from './route';
import { SapiRoutableMixin } from './sapi-routable-mixin';

describe('core/Route', () => {

  describe('general functionality', () => {
    @Routable({
      baseUrl: 'testCoreRoute',
      blackList: ['someBlacklistedMethod']
    })
    class TestCoreRoute extends SapiRoutableMixin() {
      @Route({
        method: 'get',
        path: '/'
      })
      someMethod(req: Request, res: Response) {
        res
          .status(OK)
          .send({someMethodCalled: true});
      }

      @Route({
        method: 'post',
        path: 'someOtherMethod/'
      })
      someOtherMethod(req: Request, res: Response) {
        res
          .status(OK)
          .send({someOtherMethodCalled: true});
      }

      @Route({
        method: 'post',
        path: 'someBlacklistedMethod/'
      })
      someBlacklistedMethod(req: Request, res: Response) {
        res
          .status(OK)
          .send({someOtherMethodCalled: true});
      }

      @Route({
        method: 'post',
        path: 'methodStillWorks/'
      })
      methodStillWorks() {
        return 'it works';
      }

      @Route()
      emptyRouteDecorator() {
        // lint empty
      }
    }

    let routes: ISakuraApiClassRoute[];

    beforeEach(() => {
      const testRoute = new TestCoreRoute();
      routes = testRoute[routableSymbols.routes];
    });

    it('gracefully handles an empty @Route(...), defaults path to baseUri/', () => {
      // if these expectations pass, the blackList was properly defaulted to false since
      // the route wouldn't be in sakuraApiClassRoutes if blackList had been true.
      expect(routes.length).toBe(4);
      expect(routes[3].path).toBe('/testCoreRoute');
      expect(routes[3].httpMethods).toEqual(['get']);
      expect(routes[3].method).toBe('emptyRouteDecorator');
    });

    it('maintains the original functionality of the method', () => {
      const returnValue = routes[2].f(null, null, null);
      expect(returnValue).toBe('it works');
    });

  });

  describe('handles route parameters', () => {

    @Routable({
      baseUrl: 'handlesRouteParamtersTest'
    })
    class HandlesRouteParamtersTest {
      @Route({
        method: 'get',
        path: '/route/parameter/:id'
      })
      testA(req, res) {
        res
          .status(OK)
          .json({result: req.params.id.toString()});
      }

      @Route({
        method: 'get',
        path: '/route2/:id/test'
      })
      testB(req, res) {
        res
          .status(OK)
          .json({result: req.params.id.toString()});
      }
    }

    const sapi = testSapi({
      models: [],
      routables: [HandlesRouteParamtersTest]
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

    it('at the end of the path', (done) => {
      request(sapi.app)
        .get(testUrl('/handlesRouteParamtersTest/route/parameter/777'))
        .expect('Content-Type', /json/)
        .expect('Content-Length', '16')
        .expect('{"result":"777"}')
        .expect(OK)
        .then(done)
        .catch(done.fail);
    });

    it('mid path', (done) => {
      request(sapi.app)
        .get(testUrl('/handlesRouteParamtersTest/route2/888/test'))
        .expect('Content-Type', /json/)
        .expect('Content-Length', '16')
        .expect('{"result":"888"}')
        .expect(OK)
        .then(done)
        .catch(done.fail);
    });
  });

  describe('before', () => {

    @Routable({
      baseUrl: 'BeforeHandlerTests'
    })
    class BeforeHandlerTests {
      @Route({
        before: [(req, res, next) => {
          const reqLocals = res.locals as IRoutableLocals;
          reqLocals.send(OK, {
            order: '1b'
          });
          next();
        }]
      })
      testHandler(req: Request, res: Response, next: NextFunction) {
        const reqLocals = res.locals as IRoutableLocals;
        reqLocals.send(OK, {
          order: reqLocals.data.order + '2b'
        });
        next();
      }

      @Route({
        path: 'test2Handler'
      })
      test2Handler(req: Request, res: Response, next: NextFunction) {
        next();
      }
    }

    const sapi = testSapi({
      models: [],
      routables: [BeforeHandlerTests]
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

    it('runs before handler before route handler', (done) => {
      request(sapi.app)
        .get(testUrl('/BeforeHandlerTests'))
        .expect(OK)
        .then((result) => {
          expect(result.body.order).toBe('1b2b');
        })
        .then(done)
        .catch(done.fail);
    });

    it('does not run before handlers without before route handlers', (done) => {
      request(sapi.app)
        .get(testUrl(`/BeforeHandlerTests/test2Handler`))
        .expect(OK)
        .then((result) => {
          expect(result.body.order).toBeUndefined();
        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('after', () => {
    @Model({
      dbConfig: {
        collection: 'afterHandlerTestModel',
        db: 'userDb'
      }
    })
    class AfterHandlerTestModel extends SapiModelMixin() {
      @Id() @Json({type: 'id'})
      id: ObjectID;

      @Db() @Json()
      firstName = 'George';

      @Db() @Json()
      lastName = 'Washinton';
    }

    @Routable({
      baseUrl: 'AfterHandlerTests'
    })
    class AfterHandlerTests {
      @Route({
        after: (req, res, next) => {
          AfterHandlerTestModel
            .getById(res.locals.data.id)
            .then((result) => {
              res.locals.send(OK, {
                dbObj: result,
                order: 1
              }, res);
              next();
            })
            .catch(next);
        }
      })
      testHandler(req: Request, res: Response, next: NextFunction) {
        const model = new AfterHandlerTestModel();

        model
          .create()
          .then((db: any) => {
            res.locals.send(OK, {
              id: db.insertedId
            }, res);
            next();
          })
          .catch(next);
      }

      @Route({
        path: '/test2Handler'
      })
      test2Handler(req: Request, res: Response, next: NextFunction) {
        next();
      }
    }

    const sapi = testSapi({
      models: [AfterHandlerTestModel],
      routables: [AfterHandlerTests]
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

    it('runs after handler after route handler', (done) => {
      request(sapi.app)
        .get(testUrl('/AfterHandlerTests'))
        .expect(OK)
        .then((result) => {
          const body = result.body;
          expect(body.dbObj.firstName).toBe('George');
          expect(body.dbObj.lastName).toBe('Washinton');
          expect(body.dbObj._id).toBe(body.id);
          expect(body.order).toBeDefined();
        })
        .then(done)
        .catch(done.fail);
    });

    it('does not run after handler after other handlers', (done) => {
      request(sapi.app)
        .get(testUrl('/AfterHandlerTests/test2Handler'))
        .expect(OK)
        .then((result) => {
          expect(result.body.order).toBeUndefined();
        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('authenticators', () => {
    @AuthenticatorPlugin()
    class RoutableAuthenticator implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: OK, success: true};
      }
    }

    @AuthenticatorPlugin()
    class RouteAuthenticator implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: OK, success: true};
      }
    }

    it('injects route authenticators array into @Routable metadata', () => {

      @Routable()
      class TestRoutable extends SapiRoutableMixin() {

        @Route({
          authenticator: [RouteAuthenticator]
        })
        testHandler() {

        }
      }

      testSapi({
        routables: [TestRoutable]
      });

      const authenticators = Reflect.getMetadata('authenticators.testHandler', new TestRoutable());

      expect(authenticators).toBeDefined();
      expect(Array.isArray(authenticators)).toBeTruthy();
      expect(authenticators[0]).toBe(RouteAuthenticator);

    });

    it('injects route authenticator as array into @Routable metadata', () => {

      @Routable()
      class TestRoutable extends SapiRoutableMixin() {

        @Route({
          authenticator: RouteAuthenticator
        })
        testHandler() {

        }
      }

      testSapi({
        routables: [TestRoutable]
      });

      const authenticators = Reflect.getMetadata('authenticators.testHandler', new TestRoutable());

      expect(authenticators).toBeDefined();
      expect(Array.isArray(authenticators)).toBeTruthy();
      expect(authenticators[0]).toBe(RouteAuthenticator);

    });

    it('injects empty with no authenticators into @Routable metadata', () => {

      @Routable()
      class TestRoutable extends SapiRoutableMixin() {

        @Route()
        testHandler() {
        }
      }

      testSapi({
        routables: [TestRoutable]
      });

      const authenticators = Reflect.getMetadata('authenticators.testHandler', new TestRoutable());

      expect(authenticators).toBeDefined();
      expect(Array.isArray(authenticators)).toBeTruthy();
      expect(authenticators.length).toBe(0);

    });
  });

  describe('route method property', () => {

    let sapi: SakuraApi;

    afterEach(async (done) => {
      if (sapi) {
        await sapi.close();
      }

      done();
    });

    it('throws an exception when an invalid HTTP method is specified', () => {
      let err;
      try {
        @Routable()
        class X {
          @Route({method: 'imnotarealhttpmethod' as any})
          badHttpMethod() {
            // lint empty
          }
        }
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
    });

    it('excludes a method level blacklisted @Route', () => {
      @Routable()
      class Test3 {
        @Route({blackList: true})
        blackListedMethod() {
          // lint empty
        }
      }

      const t3 = new Test3();
      expect(t3[routableSymbols.routes].length).toBe(0);
    });

    it(`handles method ''`, () => {
      expect(() => {
        @Routable()
        class TestRouteMethodArray {
          @Route({method: '' as any})
          handlesPostAndGet(req: Request, res: Response) {
          }
        }
      }).toThrowError(`Route method option is an empty string. Provide a valid HTTP method`);
    });

    it('defaults HTTP method to get if no method is provided', async (done) => {
      let getCalled = false;

      try {
        @Routable({baseUrl: 'test'})
        class TestRouteMethodArray {

          @Route({
            path: '/'
          })
          handlesPostAndGet(req: Request, res: Response) {
            switch (req.method.toLowerCase()) {
              case 'get':
                getCalled = true;
                break;
              default:
                done.fail(new Error(`Unexpected method ${req.method}`));
            }

            res.status(200).send();
          }
        }

        sapi = testSapi({
          routables: [TestRouteMethodArray]
        });

        await sapi.listen({bootMessage: ''});

        await request(sapi.app)
          .get(testUrl('/test'))
          .expect(200);

        expect(getCalled).toBeTruthy();

        done();
      } catch (err) {
        done.fail(err);
      }
    });

    describe('can take method array', () => {

      it(`['get', 'post']`, async (done) => {
        let getCalled = false;
        let postCalled = false;

        @Routable({baseUrl: 'test'})
        class TestRouteMethodArray {

          @Route({
            method: ['get', 'post'],
            path: '/'
          })
          handlesPostAndGet(req: Request, res: Response) {
            switch (req.method.toLowerCase()) {
              case 'get':
                getCalled = true;
                break;
              case 'post':
                postCalled = true;
                break;
              default:
                done.fail(new Error(`Unexpected method ${req.method}`));
            }

            res.status(200).send();
          }
        }

        try {
          sapi = testSapi({
            routables: [TestRouteMethodArray]
          });

          await sapi.listen({bootMessage: ''});

          await request(sapi.app)
            .get(testUrl('/test'))
            .expect(200);

          await request(sapi.app)
            .post(testUrl('/test'))
            .expect(200);

          expect(getCalled).toBeTruthy();
          expect(postCalled).toBeTruthy();

          done();
        } catch (err) {
          done.fail(err);
        }

      });

      it(`method ['*'] binds all HTTP methods to a path for a route handler`, async (done) => {
        const called = {} as any;
        let count = 0;

        @Routable({baseUrl: 'test'})
        class TestRouteMethodArray {
          @Route({method: ['*'], path: '/'})
          handlesPostAndGet(req: Request, res: Response) {
            called[req.method.toLowerCase()] = true;
            count++;
            res.status(200).send();
          }
        }

        try {
          sapi = testSapi({
            routables: [TestRouteMethodArray]
          });

          await sapi.listen({bootMessage: ''});

          for (const method of validHttpMethods) {
            if (method === 'connect') {
              continue;
            }

            await request(sapi.app)[method](testUrl('/test')).expect(200);
          }

          for (const method of validHttpMethods) {
            if (method === 'connect') {
              continue;
            }
            expect(called[method]).toBeTruthy(`${method} failed`);
          }

          expect(count).toBe(validHttpMethods.length - 1);

          done();
        } catch (err) {
          done.fail(err);
        }
      });

      it(`handles []`, () => {

        expect(() => {
          @Routable()
          class TestRouteMethodArray {
            @Route({method: []})
            handlesPostAndGet(req: Request, res: Response) {
            }
          }
        }).toThrowError(`Route method option is an empty array. Provide at least one HTTP method`);

      });

      it(`method ['invalid']`, () => {
        expect(() => {
          @Routable()
          class TestRouteMethodArray {
            @Route({method: ['invalid' as any]})
            handlesPostAndGet(req: Request, res: Response) {
            }
          }
        }).toThrowError(`@route(...)TestRouteMethodArray.handlesPostAndGet has its 'method' property set to ` +
          `'invalid' typeof 'string', which is invalid. Valid options are: connect, delete, get, head, post, put, ` +
          `patch, trace`);
      });
    });
  });
});
