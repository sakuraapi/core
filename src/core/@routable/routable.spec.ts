import { NextFunction, Request, Response } from 'express';
import { ObjectID } from 'mongodb';
import * as request from 'supertest';
import { testSapi, testUrl } from '../../../spec/helpers/sakuraapi';
import { getAllRouteHandler, getRouteHandler } from '../../handlers';
import { Db, Json, Model, SapiModelMixin } from '../@model';
import { Id } from '../@model/id';
import { BAD_REQUEST, DUPLICATE_RESOURCE, NOT_FOUND, OK } from '../lib';
import { AuthenticatorPlugin, AuthenticatorPluginResult, IAuthenticator, IAuthenticatorConstructor } from '../plugins';
import { SakuraApi } from '../sakura-api';
import { Routable, routableSymbols, Route } from './';
import {
  IRoutableLocals,
  ISakuraApiClassRoute,
  RoutableNotRegistered,
  RoutablesMustBeDecoratedWithRoutableError
} from './routable';
import { SapiRoutableMixin } from './sapi-routable-mixin';

describe('core/@Routable', () => {
  describe('general functionality', () => {
    const sapi = testSapi({
      models: [],
      routables: []
    });

    describe('IRoutableOptions', () => {

      it('add a baseUrl to the path of an @Route, if provided', () => {
        @Routable({
          baseUrl: 'coreRoutableAddBaseUrlTest'
        })
        class CoreRoutableAddBaseUrlTest {
          @Route()
          aRouteMethod() {
            // lint empty
          }
        }

        const router = new CoreRoutableAddBaseUrlTest();
        const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');
        expect(routes.length).toBe(1, 'There should have been one route defined');
        expect(routes[0].path).toBe('/coreRoutableAddBaseUrlTest', 'baseUrl was not properly set by @Routable');
      });

      it('ignore @Route methods that are listed in the @Routable(blacklist)', () => {
        @Routable({
          blackList: ['bRouteMethod']
        })
        class CoreRoutableIgnoreRoutableBlacklisted {
          @Route()
          aRouteMethod() {
            // lint empty
          }

          @Route()
          bRouteMethod() {
            // lint empty
          }
        }

        const router = new CoreRoutableIgnoreRoutableBlacklisted();
        const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');

        let found = false;
        for (const route of routes) {
          found = route.method === 'bRouteMethod';
        }

        expect(found).toBeFalsy('black listed path should not have been included in the routes');
      });

      it('handle the lack of a baseUrl gracefully', () => {
        @Routable()
        class CoreRoutableNoBaseMethodWorks {
          @Route({
            path: '/'
          })
          aRouteMethod() {
            // lint empty
          }

          @Route({
            path: 'bRouteMethod'
          })
          bRouteMethod() {
            // lint empty
          }
        }

        const router = new CoreRoutableNoBaseMethodWorks();
        const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');
        expect(routes.length).toBe(2, 'There should have been one route defined');
        expect(routes[0].path).toBe('/', 'baseUrl was not properly set by @Routable');
        expect(routes[1].path).toBe('/bRouteMethod', 'baseUrl was not properly set by @Routable');
      });

      it('suppress autoRouting if options.autoRoute = false', (done) => {
        @Routable()
        class CoreRoutableSuppressRoutesWithAutoRouteFalse {
          @Route({
            path: 'autoRoutingFalseTest'
          })
          aRouteMethod(req, res) {
            res.status(OK);
          }
        }

        sapi
          .listen({bootMessage: ''})
          .then(() => {
            return request(sapi.app)
              .get('/autoRoutingFalseTest')
              .expect(NOT_FOUND);
          })
          .then(() => sapi.close())
          .then(done)
          .catch(done.fail);
      });
    });

    it('drops the traling / on a path', () => {
      @Routable({
        baseUrl: 'CoreRoutableTrailingSlashDropTest'

      })
      class CoreRoutableTrailingSlashDropTest {
        @Route({
          path: '/dropThatTrailingSlash/'
        })
        aRouteMethod() {
          // lint empty
        }
      }

      const router = new CoreRoutableTrailingSlashDropTest();
      const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];
      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(1, 'There should have been one route defined');
      expect(routes[0].path)
        .toBe('/CoreRoutableTrailingSlashDropTest/dropThatTrailingSlash', 'trailing slash was not added');
    });

    it('adds the leading / on a path if its missing', () => {
      @Routable({
        baseUrl: 'CoreRoutableTrailingSlashAddTest'
      })
      class CoreRoutableTrailingSlashAddTest {
        @Route({
          path: 'addThatTrailingSlash/'
        })
        aRouteMethod() {
          // lint empty
        }
      }

      const router = new CoreRoutableTrailingSlashAddTest();
      const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];
      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(1, 'There should have been one route defined');
      expect(routes[0].path)
        .toBe('/CoreRoutableTrailingSlashAddTest/addThatTrailingSlash', 'trailing slash was not added');
    });

    it('reads metadata from @Route and properly injects sakuraApiClassRoutes[] into the @Routable class', () => {
      @Routable({
        baseUrl: 'CoreRoutableRoutesWork'
      })
      class CoreRoutableRoutesWork {
        @Route({
          method: 'get',
          path: 'a'
        })
        aRouteMethod() {
          // lint empty
        }

        @Route({
          method: 'put',
          path: 'b'
        })
        bRouteMethod() {
          // lint empty
        }
      }

      const router = new CoreRoutableRoutesWork();
      const routes: ISakuraApiClassRoute[] = router[routableSymbols.routes];

      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(2, 'There should have been one route defined');
      expect(routes[0].path).toBe('/CoreRoutableRoutesWork/a');
      expect(routes[1].path).toBe('/CoreRoutableRoutesWork/b');
      expect(routes[0].method).toBe('aRouteMethod');
      expect(routes[1].method).toBe('bRouteMethod');
      expect(routes[0].httpMethods).toEqual(['get']);
      expect(routes[1].httpMethods).toEqual(['put']);
      expect(routes[0].name).toBe('CoreRoutableRoutesWork');
      expect(routes[1].name).toBe('CoreRoutableRoutesWork');
      expect(typeof routes[0].f).toBe('function');
      expect(typeof routes[1].f).toBe('function');
    });

    it('maintains the prototype chain', () => {
      @Routable()
      class CoreRoutableInstanceOfWorks {

        @Route({
          method: 'get',
          path: 'a'
        })
        aRouteMethod(req, res) {
          // lint empty
        }
      }

      expect(new CoreRoutableInstanceOfWorks() instanceof CoreRoutableInstanceOfWorks)
        .toBeTruthy('the prototype chain should have been maintained');
    });

    it('binds the instantiated class as the context of this for each route method', () => {
      @Routable()
      class CoreRoutableContextOfRouteMethod {
        someProperty = 'instance';

        @Route()
        someMethodTest4() {
          return this.someProperty;
        }
      }

      const obj = new CoreRoutableContextOfRouteMethod();

      expect(obj.someMethodTest4()).toBe(obj.someProperty);
      expect(obj[routableSymbols.routes][0].f()).toBe(obj.someProperty);
    });

    it('automatically instantiates its class and adds it to SakuraApi.route(...)', (done) => {

      @Routable()
      class CoreRouteAutoRouteTest {
        @Route({
          path: 'someMethodTest5'
        })
        someMethodTest5(req, res) {
          res
            .status(OK)
            .json({someMethodTest5: 'testRouterGet worked'});
        }

        @Route({
          path: 'route/parameter/:test'
        })
        routeParameterTest(req: Request, res: Response) {
          const test = req.params.test;

          res
            .status(OK)
            .json({result: test});
        }

        @Route({
          path: 'route2/:parameter/test'
        })
        routeParameterTest2(req: Request, res: Response) {
          const test = req.params.parameter;

          res
            .status(OK)
            .json({result: test});
        }
      }

      const sapi2 = testSapi({
        models: [],
        routables: [CoreRouteAutoRouteTest]
      });

      sapi2
        .listen({bootMessage: ''})
        .then(() => {
          return request(sapi2.app)
            .get(testUrl('/someMethodTest5'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '42')
            .expect('{"someMethodTest5":"testRouterGet worked"}')
            .expect(OK);
        })
        .then(() => sapi2.close())
        .then(done)
        .catch(done.fail);
    });
  });

  describe('before and after handlers', () => {
    describe('beforeAll handlers', () => {

      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb'
        }
      })
      class UserBeforeAllHandlers extends SapiModelMixin() {
        @Id() @Json({type: 'id'})
        id: ObjectID;

        @Db() @Json()
        firstName = 'George';
        @Db() @Json()
        lastName = 'Washington';
        @Db() @Json()
        handlerWasRightInstanceOf = false;
        @Db() @Json()
        order = '';
      }

      @Routable({
        beforeAll: [UserBeforeAllHandlersApi.beforeHandler, testHandler],
        model: UserBeforeAllHandlers
      })
      class UserBeforeAllHandlersApi {
        static beforeHandler(req: Request, res: Response, next: NextFunction): any {
          req.body.firstName = 'Abe';
          req.body.handlerWasRightInstanceOf = this instanceof UserBeforeAllHandlersApi;
          req.body.order += '1';
          next();
        }
      }

      const sapi = testSapi({
        models: [UserBeforeAllHandlers],
        routables: [UserBeforeAllHandlersApi]
      });

      beforeAll(async () => {
        await sapi.listen({bootMessage: ''});
        await UserBeforeAllHandlers.removeAll({});
      });

      afterAll((done) => {
        sapi
          .close()
          .then(done)
          .catch(done.fail);
      });

      it('run before each @Route method', (done) => {
        request(sapi.app)
          .post(testUrl('/userbeforeallhandlers'))
          .type('application/json')
          .send({
            firstName: 'Ben',
            lastName: 'Franklin'
          })
          .expect(OK)
          .then((res) => {
            return UserBeforeAllHandlers
              .getCollection()
              .find({_id: new ObjectID(res.body.id)})
              .next();
          })
          .then((res: any) => {
            expect(res.firstName).toBe('Abe');
            expect(res.lastName).toBe('Lincoln');
            expect(res.handlerWasRightInstanceOf).toBeTruthy('UserBeforeAllHandlersApi.beforeHandler should have set' +
              'this value to true if the handler was bound to the proper context (the handler\'s @Routable class)');
          })
          .then(done)
          .catch(done.fail);
      });

      it('run in the correct order', (done) => {
        request(sapi.app)
          .post(testUrl('/userbeforeallhandlers'))
          .type('application/json')
          .send({
            firstName: 'Ben',
            lastName: 'Franklin',
            order: '0'
          })
          .expect(OK)
          .then((res) => {
            return UserBeforeAllHandlers
              .getCollection()
              .find({_id: new ObjectID(res.body.id)})
              .next();
          })
          .then((res: any) => {
            expect(res.order).toBe('012', 'The beforeAll handlers have run out of order');
          })
          .then(done)
          .catch(done.fail);
      });

      function testHandler(req: Request, res: Response, next: NextFunction) {
        req.body.lastName = 'Lincoln';
        req.body.order += '2';
        next();
      }
    });

    describe('afterAll handlers', () => {
      let test = 0;

      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb'
        }
      })
      class UserAfterAllHandlers extends SapiModelMixin() {
        @Id() @Json({type: 'id'})
        id: ObjectID;

        @Db() @Json()
        firstName = 'George';
        @Db() @Json()
        lastName = 'Washington';
        @Db() @Json()
        handlerWasRightInstanceOf = false;
        @Db() @Json()
        order = '1';
      }

      @Routable({
        afterAll: [UserAfterAllHandlersApi.afterHandler, testAfterHandler],
        model: UserAfterAllHandlers
      })
      class UserAfterAllHandlersApi {
        static afterHandler(req: Request, res: Response, next: NextFunction): any {
          const resLocal = res.locals as IRoutableLocals;
          UserAfterAllHandlers
            .getById(resLocal.data.id)
            .then((result) => {
              resLocal.data.order = '1';
              resLocal.data.user = UserAfterAllHandlers.fromDb(result).toJson();
              next();
            })
            .catch(next);
        }
      }

      const sapi = testSapi({
        models: [UserAfterAllHandlers],
        routables: [UserAfterAllHandlersApi]
      });

      function testAfterHandler(req: Request, res: Response, next: NextFunction) {
        const resLocal = res.locals as IRoutableLocals;
        resLocal.data.order += '2';
        next();
      }

      beforeEach((done) => {
        sapi
          .listen({bootMessage: ''})
          .then(() => UserAfterAllHandlers.removeAll({}))
          .then(done)
          .catch(done.fail);
      });

      afterEach((done) => {
        sapi
          .close()
          .then(done)
          .catch(done.fail);
      });

      it('run after each @Route method', (done) => {
        request(sapi.app)
          .post(testUrl(`/UserAfterAllHandlers?test=${++test}`))
          .type('application/json')
          .send({
            firstName: 'Ben',
            lastName: 'Franklin'
          })
          .expect(OK)
          .then((response) => {
            const body = response.body;
            expect(body.count).toBe(1);
            expect(body.user).toBeDefined();
            expect(body.user.firstName).toBe('Ben');
            expect(body.user.lastName).toBe('Franklin');
            expect(body.user.id).toBe(body.id);
            expect(body.count).toBe(1);
          })
          .then(done)
          .catch(done.fail);
      });
    });

    describe('beforeAll and afterAll handlers play nice together', () => {
      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb'
        }
      })
      class UserAfterAllHandlersBeforeAllHandlers extends SapiModelMixin() {

        @Id() @Json({type: 'id'})
        id: ObjectID;

        @Db() @Json()
        firstName = 'George';
        @Db() @Json()
        lastName = 'Washington';
        @Db() @Json()
        handlerWasRightInstanceOf = false;
        @Db() @Json()
        order = '1';
      }

      @Routable({
        afterAll: [UserAfterAllHandlersBeforeAllHandlersApi.afterHandler, testAfterHandler],
        beforeAll: [UserAfterAllHandlersBeforeAllHandlersApi.beforeHandler, testBeforeHandler],
        model: UserAfterAllHandlersBeforeAllHandlers
      })
      class UserAfterAllHandlersBeforeAllHandlersApi {
        static beforeHandler(req: Request, res: Response, next: NextFunction): any {
          const resLocal = res.locals as IRoutableLocals;
          resLocal.data.order = '1b';
          next();
        }

        static afterHandler(req: Request, res: Response, next: NextFunction): any {
          const resLocal = res.locals as IRoutableLocals;
          resLocal.data.order += '1a';
          next();
        }
      }

      function testBeforeHandler(req: Request, res: Response, next: NextFunction) {
        const resLocal = res.locals as IRoutableLocals;
        resLocal.data.order += '2b';
        next();
      }

      function testAfterHandler(req: Request, res: Response, next: NextFunction) {
        const resLocal = res.locals as IRoutableLocals;
        resLocal.data.order += '2a';
        next();
      }

      const sapi = testSapi({
        models: [UserAfterAllHandlersBeforeAllHandlers],
        routables: [UserAfterAllHandlersBeforeAllHandlersApi]
      });

      beforeEach((done) => {
        sapi
          .listen({bootMessage: ''})
          .then(() => UserAfterAllHandlersBeforeAllHandlers.removeAll({}))
          .then(done)
          .catch(done.fail);
      });

      afterEach((done) => {
        sapi
          .close()
          .then(done)
          .catch(done.fail);
      });

      it('run after each @Route method', (done) => {

        request(sapi.app)
          .post(testUrl('/UserAfterAllHandlersBeforeAllHandlers'))
          .type('application/json')
          .send({
            firstName: 'Ben',
            lastName: 'Franklin'
          })
          .expect(OK)
          .then((response) => {
            expect(response.body.order).toBe('1b2b1a2a');
            expect(response.body.count).toBe(1);
          })
          .then(done)
          .catch(done.fail);
      });
    });

    describe('before and after handlers can utilize injected route handlers', () => {

      describe('getAllHandler', () => {
        @Model({
          dbConfig: {
            collection: 'BeforeAfterInjectRouteTestModel',
            db: 'userDb'
          }
        })
        class BeforeAfterInjectRouteTestModel extends SapiModelMixin() {
          @Id() @Json({type: 'id'})
          id: ObjectID;

          @Db() @Json()
          firstName = 'George';

          @Db() @Json()
          lastName = 'Washington';
        }

        @Routable({
          baseUrl: 'GetAllRouteHandlerBeforeAfterTest',
          model: BeforeAfterInjectRouteTestModel
        })
        class GetAllRouteHandlerBeforeAfterTest extends SapiRoutableMixin() {
          static getAfterTest(req: Request, res: Response, next: NextFunction) {

            const resLocal = res.locals as IRoutableLocals;
            if (Array.isArray(resLocal.data) && resLocal.data.length > 0) {
              expect(resLocal.data[0].firstName).toBe('Georgie');
              resLocal.data[0].firstName = 'Georgellio';
            }

            next();
          }

          @Route({
            after: GetAllRouteHandlerBeforeAfterTest.getAfterTest,
            before: [getAllRouteHandler],
            method: 'get',
            path: 'beforeTest/get'
          })
          getBeforeTest(req: Request, res: Response, next: NextFunction) {

            const resLocal = res.locals as IRoutableLocals;
            if (Array.isArray(resLocal.data) && resLocal.data.length > 0) {
              expect(resLocal.data[0].firstName).toBe('George');
              resLocal.data[0].firstName = 'Georgie';
            }

            next();
          }
        }

        let sapi: SakuraApi;

        beforeEach(async () => {

          sapi = testSapi({
            models: [BeforeAfterInjectRouteTestModel],
            routables: [GetAllRouteHandlerBeforeAfterTest]
          });

          await sapi.listen({bootMessage: ''});
          await BeforeAfterInjectRouteTestModel.removeAll({});

        });

        afterEach(async () => {
          await BeforeAfterInjectRouteTestModel.removeAll({});
          await sapi.close();
        });

        it('with result', async (done) => {

          try {
            await new BeforeAfterInjectRouteTestModel().create();

            const res = await request(sapi.app)
              .get(testUrl('/GetAllRouteHandlerBeforeAfterTest/beforeTest/get'))
              .expect(OK);

            const body = res.body;
            expect(body.length).toBe(1);
            expect(body[0].firstName).toBe('Georgellio');
            expect(body[0].lastName).toBe('Washington');
            expect(body[0].id).toBeDefined();

            done();
          } catch (err) {
            done.fail(err);
          }

        });

        it('without results', async (done) => {

          try {
            BeforeAfterInjectRouteTestModel.removeAll({});
            const res = await request(sapi.app)
              .get(testUrl('/GetAllRouteHandlerBeforeAfterTest/beforeTest/get'))
              .expect(OK);

            const body = res.body;
            expect(Array.isArray(body)).toBeTruthy();
            expect(body.length).toBe(0);
            done();
          } catch (err) {
            done.fail(err);
          }

        });
      });

      describe('get handler', () => {
        let sapi: SakuraApi;

        @Model({
          dbConfig: {
            collection: 'BeforeAfterInjectRouteTestModel',
            db: 'userDb'
          }
        })
        class BeforeAfterInjectRouteTestModel extends SapiModelMixin() {
          @Id() @Json({type: 'id'})
          id: ObjectID;

          @Db() @Json()
          firstName = 'George';

          @Db() @Json()
          lastName = 'Washington';
        }

        @Routable({
          baseUrl: 'GetRouteHandlerBeforeAfterTest',
          model: BeforeAfterInjectRouteTestModel
        })
        class GetRouteHandlerBeforeAfterTest extends SapiRoutableMixin() {
          static getAfterTest(req: Request, res: Response, next: NextFunction) {
            const resLocal = res.locals as IRoutableLocals;

            if (resLocal.data !== null) {
              expect(resLocal.data.firstName).toBe('Georgie');
              resLocal.data.firstName = 'Georgellio';
            } else {
              resLocal.data = 'ok';
            }

            next();
          }

          @Route({
            after: GetRouteHandlerBeforeAfterTest.getAfterTest,
            before: [getRouteHandler],
            method: 'get',
            path: 'beforeTest/get/:id'
          })
          getBeforeTest(req: Request, res: Response, next: NextFunction) {
            const resLocal = res.locals as IRoutableLocals;
            expect(resLocal.data.firstName).toBe('George');
            resLocal.data.firstName = 'Georgie';
            next();
          }

          @Route({
            after: GetRouteHandlerBeforeAfterTest.getAfterTest,
            before: [getRouteHandler],
            method: 'get',
            path: 'beforeTest/get2/:id'
          })
          get2BeforeTest(req: Request, res: Response, next: NextFunction) {
            const resLocal = res.locals as IRoutableLocals;
            expect(resLocal.data).toBe(null);
            next();
          }
        }

        beforeEach(() => {
          sapi = testSapi({
            models: [BeforeAfterInjectRouteTestModel],
            routables: [GetRouteHandlerBeforeAfterTest]
          });
        });

        afterEach(async () => {
          await sapi.close();
        });

        it('with valid id', async () => {
          await sapi.listen({bootMessage: ''});

          const db = await new BeforeAfterInjectRouteTestModel().create();

          const res = await request(sapi.app)
            .get(testUrl(`/GetRouteHandlerBeforeAfterTest/beforeTest/get/${db.insertedId}`))
            .expect(OK);

          const body = res.body;
          expect(body.firstName).toBe('Georgellio');
          expect(body.lastName).toBe('Washington');
          expect(body.id).toBeDefined();
        });

        it('with invalid id', async () => {
          await sapi.listen({bootMessage: ''});

          const res = await request(sapi.app)
            .get(testUrl(`/GetRouteHandlerBeforeAfterTest/beforeTest/get2/123`))
            .expect(OK);

          const body = res.body;
          expect(body).toBe('ok');
        });
      });
    });
  });

  describe('takes an @Model class in IRoutableOptions', () => {
    let sapi: SakuraApi;

    class Contact {
      @Db()
      @Json()
      phone = '000-000-0000';

      @Db()
      @Json()
      mobile = '111-111-1111';
    }

    @Model({
      dbConfig: {
        collection: 'usersRoutableTests',
        db: 'userDb'
      }
    })
    class User extends SapiModelMixin() {
      @Id() @Json({type: 'id'})
      id: ObjectID;

      @Db('fname') @Json('fn')
      firstName: string = 'George';
      @Db('lname') @Json('ln')
      lastName: string = 'Washington';

      @Db({model: Contact})
      @Json()
      contact = new Contact();

      @Db('email')
      email: string;
    }

    @Model({
      dbConfig: {
        collection: 'noDocsCreatedTests',
        db: 'userDb'
      }
    })
    class NoDocsCreated extends SapiModelMixin() {
      @Id() @Json({type: 'id'})
      id: ObjectID;
    }

    @Routable({
      model: User
    })
    class UserApi1 {
      @Route({
        method: 'post',
        path: 'test-path'
      })
      testRoute(req, res) {
        // lint empty
      }
    }

    @Routable({
      baseUrl: 'testUserApi2',
      model: NoDocsCreated
    })
    class UserApi2 {
      @Route({
        method: 'post',
        path: 'test-path'
      })
      testRoute(req, res) {
        // lint empty
      }
    }

    beforeEach(async () => {
      sapi = testSapi({
        models: [
          NoDocsCreated,
          User
        ],
        routables: [
          UserApi1,
          UserApi2
        ]
      });

      await sapi.listen({bootMessage: ''});
      await User.removeAll({});
    });

    afterEach(async () => {
      await sapi.close();
    });

    describe('throws', () => {
      it('if the provided model is not decorated with @Model', () => {
        expect(() => {
          class NotAModel {
            // lint empty
          }

          @Routable({
            model: NotAModel
          })
          class BrokenRoutable {
            // lint empty
          }
        }).toThrow(new Error(`BrokenRoutable is not decorated by @Model and therefore cannot be used as a model for`
          + ` @Routable`));
      });

      it('if provided either suppressApi or exposeApi options without a model', () => {
        expect(() => {
          @Routable({
            suppressApi: ['get']
          })
          class FailRoutableSuppressApiOptionTest {
          }
        })
          .toThrow(new Error(`If @Routable 'FailRoutableSuppressApiOptionTest' defines a 'suppressApi' or 'exposeApi'`
            + ` option, then a model option with a valid @Model must also be provided`));

        expect(() => {
          @Routable({
            exposeApi: ['get']
          })
          class FailRoutableSuppressApiOptionTest {
          }
        }).toThrow(new Error(`If @Routable 'FailRoutableSuppressApiOptionTest' defines a 'suppressApi' or 'exposeApi'`
          + ` option, then a model option with a valid @Model must also be provided`));
      });
    });

    describe('generates routes with built in handlers when provided a model', () => {
      describe('properly names routes', () => {
        it('uses the model\'s name if there is no baseUrl for the @Routable class', async () => {
          await request(sapi.app)
            .get(testUrl('/user'))
            .expect(OK);
        });
      });

      it('uses the baseUrl for the @Routable class if one is set', (done) => {
        request(sapi.app)
          .get(testUrl('/testUserApi2'))
          .expect(OK)
          .then(done)
          .catch(done.fail);
      });

      it('does not allow both suppressApi and exposeApi to be set at the same time', () => {
        expect(() => {
          @Routable({
            exposeApi: ['delete'],
            model: User,
            suppressApi: true
          })
          class RoutableExposeApiTest {
          }
        }).toThrowError(`@Routable \'RoutableExposeApiTest\' cannot have both \'suppressApi\' ` +
          `and \'exposeApi\' set at the same time`);
      });

      describe('GET ./model', () => {

        beforeEach(async () => {
          await User.removeAll({});

          const user1 = new User();
          user1.contact.phone = '111-111-1111';
          this.user1 = user1;
          await user1.create();

          const user2 = new User();
          user2.firstName = 'Martha';
          this.user2 = user2;
          await user2.create();

          const user3 = new User();
          user3.firstName = 'Matthew';
          this.user3 = user3;
          await user3.create();

          const user4 = new User();
          user4.firstName = 'Mark';
          this.user4 = user4;
          await user4.create();

          const user5 = new User();
          user5.firstName = 'Luke';
          this.user5 = user5;
          await user5.create();
        });

        it('returns all documents with all fields properly mapped by @Json', (done) => {

          request(sapi.app)
            .get(testUrl('/user'))
            .expect('Content-Type', /json/)
            .expect(OK)
            .then((res) => {
              expect(Array.isArray(res.body)).toBeTruthy();
              expect(res.body.length).toBe(5);
              expect(res.body[0].fn).toBe(this.user1.firstName);
              expect(res.body[0].ln).toBe(this.user1.lastName);
              expect(res.body[1].fn).toBe(this.user2.firstName);
              expect(res.body[1].ln).toBe(this.user2.lastName);
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns empty array with no results', (done) => {
          request(sapi.app)
            .get(testUrl('/testUserApi2'))
            .expect('Content-Type', /json/)
            .expect(OK)
            .then((res) => {
              expect(Array.isArray(res.body)).toBeTruthy();
              expect(res.body.length).toBe(0);
            })
            .then(done)
            .catch(done.fail);
        });

        describe('supports a where query', () => {

          it('returns 400 with invalid json for where parameter', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?where={firstName:test}`))
              .expect(BAD_REQUEST)
              .then((res) => {
                expect(res.body).toBeDefined('There should have been a body returned with the error');
                expect(res.body.error).toBe('invalid_where_parameter');
                expect(res.body.details).toBe('Unexpected token f in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 200 with empty array when there is a valid where query with no matching entities', (done) => {
            const json = {
              fn: 'Zorg, Commander of the Raylon Empire'
            };

            request(sapi.app)
              .get(testUrl(`/user?where=${JSON.stringify(json)}`))
              .expect(OK)
              .expect('Content-Type', /json/)
              .then((res) => {
                expect(res.body).toBeDefined();
                expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                expect(res.body.length).toBe(0);
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns the expected objects', (done) => {
            const json = {
              fn: 'George'
            };

            request(sapi.app)
              .get(testUrl(`/user?where=${JSON.stringify(json)}`))
              .expect(OK)
              .expect('Content-Type', /json/)
              .then((res) => {

                expect(res.body).toBeDefined();
                expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                expect(res.body.length).toBe(1, 'The where query parameter should have limited the results to one ' +
                  'matching object');

                expect(res.body[0].fn).toBe(this.user1.firstName);
                expect(res.body[0].ln).toBe(this.user1.lastName);

                expect(res.body[0].id.toString()).toBe(this.user1._id.toString());
                expect(res.body[0].contact).toBeDefined('contact should have been defined');
                expect(res.body[0].contact.phone).toBe('111-111-1111');

              })
              .then(done)
              .catch(done.fail);
          });

          describe('supports deep where', () => {
            const json = {
              contact: {
                phone: '123'
              },
              fn: 'George'
            };

            it('with no results expected', (done) => {
              request(sapi.app)
                .get(testUrl(`/user?where=${JSON.stringify(json)}`))
                .expect(OK)
                .expect('Content-Type', /json/)
                .then((res) => {
                  expect(res.body).toBeDefined();
                  expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                  expect(res.body.length).toBe(0, 'no results should have matched the where query');
                })
                .then(done)
                .catch(done.fail);
            });

            it('with one result expected', (done) => {
              json.contact.phone = '111-111-1111';

              request(sapi.app)
                .get(testUrl(`/user?where=${JSON.stringify(json)}`))
                .expect(OK)
                .expect('Content-Type', /json/)
                .then((res) => {
                  expect(res.body).toBeDefined();
                  expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                  expect(res.body.length).toBe(1, 'The where query parameter should have limited the results to one ' +
                    'matching object');
                  expect(res.body[0].fn).toBe(this.user1.firstName);
                  expect(res.body[0].ln).toBe(this.user1.lastName);
                  expect(res.body[0].id.toString()).toBe(this.user1._id.toString());
                  expect(res.body[0].contact).toBeDefined('contact should have been defined');
                  expect(res.body[0].contact.phone).toBe('111-111-1111');
                })
                .then(done)
                .catch(done.fail);
            });
          });

          it('does not allow for NoSQL injection', (done) => {
            pending('not implemented: https://github.com/sakuraapi/api/issues/65');
          });

        });

        describe('supports fields projection', () => {

          it('returns 400 with invalid json for fields parameter', (done) => {
            request(sapi.app)
              .get(testUrl('/user?fields={blah}'))
              .expect(BAD_REQUEST)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected token b in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid json for fields=', (done) => {
            request(sapi.app)
              .get(testUrl('/user?fields='))
              .expect(BAD_REQUEST)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected end of JSON input');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with excluded fields', (done) => {
            const fields = {
              ln: 0
            };

            request(sapi.app)
              .get(testUrl(`/user?fields=${JSON.stringify(fields)}`))
              .expect(OK)
              .then((res) => {
                expect(res.body.length).toBe(5);
                expect(res.body[0].ln).toBeUndefined('lastName should have been excluded');
                expect(res.body[0].contact).toBeDefined('contact should not have been excluded');
                expect(res.body[0].contact.phone).toBe(this.user1.contact.phone);
                expect(res.body[0].contact.mobile).toBe(this.user1.contact.mobile);

                expect(res.body[1].ln).toBeUndefined();
                expect(res.body[1].contact).toBeDefined('contact should not have been excluded');
                expect(res.body[1].contact.phone).toBe(this.user2.contact.phone);
                expect(res.body[1].contact.mobile).toBe(this.user2.contact.mobile);
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with embedded document excluded fields', (done) => {
            const fields = {
              contact: {mobile: 0}
            };

            request(sapi.app)
              .get(testUrl(`/user?fields=${JSON.stringify(fields)}`))
              .expect(OK)
              .then((res) => {
                expect(res.body.length).toBe(5);
                expect(res.body[0].fn).toBe(this.user1.firstName);
                expect(res.body[0].ln).toBe(this.user1.lastName);
                expect(res.body[0].contact).toBeDefined('contact should not have been excluded');
                expect(res.body[0].contact.phone).toBe(this.user1.contact.phone);
                expect(res.body[0].contact.mobile).toBeUndefined('mobile should not have been included');
                expect(res.body[1].fn).toBe(this.user2.firstName);
                expect(res.body[1].ln).toBe(this.user2.lastName);
                expect(res.body[1].contact).toBeDefined('contact should not have been excluded');
                expect(res.body[1].contact.phone).toBe(this.user2.contact.phone);
                expect(res.body[1].contact.mobile).toBeUndefined('mobile should not have been included');
              })
              .then(done)
              .catch(done.fail);
          });
        });

        describe('supports skip', () => {
          it('with valid values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?skip=4`))
              .expect(OK)
              .then((res) => {
                expect(res.body.length).toBe(1, 'should have skipped to last entry');
                expect(res.body[0].id).toBe(this.user5.id.toString());
                expect(res.body[0].fn).toBe(this.user5.firstName);
              })
              .then(done)
              .catch(done.fail);
          });

          it('with valid values greater than records available', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?skip=100`))
              .expect(OK)
              .then((res) => {
                expect(Array.isArray(res.body)).toBeTruthy('Expected an empty array');
                expect(res.body.length).toBe(0, 'An empty array should have been retruned');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with no values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?skip=`))
              .expect(BAD_REQUEST)
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?skip=aaa`))
              .expect(BAD_REQUEST)
              .then(done)
              .catch(done.fail);
          });
        });

        describe('supports limit', () => {
          it('with valid values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?limit=2`))
              .expect(OK)
              .then((res) => {
                expect(res.body.length).toBe(2, 'should have been limited');
              })
              .then(done)
              .catch(done.fail);
          });

          it('limit=0 is the same as unlimited', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?limit=0`))
              .expect(OK)
              .then((res) => {
                expect(res.body.length).toBe(5, 'All results should have been returned');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with no values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?limit=`))
              .expect(BAD_REQUEST)
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid values', (done) => {
            request(sapi.app)
              .get(testUrl(`/user?limit=aaa`))
              .expect(BAD_REQUEST)
              .then(done)
              .catch(done.fail);
          });
        });

        it('supports limit + skip', (done) => {
          request(sapi.app)
            .get(testUrl(`/user?limit=2&skip=2`))
            .expect(OK)
            .then((res) => {
              expect(res.body.length).toBe(2, 'should have been limited to 2 entries');
              expect(res.body[0].id).toBe(this.user3.id.toString(), 'Unexpected skip result');
              expect(res.body[1].id).toBe(this.user4.id.toString(), 'Unexpected skip result');
            })
            .then(done)
            .catch(done.fail);
        });
      });

      describe('GET ./model/:id', () => {

        beforeEach((done) => {
          User
            .removeAll({})
            .then(() => {
              const user = new User();
              this.user1 = user;
              return user.create();
            })
            .then(() => {
              const user = new User();
              user.firstName = 'Martha';
              this.user2 = user;
              return user.create();
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns a specific document with all fields properly mapped by @Json', (done) => {
          request(sapi.app)
            .get(testUrl(`/user/${this.user1.id}`))
            .expect('Content-Type', /json/)
            .expect(OK)
            .then((res) => {
              const result = res.body;
              expect(Array.isArray(result)).toBeFalsy('Should have returned a single document');
              expect(result.id).toBe(this.user1.id.toString());
              expect(result.fn).toBe(this.user1.firstName);
              expect(result.ln).toBe(this.user1.lastName);
              expect(result.contact).toBeDefined();
              expect(result.contact.phone).toBe(this.user1.contact.phone);
              expect(result.contact.mobile).toBe(this.user1.contact.mobile);
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns null with no result', (done) => {
          request(sapi.app)
            .get(testUrl(`/user/123`))
            .expect('Content-Type', /json/)
            .expect(OK)
            .then((res) => {
              expect(res.body).toBe(null);
            })
            .then(done)
            .catch(done.fail);
        });

        describe('supports fields projection', () => {

          it('returns 400 with invalid json for fields parameter', (done) => {
            request(sapi.app)
              .get(testUrl(`/user/${this.user1.id.toString()}?fields={blah}`))
              .expect(BAD_REQUEST)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected token b in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid json for fields=', (done) => {
            request(sapi.app)
              .get(testUrl(`/user/${this.user1.id.toString()}?fields=`))
              .expect(BAD_REQUEST)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected end of JSON input');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with excluded fields', (done) => {
            const fields = {
              ln: 0
            };

            request(sapi.app)
              .get(testUrl(`/user/${this.user1.id.toString()}?fields=${JSON.stringify(fields)}`))
              .expect(OK)
              .then((res) => {
                expect(res.body.fn).toBeDefined('firstName should not have been excluded');
                expect(res.body.ln).toBeUndefined('lastName should have been excluded');
                expect(res.body.contact).toBeDefined('contact should not have been excluded');
                expect(res.body.contact.phone).toBe(this.user1.contact.phone);
                expect(res.body.contact.mobile).toBe(this.user1.contact.mobile);
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with embedded document excluded fields', (done) => {
            const fields = {
              contact: {mobile: 0}
            };

            request(sapi.app)
              .get(testUrl(`/user/${this.user1.id.toString()}?fields=${JSON.stringify(fields)}`))
              .expect(OK)
              .then((res) => {
                expect(res.body.fn).toBe(this.user1.firstName);
                expect(res.body.ln).toBe(this.user1.lastName);
                expect(res.body.contact).toBeDefined('contact should not have been excluded');
                expect(res.body.contact.phone).toBe(this.user1.contact.phone);
                expect(res.body.contact.mobile).toBeUndefined('mobile should not have been included');
              })
              .then(done)
              .catch(done.fail);
          });
        });
      });

      describe('POST ./model', () => {

        beforeEach((done) => {
          User
            .removeAll({})
            .then(done)
            .catch(done.fail);
        });

        it('returns 400 if the body is not an object', (done) => {
          // Note: this test assumes that bodyparser middleware is installed... if it is, then there's a default
          // top level error handler setup on the `.listen` method of SakuraApi that will catch a bodyparser parsing
          // error and it should inject the 'invalid_body' error property.

          request(sapi.app)
            .post(testUrl(`/user`))
            .type('application/json')
            .send(`{test:}`)
            .expect(BAD_REQUEST)
            .then((res) => {
              expect(res.body.error).toBe('invalid_body');
            })
            .then(done)
            .catch(done.fail);
        });

        it('takes a json object and creates it', (done) => {
          const obj = {
            contact: {
              phone: 'not invented yet'
            },
            fn: 'Abraham',
            ln: 'Lincoln'
          };

          request(sapi.app)
            .post(testUrl('/user'))
            .type('application/json')
            .send(JSON.stringify(obj))
            .expect(OK)
            .then((res) => {
              expect(res.body.count).toBe(1, 'One document should have been inserted into the db');
              expect(ObjectID.isValid(res.body.id)).toBeTruthy('A valid ObjectID should have been returned');
              return res.body.id;
            })
            .then((id) => {
              return User
                .getCollection()
                .find<any>({_id: new ObjectID(id)})
                .limit(1)
                .next()
                .then((result) => {
                  expect(result.fname).toBe(obj.fn);
                  expect(result.lname).toBe(obj.ln);
                  expect(result.contact).toBeDefined('contact embedded document should have been created');
                  expect(result.contact.phone).toBe(obj.contact.phone);
                  expect(result.contact.mobile).toBe('111-111-1111', 'Default value should have been saved');
                });
            })
            .then(done)
            .catch(done.fail);
        });

        it('sends http status 409 on MongoError: E11000', (done) => {
          let indexName;

          const userDb = sapi.dbConnections.getDb('userDb');
          userDb
            .collection('usersRoutableTests')
            .createIndex({email: 1}, {unique: true})
            .then((idxName) => {
              indexName = idxName;

              const user1 = User.fromJson({
                email: 'test'
              });

              const user2 = User.fromJson({
                email: 'test'
              });

              const wait = [];

              wait.push(user1.create());
              wait.push(user2.create());

              return Promise.all(wait);
            })
            .then(() => {
              done.fail('A MongoDB duplicate error should have been thrown, this test is invalid');
            })
            .catch((err) => {
              expect(err.name).toBe('MongoError', 'Test setup should have returned a MongoError. ' +
                `It returned ${(err || {} as any).name} instead. This test is not in a valid state`);
              expect(err.code).toBe(11000, 'The wrong kind of mongo error was thrown, the test is in an invalid state');
            })
            .then(() => {
              return request(sapi.app)
                .post(testUrl(`/user`))
                .type('application/json')
                .send({
                  email: 'test',
                  firstName: 'george',
                  lastName: 'washington',
                  password: '123'
                })
                .expect(DUPLICATE_RESOURCE);
            })
            .then(() => {
              return sapi
                .dbConnections
                .getDb('userDb')
                .collection('usersRoutableTests')
                .dropIndex(indexName);
            })
            .then(done)
            .catch(done.fail);
        });
      });

      describe('PUT ./model', () => {
        beforeEach((done) => {
          User
            .removeAll({})
            .then(() => {
              const user = new User();
              this.user1 = user;
              return user.create();
            })
            .then(() => {
              const user = new User();
              user.firstName = 'Abraham';
              user.lastName = 'Lincoln';
              this.user2 = user;
              return user.create();
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns 400 if the body is not an object', (done) => {
          // Note: this test assumes that bodyparser middleware is installed... if it is, then there's a default
          // top level error handler setup on the `.listen` method of SakuraApi that will catch a bodyparser parsing
          // error and it should inject the 'invalid_body' error property.

          request(sapi.app)
            .put(testUrl(`/user/${this.user1.id.toString()}`))
            .type('application/json')
            .send(`{test:}`)
            .expect(BAD_REQUEST)
            .then((res) => {
              expect(res.body.error).toBe('invalid_body');
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns 404 if the document to be updated is not found', (done) => {
          request(sapi.app)
            .put(testUrl(`/user/aaa`))
            .type('application/json')
            .send(JSON.stringify({}))
            .expect(NOT_FOUND)
            .then(done)
            .catch(done.fail);
        });

        it('takes a json object and updates it', (done) => {
          const obj = {
            contact: {
              mobile: '888',
              phone: '777'
            },
            fn: 'Abe',
            id: 1234321,
            ln: 'Speed',
            tall: true
          };

          request(sapi.app)
            .put(testUrl(`/user/${this.user2.id.toString()}`))
            .type('application/json')
            .send(JSON.stringify(obj))
            .expect(OK)
            .then((res) => {
              expect(res.body.modified).toBe(1, 'One record should have been modified');
            })
            .then(() => {
              return User
                .getCollection()
                .find({_id: this.user2.id})
                .next();
            })
            .then((updated: any) => {
              expect(updated.fname).toBe(obj.fn);
              expect(updated.lname).toBe(obj.ln);
              expect(updated.contact).toBeDefined('contact should exist after update');
              expect(updated.contact.phone).toBe(obj.contact.phone);
              expect(updated.contact.mobile).toBe(obj.contact.mobile);
              expect(updated._id.toString()).toBe(this.user2.id.toString());
              expect(updated.tall).toBeUndefined('arbitrary fields should not be included in the changeset');
            })
            .then(done)
            .catch(done.fail);
        });
      });

      describe('DELETE ./mode/:id', () => {
        beforeEach((done) => {
          User
            .removeAll({})
            .then(() => {
              const user = new User();
              this.user1 = user;
              return user.create();
            })
            .then(() => {
              const user = new User();
              this.user2 = user;
              return user.create();
            })
            .then(done)
            .catch(done.fail);
        });

        it('removes the document from the db if a matching id is found', (done) => {
          request(sapi.app)
            .delete(testUrl(`/user/${this.user1.id.toString()}`))
            .then((result: any) => {
              expect(result.body.n).toBe(1, 'one record should have been removed');
              return User
                .getCollection()
                .find({_id: this.user1.id})
                .limit(1)
                .next();
            })
            .then((result) => {
              expect(result).toBeNull(`User ${this.user1.id} should have been deleted`);
            })
            .then(() => {
              return User
                .getCollection()
                .find({_id: this.user2.id})
                .limit(1)
                .next();
            })
            .then((result: any) => {
              expect(result._id.toString())
                .toBe(this.user2.id.toString(), 'Other documents should not have been removed');
            })
            .then(done)
            .catch(done.fail);
        });
      });

      describe('exposeApi suppresses non exposed endpoints', () => {
        it('only the exposeApi endpoints are added', () => {
          @Model()
          class TestModel {
          }

          @Routable({
            exposeApi: ['delete'],
            model: TestModel
          })
          class RoutableExposeApiTest {

          }

          testSapi({
            models: [TestModel],
            routables: [RoutableExposeApiTest]
          });

          const routableExposeApiTest = new RoutableExposeApiTest();

          expect(routableExposeApiTest[routableSymbols.routes].length).toBe(1);
          expect(routableExposeApiTest[routableSymbols.routes][0].method).toBe('deleteRouteHandler');
        });

        it('invalid exposeApi option', () => {
          @Model()
          class TestModel {
          }

          @Routable({
            exposeApi: ['invalid' as any],
            model: User
          })
          class RoutableExposeApiInvalidTest {

          }

          testSapi({
            models: [TestModel],
            routables: [RoutableExposeApiInvalidTest]
          });

          const routableExposeApiInvalidTest = new RoutableExposeApiInvalidTest();
          expect(routableExposeApiInvalidTest[routableSymbols.routes].length).toBe(0);
        });
      });

      describe('suppressApi exposes non suppressed endpoints', () => {

        @Model()
        class Bob {
        }

        @Routable({
          baseUrl: 'RoutableSuppressApiTrueTest',
          model: Bob,
          suppressApi: true
        })
        class RoutableSuppressApiTrueTest {
        }

        @Routable({
          baseUrl: 'RoutableSuppressApiTrueTest',
          model: Bob,
          suppressApi: ['post']
        })
        class RoutableSuppressApiPostTest {
        }

        it('suppressess all model generated endpoints when suppressApi is set to true rather than an array', async () => {
          const sapi2 = testSapi({
            routables: [RoutableSuppressApiTrueTest]
          });

          const routableSuppressApiTrueTest = new RoutableSuppressApiTrueTest();
          expect(routableSuppressApiTrueTest[routableSymbols.routes].length).toBe(0);

          sapi2.close();
        });

        it('suppressess only generated endpoints that are not suppressed', async () => {
          const sapi2 = testSapi({
            models: [Bob],
            routables: [RoutableSuppressApiPostTest]
          });

          const routableSuppressApiPostTest = new RoutableSuppressApiPostTest();
          expect(routableSuppressApiPostTest[routableSymbols.routes].length).toBe(4);

          for (let i = 0; i < routableSuppressApiPostTest[routableSymbols.routes].length; i++) {
            expect(routableSuppressApiPostTest[routableSymbols.routes][i].httpMethod).not.toBe('post');
          }

          await sapi2.close();
        });
      });
    });
  });

  describe('authenticators', () => {

    @AuthenticatorPlugin()
    class TestAuthenticator1 implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: OK, success: true};
      }
    }

    @AuthenticatorPlugin()
    class TestAuthenticator2 implements IAuthenticator, IAuthenticatorConstructor {
      async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
        return {data: {}, status: OK, success: true};
      }
    }

    it('array of authenticators is injected', async () => {
      @Routable({authenticator: [TestAuthenticator1]})
      class TestRoutable extends SapiRoutableMixin() {
      }

      testSapi({
        routables: [TestRoutable]
      });

      expect(TestRoutable[routableSymbols.authenticators]).toBeDefined();
      expect(Array.isArray(TestRoutable[routableSymbols.authenticators])).toBeTruthy();
      expect(TestRoutable[routableSymbols.authenticators][0]).toBe(TestAuthenticator1);
    });

    it('single authenticator is injected as array of authenticators', async () => {

      @Routable({authenticator: TestAuthenticator1})
      class TestAuthenticatorInjectedArray extends SapiRoutableMixin() {
      }

      testSapi({
        routables: [TestAuthenticatorInjectedArray]
      });

      expect(TestAuthenticatorInjectedArray[routableSymbols.authenticators]).toBeDefined();
      expect(Array.isArray(TestAuthenticatorInjectedArray[routableSymbols.authenticators])).toBeTruthy();
      expect(TestAuthenticatorInjectedArray[routableSymbols.authenticators][0]).toBe(TestAuthenticator1);
    });

    it('no authenticator is injected as empty array of authenticators', async () => {

      @Routable()
      class TestAuthenticatorInjectedArray extends SapiRoutableMixin() {
      }

      testSapi({
        routables: [TestAuthenticatorInjectedArray]
      });

      expect(TestAuthenticatorInjectedArray[routableSymbols.authenticators]).toBeDefined();
      expect(Array.isArray(TestAuthenticatorInjectedArray[routableSymbols.authenticators])).toBeTruthy();
      expect(TestAuthenticatorInjectedArray[routableSymbols.authenticators].length).toBe(0);
    });

    it('sets up @Routable level routes on route handler middleware meta data', () => {
      @Routable({
        authenticator: [TestAuthenticator1, TestAuthenticator2]
      })
      class SetsUpRoutableLevelRoutes extends SapiRoutableMixin() {
        @Route()
        test() {
        }
      }

      const sapi = testSapi({
        routables: [SetsUpRoutableLevelRoutes]
      });

      const R = sapi.getRoutable(SetsUpRoutableLevelRoutes);
      const r = new R();
      const routes: ISakuraApiClassRoute[] = r[routableSymbols.routes];

      expect(routes.length).toBe(1);
      expect(routes[0].authenticators.length).toBe(2);
      expect(routes[0].authenticators[0]).toBe(TestAuthenticator1);
      expect(routes[0].authenticators[1]).toBe(TestAuthenticator2);
    });

    it('sets up @Route level routes on route handler middleware meta data', () => {
      @Routable()
      class SetsUpRoutableLevelRoutes extends SapiRoutableMixin() {
        @Route({authenticator: [TestAuthenticator1, TestAuthenticator2]})
        test() {
        }
      }

      const sapi = testSapi({
        routables: [SetsUpRoutableLevelRoutes]
      });

      const R = sapi.getRoutable(SetsUpRoutableLevelRoutes);
      const r = new R();
      const routes: ISakuraApiClassRoute[] = r[routableSymbols.routes];

      expect(routes.length).toBe(1);
      expect(routes[0].authenticators.length).toBe(2);
      expect(routes[0].authenticators[0]).toBe(TestAuthenticator1);
      expect(routes[0].authenticators[1]).toBe(TestAuthenticator2);
    });

    it('sets up @Route and @Routable level routes on route handler middleware meta data', () => {
      @Routable({authenticator: [TestAuthenticator2, TestAuthenticator1]})
      class SetsUpRoutableLevelRoutes extends SapiRoutableMixin() {
        @Route({authenticator: [TestAuthenticator1, TestAuthenticator2]})
        test() {
        }
      }

      const sapi = testSapi({
        routables: [SetsUpRoutableLevelRoutes]
      });

      const R = sapi.getRoutable(SetsUpRoutableLevelRoutes);
      const r = new R();
      const routes: ISakuraApiClassRoute[] = r[routableSymbols.routes];

      expect(routes.length).toBe(1);
      expect(routes[0].authenticators.length).toBe(4);
      expect(routes[0].authenticators[0]).toBe(TestAuthenticator1);
      expect(routes[0].authenticators[1]).toBe(TestAuthenticator2);
      expect(routes[0].authenticators[2]).toBe(TestAuthenticator2);
      expect(routes[0].authenticators[3]).toBe(TestAuthenticator1);
    });

    it('sets up multiple @Route and @Routable level routes on route handler middleware meta data', () => {
      @Routable({authenticator: [TestAuthenticator2, TestAuthenticator1]})
      class SetsUpRoutableLevelRoutes extends SapiRoutableMixin() {

        @Route({
          authenticator: [TestAuthenticator1, TestAuthenticator2]
        })
        test() {
        }

        @Route({
          authenticator: [TestAuthenticator1, TestAuthenticator1],
          method: 'post'
        })
        test2() {
        }

      }

      const sapi = testSapi({
        routables: [SetsUpRoutableLevelRoutes]
      });

      const R = sapi.getRoutable(SetsUpRoutableLevelRoutes);
      const r = new R();
      const routes: ISakuraApiClassRoute[] = r[routableSymbols.routes];

      expect(routes.length).toBe(2);
      expect(routes[0].method).toBe('test');
      expect(routes[0].authenticators.length).toBe(4);
      expect(routes[0].authenticators[0]).toBe(TestAuthenticator1);
      expect(routes[0].authenticators[1]).toBe(TestAuthenticator2);
      expect(routes[0].authenticators[2]).toBe(TestAuthenticator2);
      expect(routes[0].authenticators[3]).toBe(TestAuthenticator1);
      expect(routes[1].method).toBe('test2');
      expect(routes[1].authenticators.length).toBe(4);
      expect(routes[1].authenticators[0]).toBe(TestAuthenticator1);
      expect(routes[1].authenticators[1]).toBe(TestAuthenticator1);
      expect(routes[1].authenticators[2]).toBe(TestAuthenticator2);
      expect(routes[1].authenticators[3]).toBe(TestAuthenticator1);
    });
  });

  describe('dependency injection', () => {

    @Routable()
    class TestDi {
    }

    @Routable()
    class TestDiOverride {
    }

    it('decorates @Routable class with DI id', () => {
      const test = new TestDi();

      expect(TestDi[routableSymbols.id].split('-').length).toBe(5);

      expect(test[routableSymbols.isSakuraApiRoutable]).toBe(true);
      expect(TestDi[routableSymbols.isSakuraApiRoutable]).toBeTruthy();

      expect(() => TestDi[routableSymbols.id] = null).toThrowError(`Cannot assign to read only property ` +
        `'Symbol(routableId)' of function '[object Function]'`);
      expect(() => test[routableSymbols.isSakuraApiRoutable] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiRoutable)' of object '#<TestDi>'`);
    });

    it('can retrieve Routable by name', async () => {
      const sapi = testSapi({
        routables: [TestDi]
      });

      // tslint:disable-next-line:variable-name
      const R = sapi.getRoutableByName('TestDi');

      expect(R).toBeDefined('Routable should have been defined');
      expect(new R() instanceof TestDi).toBeTruthy('Should have been an instance of TestDIRoutable ' +
        `but instead was an instsance of ${(R.constructor || {} as any).name || R.name}`);

      await sapi.close();
    });

    it('allows overriding of @Routable decorated class', async () => {
      const sapi = testSapi({
        routables: [{use: TestDiOverride, for: TestDi}]
      });

      // tslint:disable-next-line:variable-name
      const TestRoutable = sapi.getRoutable(TestDi);
      const testRoutable = new TestRoutable();

      expect(TestRoutable).toBeDefined('Routable should have been defined');
      expect(testRoutable instanceof TestDiOverride).toBeTruthy('Should have been an instance of ' +
        `TestDiOverride but instead was an instsance of ` +
        `${(testRoutable.constructor || {} as any).name || testRoutable.name}`);

      await sapi.close();
    });

    describe('sapi injected', () => {

      @Routable()
      class TestRoutableSapiInjection extends SapiModelMixin() {
      }

      let sapi: SakuraApi;
      beforeEach(() => {
        sapi = testSapi({
          routables: [TestRoutableSapiInjection]
        });
      });

      afterEach(async () => {
        await sapi.close();
      });

      it('@Routable has reference to sapi injected as symbol when SakuraApi is constructed', () => {
        const sapiRef = TestRoutableSapiInjection[routableSymbols.sapi];

        expect(sapiRef).toBeDefined();
        expect(sapiRef instanceof SakuraApi).toBe(true, 'Should have been an instance of SakuraApi'
          + ` but was an instance of ${sapiRef.name || (sapiRef.constructor || {} as any).name} instead`);
      });

      it('@Routable has reference to sapi injected as symbol when SakuraApi is constructed', () => {
        const sapiRef = TestRoutableSapiInjection.sapi;

        expect(sapiRef).toBeDefined();
        expect(sapiRef instanceof SakuraApi).toBe(true, 'Should have been an instance of SakuraApi'
          + ` but was an instance of ${(sapiRef as any).name || (sapiRef.constructor || {} as any).name} instead`);
      });

      it('@Routable injects sapiConfig to make it easier to get access to sapiConfig', () => {
        expect(TestRoutableSapiInjection.sapiConfig).toBeDefined();
        expect(TestRoutableSapiInjection.sapiConfig.SAKURA_API_CONFIG_TEST).toBe('found');
      });
    });

    describe('SakuraApi.getRoutable', () => {
      it('does not allow non @Routable parameter in sapi.getModel', () => {
        class TestClass {
        }

        const sapi = testSapi({});

        expect(() => sapi.getRoutable({})).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
        expect(() => sapi.getRoutable(TestClass)).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
        expect(() => sapi.getRoutable('')).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
        expect(() => sapi.getRoutable(1)).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
        expect(() => sapi.getRoutable(null)).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
        expect(() => sapi.getRoutable(undefined)).toThrowError(RoutablesMustBeDecoratedWithRoutableError);
      });

      it('throws RoutableNotRegistered when attempting to get unregistered routable', () => {
        @Routable()
        class Invalid {
        }

        const sapi = testSapi({});

        expect(() => sapi.getRoutable(Invalid)).toThrowError(RoutableNotRegistered);
      });

      it('gets a routable', async () => {
        @Routable()
        class TestRoutable {
        }

        const sapi2 = testSapi({
          routables: [TestRoutable]
        });

        const result = sapi2.getRoutable(TestRoutable);
        expect(result.constructor).toEqual(TestRoutable.constructor);

        await sapi2.close();
      });
    });
  });
});
