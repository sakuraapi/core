import {
  NextFunction,
  Request,
  Response
} from 'express';
import {Sapi} from '../../spec/helpers/sakuraapi';
import {
  Routable,
  routableSymbols,
  Route,
  SakuraApiRoutable
} from './';

import {ObjectID} from 'mongodb';
import {
  Db,
  Json,
  Model,
  SakuraApiModel
} from '../@model';
import {IRoutableLocals} from './routable';

import method = require('lodash/method');
import before = require('lodash/before');
import request = require('supertest');

describe('core/Routable', function() {
  describe('general functionality', function() {
    const sapi = Sapi();

    describe('IRoutableOptions', function() {

      it('add a baseUrl to the path of an @Route, if provided', function() {
        @Routable(sapi, {
          autoRoute: false,
          baseUrl: 'coreRoutableAddBaseUrlTest'
        })
        class CoreRoutableAddBaseUrlTest {
          @Route()
          aRouteMethod() {
          }
        }

        const router = new CoreRoutableAddBaseUrlTest();
        const routes = router[routableSymbols.sakuraApiClassRoutes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');
        expect(routes.length).toBe(1, 'There should have been one route defined');
        expect(routes[0].path).toBe('/coreRoutableAddBaseUrlTest', 'baseUrl was not properly set by @Routable');
      });

      it('ignore @Route methods that are listed in the @Routable(blacklist)', function() {
        @Routable(sapi, {
          autoRoute: false,
          blackList: ['bRouteMethod']
        })
        class CoreRoutableIgnoreRoutableBlacklisted {
          @Route()
          aRouteMethod() {
          }

          @Route()
          bRouteMethod() {
          }
        }

        const router = new CoreRoutableIgnoreRoutableBlacklisted();
        const routes = router[routableSymbols.sakuraApiClassRoutes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');

        let found = false;
        for (const route of routes) {
          found = route.method === 'bRouteMethod';
        }

        expect(found).toBeFalsy('black listed path should not have been included in the routes');
      });

      it('handle the lack of a baseUrl gracefully', function() {
        @Routable(sapi, {autoRoute: false})
        class CoreRoutableNoBaseMethodWorks {
          @Route({
            path: '/'
          })
          aRouteMethod() {
          }

          @Route({
            path: 'bRouteMethod'
          })
          bRouteMethod() {
          }
        }

        const router = new CoreRoutableNoBaseMethodWorks();
        const routes = router[routableSymbols.sakuraApiClassRoutes];
        expect(routes).toBeDefined('@Routable class should have had route metadata');
        expect(routes.length).toBe(2, 'There should have been one route defined');
        expect(routes[0].path).toBe('/', 'baseUrl was not properly set by @Routable');
        expect(routes[1].path).toBe('/bRouteMethod', 'baseUrl was not properly set by @Routable');
      });

      it('suppress autoRouting if options.autoRoute = false', function(done) {
        @Routable(sapi, {autoRoute: false})
        class CoreRoutableSuppressRoutesWithAutoRouteFalse {
          @Route({
            path: 'autoRoutingFalseTest'
          })
          aRouteMethod(req, res) {
            res.status(200);
          }
        }

        sapi
          .listen({bootMessage: ''})
          .then(function() {
            return request(sapi.app)
              .get('/autoRoutingFalseTest')
              .expect(404);
          })
          .then(() => sapi.close())
          .then(done)
          .catch(done.fail);
      });
    });

    it('drops the traling / on a path', function() {
      @Routable(sapi, {
        autoRoute: false,
        baseUrl: 'CoreRoutableTrailingSlashDropTest'

      })
      class CoreRoutableTrailingSlashDropTest {
        @Route({
          path: '/dropThatTrailingSlash/'
        })
        aRouteMethod() {
        }
      }

      const router = new CoreRoutableTrailingSlashDropTest();
      const routes = router[routableSymbols.sakuraApiClassRoutes];
      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(1, 'There should have been one route defined');
      expect(routes[0].path)
        .toBe('/CoreRoutableTrailingSlashDropTest/dropThatTrailingSlash', 'trailing slash was not added');
    });

    it('adds the leading / on a path if its missing', function() {
      @Routable(sapi, {
        autoRoute: false,
        baseUrl: 'CoreRoutableTrailingSlashAddTest'

      })
      class CoreRoutableTrailingSlashAddTest {
        @Route({
          path: 'addThatTrailingSlash/'
        })
        aRouteMethod() {
        }
      }

      const router = new CoreRoutableTrailingSlashAddTest();
      const routes = router[routableSymbols.sakuraApiClassRoutes];
      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(1, 'There should have been one route defined');
      expect(routes[0].path)
        .toBe('/CoreRoutableTrailingSlashAddTest/addThatTrailingSlash', 'trailing slash was not added');
    });

    it('reads metadata from @Route and properly injects sakuraApiClassRoutes[] into the @Routable class', function() {
      @Routable(sapi, {
        autoRoute: false,
        baseUrl: 'CoreRoutableRoutesWork'
      })
      class CoreRoutableRoutesWork {
        @Route({
          method: 'get',
          path: 'a'
        })
        aRouteMethod() {
        }

        @Route({
          method: 'put',
          path: 'b'
        })
        bRouteMethod() {
        }
      }

      const router = new CoreRoutableRoutesWork();
      const routes = router[routableSymbols.sakuraApiClassRoutes];
      expect(routes).toBeDefined('@Routable class should have had route metadata');
      expect(routes.length).toBe(2, 'There should have been one route defined');
      expect(routes[0].path).toBe('/CoreRoutableRoutesWork/a');
      expect(routes[1].path).toBe('/CoreRoutableRoutesWork/b');
      expect(routes[0].method).toBe('aRouteMethod');
      expect(routes[1].method).toBe('bRouteMethod');
      expect(routes[0].httpMethod).toBe('get');
      expect(routes[1].httpMethod).toBe('put');
      expect(routes[0].name).toBe('CoreRoutableRoutesWork');
      expect(routes[1].name).toBe('CoreRoutableRoutesWork');
      expect(typeof routes[0].f).toBe('function');
      expect(typeof routes[1].f).toBe('function');

    });

    it('properly passes the constructor parameters', function() {
      @Routable(sapi, {autoRoute: false})
      class CoreRoutableProxiedConstructorWorks {

        constructor(public v: number) {
        }

        @Route({
          method: 'get',
          path: 'a'
        })
        aRouteMethod(req, res) {
        }
      }

      const result = new CoreRoutableProxiedConstructorWorks(777);
      expect(result.v).toBe(777, 'Constructor value was not passed to the instantiated object');
    });

    it('maintains the prototype chain', function() {
      @Routable(sapi, {autoRoute: false})
      class CoreRoutableInstanceOfWorks {

        constructor(public v: number) {
        }

        @Route({
          method: 'get',
          path: 'a'
        })
        aRouteMethod(req, res) {
        }
      }

      expect(new CoreRoutableInstanceOfWorks(777) instanceof CoreRoutableInstanceOfWorks)
        .toBeTruthy('the prototype chain should have been maintained');
    });

    it('binds the instantiated class as the context of this for each route method', function() {
      @Routable(sapi, {autoRoute: false})
      class CoreRoutableContextOfRouteMethod {
        someProperty = 'instance';

        @Route()
        someMethodTest4() {
          return this.someProperty;
        }
      }

      const obj = new CoreRoutableContextOfRouteMethod();

      expect(obj.someMethodTest4()).toBe(obj.someProperty);
      expect(obj[routableSymbols.sakuraApiClassRoutes][0].f()).toBe(obj.someProperty);
    });

    it('automatically instantiates its class and adds it to SakuraApi.route(...)', function(done) {
      const sapi = Sapi();

      @Routable(sapi)
      class CoreRouteAutoRouteTest {
        @Route({
          path: 'someMethodTest5'
        })
        someMethodTest5(req, res) {
          res
            .status(200)
            .json({someMethodTest5: 'testRouterGet worked'});
        }

        @Route({
          path: 'route/parameter/:test'
        })
        routeParameterTest(req: Request, res: Response) {
          const test = req.params.test;

          res
            .status(200)
            .json({result: test});
        }

        @Route({
          path: 'route2/:parameter/test'
        })
        routeParameterTest2(req: Request, res: Response) {
          const test = req.params.parameter;

          res
            .status(200)
            .json({result: test});
        }
      }

      sapi
        .listen({bootMessage: ''})
        .then(() => {
          return request(sapi.app)
            .get(this.uri('/someMethodTest5'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '42')
            .expect('{"someMethodTest5":"testRouterGet worked"}')
            .expect(200);
        })
        .then(() => sapi.close())
        .then(done)
        .catch(done.fail);
    });
  });

  describe('takes an @Model class in IRoutableOptions', function() {
    const sapi = Sapi();

    class Contact {
      @Db()
      @Json()
      phone = '000-000-0000';

      @Db()
      @Json()
      mobile = '111-111-1111';
    }

    @Model(sapi, {
      dbConfig: {
        collection: 'usersRoutableTests',
        db: 'userDb'
      }
    })
    class User extends SakuraApiModel {
      @Db('fname') @Json('fn')
      firstName: string = 'George';
      @Db('lname') @Json('ln')
      lastName: string = 'Washington';

      @Db({model: Contact})
      @Json()
      contact = new Contact();
    }

    @Model(sapi, {
      dbConfig: {
        collection: 'noDocsCreatedTests',
        db: 'userDb'
      }
    })
    class NoDocsCreated extends SakuraApiModel {
    }

    @Routable(sapi, {
      model: User
    })
    class UserApi1 {
      @Route({
        method: 'post',
        path: 'test-path'
      })
      testRoute(req, res) {
      }
    }

    @Routable(sapi, {
      baseUrl: 'testUserApi2',
      model: NoDocsCreated
    })
    class UserApi2 {
      @Route({
        method: 'post',
        path: 'test-path'
      })
      testRoute(req, res) {
      }
    }

    beforeEach(function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(done)
        .catch(done.fail);
    });

    afterEach(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    describe('throws', function() {
      it('if the provided model is not decorated with @Model', function() {
        expect(() => {
          class NotAModel {
          }

          @Routable(sapi, {
            model: NotAModel
          })
          class BrokenRoutable {

          }
        }).toThrow(new Error(`BrokenRoutable is not decorated by @Model and therefore cannot be used as a model for`
          + ` @Routable`));
      });

      it('if provided either suppressApi or exposeApi options without a model', function() {
        expect(() => {
          @Routable(sapi, {
            suppressApi: ['get']
          })
          class FailRoutableSuppressApiOptionTest {
          }
        })
          .toThrow(new Error(`If @Routable 'FailRoutableSuppressApiOptionTest' defines a 'suppressApi' or 'exposeApi'`
            + ` option, then a model option with a valid @Model must also be provided`));

        expect(() => {
          @Routable(sapi, {
            exposeApi: ['get']
          })
          class FailRoutableSuppressApiOptionTest {
          }
        }).toThrow(new Error(`If @Routable 'FailRoutableSuppressApiOptionTest' defines a 'suppressApi' or 'exposeApi'`
          + ` option, then a model option with a valid @Model must also be provided`));
      });
    });

    describe('generates routes with built in handlers when provided a model', function() {
      describe('properly names routes', function() {
        it('uses the model\'s name if there is no baseUrl for the @Routable class', function(done) {
          request(sapi.app)
            .get(this.uri('/user'))
            .expect(200)
            .then(done)
            .catch(done.fail);
        });
      });

      it('uses the baseUrl for the @Routable class if one is set', function(done) {
        request(sapi.app)
          .get(this.uri('/testUserApi2'))
          .expect(200)
          .then(done)
          .catch(done.fail);
      });

      describe('GET ./model', function() {

        beforeEach(function(done) {
          User
            .removeAll({})
            .then(() => {
              const user1 = new User();
              user1.contact.phone = '111-111-1111';
              this.user1 = user1;
              return user1.create();
            })
            .then(() => {
              const user2 = new User();
              user2.firstName = 'Martha';
              this.user2 = user2;
              return user2.create();
            })
            .then(() => {
              const user3 = new User();
              user3.firstName = 'Matthew';
              this.user3 = user3;
              return user3.create();
            })
            .then(() => {
              const user4 = new User();
              user4.firstName = 'Mark';
              this.user4 = user4;
              return user4.create();
            })
            .then(() => {
              const user5 = new User();
              user5.firstName = 'Luke';
              this.user5 = user5;
              return user5.create();
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns all documents with all fields properly mapped by @Json', function(done) {

          request(sapi.app)
            .get(this.uri('/user'))
            .expect('Content-Type', /json/)
            .expect(200)
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

        it('returns empty array with no results', function(done) {
          request(sapi.app)
            .get(this.uri('/testUserApi2'))
            .expect('Content-Type', /json/)
            .expect(200)
            .then((res) => {
              expect(Array.isArray(res.body)).toBeTruthy();
              expect(res.body.length).toBe(0);
            })
            .then(done)
            .catch(done.fail);
        });

        describe('supports a where query', function() {

          it('returns 400 with invalid json for where parameter', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?where={firstName:test}`))
              .expect(400)
              .then((res) => {
                expect(res.body).toBeDefined('There should have been a body returned with the error');
                expect(res.body.error).toBe('invalid_where_parameter');
                expect(res.body.details).toBe('Unexpected token f in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 200 with empty array when there is a valid where query with no matching entities', function(done) {
            const json = {
              fn: 'Zorg, Commander of the Raylon Empire'
            };

            request(sapi.app)
              .get(this.uri(`/user?where=${JSON.stringify(json)}`))
              .expect(200)
              .expect('Content-Type', /json/)
              .then((res) => {
                expect(res.body).toBeDefined();
                expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                expect(res.body.length).toBe(0);
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns the expected objects', function(done) {
            const json = {
              fn: 'George'
            };

            request(sapi.app)
              .get(this.uri(`/user?where=${JSON.stringify(json)}`))
              .expect(200)
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

          describe('supports deep where', function() {
            const json = {
              contact: {
                phone: '123'
              },
              fn: 'George'
            };

            it('with no results expected', function(done) {
              request(sapi.app)
                .get(this.uri(`/user?where=${JSON.stringify(json)}`))
                .expect(200)
                .expect('Content-Type', /json/)
                .then((res) => {
                  expect(res.body).toBeDefined();
                  expect(Array.isArray(res.body)).toBeTruthy('response body should be an array');
                  expect(res.body.length).toBe(0, 'no results should have matched the where query');
                })
                .then(done)
                .catch(done.fail);
            });

            it('with one result expected', function(done) {
              json.contact.phone = '111-111-1111';

              request(sapi.app)
                .get(this.uri(`/user?where=${JSON.stringify(json)}`))
                .expect(200)
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

          it('does not allow for NoSQL injection', function() {
            pending('not implemented: https://github.com/sakuraapi/api/issues/65');
          });

        });

        describe('supports fields projection', function() {

          it('returns 400 with invalid json for fields parameter', function(done) {
            request(sapi.app)
              .get(this.uri('/user?fields={blah}'))
              .expect(400)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected token b in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid json for fields=', function(done) {
            request(sapi.app)
              .get(this.uri('/user?fields='))
              .expect(400)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected end of JSON input');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with excluded fields', function(done) {
            const fields = {
              ln: 0
            };

            request(sapi.app)
              .get(this.uri(`/user?fields=${JSON.stringify(fields)}`))
              .expect(200)
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

          it('returns results with embedded document excluded fields', function(done) {
            const fields = {
              contact: {mobile: 0}
            };

            request(sapi.app)
              .get(this.uri(`/user?fields=${JSON.stringify(fields)}`))
              .expect(200)
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

        describe('supports skip', function() {
          it('with valid values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?skip=4`))
              .expect(200)
              .then((res) => {
                expect(res.body.length).toBe(1, 'should have skipped to last entry');
                expect(res.body[0].id).toBe(this.user5.id.toString());
                expect(res.body[0].fn).toBe(this.user5.firstName);
              })
              .then(done)
              .catch(done.fail);
          });

          it('with valid values greater than records available', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?skip=100`))
              .expect(200)
              .then((res) => {
                expect(Array.isArray(res.body)).toBeTruthy('Expected an empty array');
                expect(res.body.length).toBe(0, 'An empty array should have been retruned');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with no values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?skip=`))
              .expect(400)
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?skip=aaa`))
              .expect(400)
              .then(done)
              .catch(done.fail);
          });
        });

        describe('supports limit', function() {
          it('with valid values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?limit=2`))
              .expect(200)
              .then((res) => {
                expect(res.body.length).toBe(2, 'should have been limited');
              })
              .then(done)
              .catch(done.fail);
          });

          it('limit=0 is the same as unlimited', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?limit=0`))
              .expect(200)
              .then((res) => {
                expect(res.body.length).toBe(5, 'All results should have been returned');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with no values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?limit=`))
              .expect(400)
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid values', function(done) {
            request(sapi.app)
              .get(this.uri(`/user?limit=aaa`))
              .expect(400)
              .then(done)
              .catch(done.fail);
          });
        });

        it('supports limit + skip', function(done) {
          request(sapi.app)
            .get(this.uri(`/user?limit=2&skip=2`))
            .expect(200)
            .then((res) => {
              expect(res.body.length).toBe(2, 'should have been limited to 2 entries');
              expect(res.body[0].id).toBe(this.user3.id.toString(), 'Unexpected skip result');
              expect(res.body[1].id).toBe(this.user4.id.toString(), 'Unexpected skip result');
            })
            .then(done)
            .catch(done.fail);
        });
      });

      describe('GET ./model/:id', function() {

        beforeEach(function(done) {
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

        it('returns a specific document with all fields properly mapped by @Json', function(done) {
          request(sapi.app)
            .get(this.uri(`/user/${this.user1.id}`))
            .expect('Content-Type', /json/)
            .expect(200)
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

        it('returns null with no result', function(done) {
          request(sapi.app)
            .get(this.uri(`/user/123`))
            .expect('Content-Type', /json/)
            .expect(200)
            .then((res) => {
              expect(res.body).toBe(null);
            })
            .then(done)
            .catch(done.fail);
        });

        describe('supports fields projection', function() {

          it('returns 400 with invalid json for fields parameter', function(done) {
            request(sapi.app)
              .get(this.uri(`/user/${this.user1.id.toString()}?fields={blah}`))
              .expect(400)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected token b in JSON at position 1');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns 400 with invalid json for fields=', function(done) {
            request(sapi.app)
              .get(this.uri(`/user/${this.user1.id.toString()}?fields=`))
              .expect(400)
              .then((res) => {
                expect(res.body).toBeDefined('There should been a body returned with the error');
                expect(res.body.error).toBe('invalid_fields_parameter');
                expect(res.body.details).toBe('Unexpected end of JSON input');
              })
              .then(done)
              .catch(done.fail);
          });

          it('returns results with excluded fields', function(done) {
            const fields = {
              ln: 0
            };

            request(sapi.app)
              .get(this.uri(`/user/${this.user1.id.toString()}?fields=${JSON.stringify(fields)}`))
              .expect(200)
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

          it('returns results with embedded document excluded fields', function(done) {
            const fields = {
              contact: {mobile: 0}
            };

            request(sapi.app)
              .get(this.uri(`/user/${this.user1.id.toString()}?fields=${JSON.stringify(fields)}`))
              .expect(200)
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

      describe('POST ./model', function() {

        beforeEach(function(done) {
          User
            .removeAll({})
            .then(done)
            .catch(done.fail);
        });

        it('returns 400 if the body is not an object', function(done) {
          // Note: this test assumes that bodyparser middleware is installed... if it is, then there's a default
          // top level error handler setup on the `.listen` method of SakuraApi that will catch a bodyparser parsing
          // error and it should inject the 'invalid_body' error property.

          request(sapi.app)
            .post(this.uri(`/user`))
            .type('application/json')
            .send(`{test:}`)
            .expect(400)
            .then((res) => {
              expect(res.body.error).toBe('invalid_body');
            })
            .then(done)
            .catch(done.fail);
        });

        it('takes a json object and creates it', function(done) {
          const obj = {
            contact: {
              phone: 'not invented yet'
            },
            fn: 'Abraham',
            ln: 'Lincoln'
          };

          request(sapi.app)
            .post(this.uri('/user'))
            .type('application/json')
            .send(JSON.stringify(obj))
            .expect(200)
            .then((res) => {
              expect(res.body.count).toBe(1, 'One document should have been inserted into the db');
              expect(ObjectID.isValid(res.body.id)).toBeTruthy('A valid ObjectID should have been returned');
              return res.body.id;
            })
            .then((id) => {
              return User
                .getCollection()
                .find({_id: new ObjectID(id)})
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

      });

      describe('PUT ./model', function() {
        beforeEach(function(done) {
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

        it('returns 400 if the body is not an object', function(done) {
          // Note: this test assumes that bodyparser middleware is installed... if it is, then there's a default
          // top level error handler setup on the `.listen` method of SakuraApi that will catch a bodyparser parsing
          // error and it should inject the 'invalid_body' error property.

          request(sapi.app)
            .put(this.uri(`/user/${this.user1.id.toString()}`))
            .type('application/json')
            .send(`{test:}`)
            .expect(400)
            .then((res) => {
              expect(res.body.error).toBe('invalid_body');
            })
            .then(done)
            .catch(done.fail);
        });

        it('returns 404 if the document to be updated is not found', function(done) {
          request(sapi.app)
            .put(this.uri(`/user/aaa`))
            .type('application/json')
            .send(JSON.stringify({}))
            .expect(404)
            .then(done)
            .catch(done.fail);
        });

        it('takes a json object and updates it', function(done) {
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
            .put(this.uri(`/user/${this.user2.id.toString()}`))
            .type('application/json')
            .send(JSON.stringify(obj))
            .expect(200)
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

      describe('DELETE ./mode/:id', function() {
        beforeEach(function(done) {
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

        it('removes the document from the db if a matching id is found', function(done) {
          request(sapi.app)
            .delete(this.uri(`/user/${this.user1.id.toString()}`))
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

      describe('exposeApi suppresses non exposed endpoints', function() {
        pending('not implemented');
      });

      describe('suppressApi exposes non suppressed endpoints', function() {
        @Routable(sapi, {
          baseUrl: 'RoutableSuppressApiTrueTest',
          suppressApi: true,
          model: User
        })
        class RoutableSuppressApiTrueTest {
        }

        it('suppressess all model generated endpoints when suppressApi is set to true rather than an array', function(done) {
          request(sapi.app)
            .get(this.uri('/RoutableSuppressApiTrueTest'))
            .expect(404)
            .then(done)
            .catch(done.fail);
        });

        it('more thorough testing', function() {
          pending('not implemented');
        });
      });
    });
  });

  describe('beforeAll handlers', function() {
    const sapi = Sapi();

    @Model(sapi, {
      dbConfig: {
        collection: 'users',
        db: 'userDb'
      }
    })
    class UserBeforeAllHandlers extends SakuraApiModel {
      @Db() @Json()
      firstName = 'George';
      @Db() @Json()
      lastName = 'Washington';
      @Db() @Json()
      handlerWasRightInstanceOf = false;
      @Db() @Json()
      order = '';
    }

    @Routable(sapi, {
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

    beforeAll(function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => UserBeforeAllHandlers.removeAll({}))
        .then(done)
        .catch(done.fail);
    });

    afterAll(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('run before each @Route method', function(done) {
      request(sapi.app)
        .post(this.uri('/userbeforeallhandlers'))
        .type('application/json')
        .send({
          firstName: 'Ben',
          lastName: 'Franklin'
        })
        .expect(200)
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

    it('run in the correct order', function(done) {
      request(sapi.app)
        .post(this.uri('/userbeforeallhandlers'))
        .type('application/json')
        .send({
          firstName: 'Ben',
          lastName: 'Franklin',
          order: '0'
        })
        .expect(200)
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

  describe('afterAll handlers', function() {

    const sapi = Sapi();
    let test = 0;

    @Model(sapi, {
      dbConfig: {
        collection: 'users',
        db: 'userDb'
      }
    })
    class UserAfterAllHandlers extends SakuraApiModel {
      @Db() @Json()
      firstName = 'George';
      @Db() @Json()
      lastName = 'Washington';
      @Db() @Json()
      handlerWasRightInstanceOf = false;
      @Db() @Json()
      order = '1';
    }

    @Routable(sapi, {
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

    function testAfterHandler(req: Request, res: Response, next: NextFunction) {
      const resLocal = res.locals as IRoutableLocals;
      resLocal.data.order += '2';
      next();
    }

    beforeEach(function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => UserAfterAllHandlers.removeAll({}))
        .then(done)
        .catch(done.fail);
    });

    afterEach(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('run after each @Route method', function(done) {
      request(sapi.app)
        .post(this.uri(`/UserAfterAllHandlers?test=${++test}`))
        .type('application/json')
        .send({
          firstName: 'Ben',
          lastName: 'Franklin'
        })
        .expect(200)
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

  describe('beforeAll and afterAll handlers play nice together', function() {

    const sapi = Sapi();

    @Model(sapi, {
      dbConfig: {
        collection: 'users',
        db: 'userDb'
      }
    })
    class UserAfterAllHandlersBeforeAllHandlers extends SakuraApiModel {
      @Db() @Json()
      firstName = 'George';
      @Db() @Json()
      lastName = 'Washington';
      @Db() @Json()
      handlerWasRightInstanceOf = false;
      @Db() @Json()
      order = '1';
    }

    @Routable(sapi, {
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

    beforeEach(function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => UserAfterAllHandlersBeforeAllHandlers.removeAll({}))
        .then(done)
        .catch(done.fail);
    });

    afterEach(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('run after each @Route method', function(done) {

      request(sapi.app)
        .post(this.uri('/UserAfterAllHandlersBeforeAllHandlers'))
        .type('application/json')
        .send({
          firstName: 'Ben',
          lastName: 'Franklin'
        })
        .expect(200)
        .then((response) => {
          expect(response.body.order).toBe('1b2b1a2a');
          expect(response.body.count).toBe(1);
        })
        .then(done)
        .catch(done.fail);
    });

    it('throws if built in handler is called with no model bound', function() {

      try {
        @Routable(sapi)
        class RoutableWithInternalHandlerButNoModelTest {
          @Route({
            before: 'getAllHandler'
          })
          badJuju() {
          }
        }

        fail('Should not have reached here');
      } catch (err) {
        expect(err.message).toBe('RoutableWithInternalHandlerButNoModelTest is attempting to use built in handler ' +
          'getAllRouteHandler, which requires RoutableWithInternalHandlerButNoModelTest to be bound to a model');
      }

    });
  });

  describe('before and after handlers can utilize injected route handlers', function() {
    const sapi = Sapi();

    @Model(sapi, {
      dbConfig: {
        collection: 'BeforeAfterInjectRouteTestModel',
        db: 'userDb'
      }
    })
    class BeforeAfterInjectRouteTestModel extends SakuraApiModel {
      @Db() @Json()
      firstName = 'George';

      @Db() @Json()
      lastName = 'Washington';
    }

    afterEach(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    describe('getAllHandler', function() {
      @Routable(sapi, {
        baseUrl: 'GetAllRouteHandlerBeforeAfterTest',
        model: BeforeAfterInjectRouteTestModel
      })
      class GetAllRouteHandlerBeforeAfterTest extends SakuraApiRoutable {
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
          before: ['getAllHandler'],
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

      it('with result', function(done) {
        sapi
          .listen({bootMessage: ''})
          .then(() => new BeforeAfterInjectRouteTestModel().create())
          .then(() => {
            return request(sapi.app)
              .get(this.uri('/GetAllRouteHandlerBeforeAfterTest/beforeTest/get'))
              .expect(200)
              .then((res) => {
                const body = res.body;
                expect(body.length).toBe(1);
                expect(body[0].firstName).toBe('Georgellio');
                expect(body[0].lastName).toBe('Washington');
                expect(body[0].id).toBeDefined();
              });
          })
          .then(done)
          .catch(done.fail);
      });

      it('without results', function(done) {
        sapi
          .listen({bootMessage: ''})
          .then(() => BeforeAfterInjectRouteTestModel.removeAll({}))
          .then(() => {
            return request(sapi.app)
              .get(this.uri('/GetAllRouteHandlerBeforeAfterTest/beforeTest/get'))
              .expect(200)
              .then((res) => {
                const body = res.body;
                expect(Array.isArray(body)).toBeTruthy();
                expect(body.length).toBe(0);
              });
          })
          .then(done)
          .catch(done.fail);
      });
    });

    describe('get handler', function() {
      @Routable(sapi, {
        baseUrl: 'GetRouteHandlerBeforeAfterTest',
        model: BeforeAfterInjectRouteTestModel
      })
      class GetRouteHandlerBeforeAfterTest extends SakuraApiRoutable {
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
          before: ['getHandler'],
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
          before: ['getHandler'],
          method: 'get',
          path: 'beforeTest/get2/:id'
        })
        get2BeforeTest(req: Request, res: Response, next: NextFunction) {
          const resLocal = res.locals as IRoutableLocals;
          expect(resLocal.data).toBe(null);
          next();
        }

      }

      it('with valid id', function(done) {
        sapi
          .listen({bootMessage: ''})
          .then(() => new BeforeAfterInjectRouteTestModel().create())
          .then((db) => {
            return request(sapi.app)
              .get(this.uri(`/GetRouteHandlerBeforeAfterTest/beforeTest/get/${db.insertedId}`))
              .expect(200)
              .then((res) => {
                const body = res.body;
                expect(body.firstName).toBe('Georgellio');
                expect(body.lastName).toBe('Washington');
                expect(body.id).toBeDefined();
              });
          })
          .then(done)
          .catch(done.fail);
      });

      it('with invalid id', function(done) {
        sapi
          .listen({bootMessage: ''})
          .then(() => {
            return request(sapi.app)
              .get(this.uri(`/GetRouteHandlerBeforeAfterTest/beforeTest/get2/123`))
              .expect(200)
              .then((res) => {
                const body = res.body;
                expect(body).toBe('ok');
              });
          })
          .then(done)
          .catch(done.fail);
      });
    });
  });
});
