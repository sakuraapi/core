import * as express from 'express';
import * as request from 'supertest';
import {sapi} from '../../spec/helpers/sakuraapi';
import {
  Db,
  Json,
  Model,
  SakuraApiModel
} from '../@model';
import {
  Routable,
  routableSymbols,
  Route
} from './';

import method = require('lodash/method');
import before = require('lodash/before');

describe('core/Routable', function() {

  @Routable(sapi, {
    baseUrl: 'test',
    blackList: ['someBlacklistedMethod']
  })
  class Test {

    constructor(public someProperty?: number) {
    }

    @Route({
      method: 'get',
      path: '/'
    })
    someMethod(req: express.Request, res: express.Response) {
      res
        .status(200)
        .send({someMethodCalled: true});
    }

    @Route({
      method: 'post',
      path: 'someOtherMethod/'
    })
    someOtherMethod(req: express.Request, res: express.Response) {
      res
        .status(200)
        .send({someOtherMethodCalled: true});
    }

    @Route({
      method: 'post',
      path: 'someBlacklistedMethod/'
    })
    someBlacklistedMethod(req: express.Request, res: express.Response) {
      res
        .status(200)
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

    }
  }

  beforeEach(function() {
    this.t = new Test(777);
    this.sakuraApiClassRoutes = this.t[routableSymbols.sakuraApiClassRoutes];

    spyOn(console, 'log');
  });

  describe('IRoutableOptions', function() {
    it('add a baseUrl to the path of an @Route, if provided', function() {
      expect(this.sakuraApiClassRoutes[0].path).toBe('/test');
    });

    it('ignore @Route methods that are listed in the @Routable(blacklist)', function() {
      expect(this.sakuraApiClassRoutes).toBeDefined();
      expect(this.sakuraApiClassRoutes.length).toBe(4);
      let found = false;
      this.sakuraApiClassRoutes.forEach((route) => {
        found = route.method === 'someBlacklistedMethod';
      });
      expect(found)
        .toBe(false);
    });

    it('handle the lack of a baseUrl gracefully', function() {
      @Routable(sapi)
      class Test2 {
        @Route({
          method: 'get',
          path: '/'
        })
        someMethodTest2(req: express.Request, res: express.Response) {
          res
            .status(200)
            .send({someMethodCalled: true});
        }

        @Route({
          method: 'get',
          path: 'someOtherMethodTest2'
        })
        someOtherMethodTest2(req: express.Request, res: express.Response) {
          res
            .status(200)
            .send({someMethodCalled: true});
        }
      }

      const t2 = new Test2();
      expect(t2[routableSymbols.sakuraApiClassRoutes][0].path).toBe('/');
      expect(t2[routableSymbols.sakuraApiClassRoutes][1].path).toBe('/someOtherMethodTest2');
    });

    it('suppress autoRouting if options.autoRoute = false', function(done) {

      @Routable(sapi, {
        autoRoute: false
      })
      class Test {
        @Route({
          path: 'autoRoutingFalseTest'
        })
        handle(req, res) {
          res.status(200);
        }
      }

      sapi
        .listen()
        .then(function() {
          request(sapi.app)
            .get('/autoRoutingFalseTest')
            .expect(404)
            .end(function(err, res) {
              if (err) {
                return done.fail(err);
              }
              sapi
                .close()
                .then(done)
                .catch(done.fail);
            });
        })
        .catch(done.fail);
    });
  });

  it('drops the traling / on a path', function() {
    expect(this.sakuraApiClassRoutes[1].path).toBe('/test/someOtherMethod');
  });

  it('adds the leading / on a path if its missing', function() {
    expect(this.sakuraApiClassRoutes[1].path).toBe('/test/someOtherMethod');
  });

  it('reads metadata from @Route and properly injects sakuraApiClassRoutes[] into the @Routable class', function() {
    expect(this.sakuraApiClassRoutes).toBeDefined();
    expect(this.sakuraApiClassRoutes.length).toBe(4);
    expect(this.sakuraApiClassRoutes[0].path).toBe('/test');
    expect(typeof this.sakuraApiClassRoutes[0].f).toBe('function');
    expect(this.sakuraApiClassRoutes[0].httpMethod).toBe('get');
    expect(this.sakuraApiClassRoutes[0].method).toBe('someMethod');
    expect(this.sakuraApiClassRoutes[1].path).toBe('/test/someOtherMethod');
    expect(typeof this.sakuraApiClassRoutes[1].f).toBe('function');
    expect(this.sakuraApiClassRoutes[1].httpMethod).toBe('post');
    expect(this.sakuraApiClassRoutes[1].method).toBe('someOtherMethod');
  });

  it('properly passes the constructor parameters', function() {
    expect(this.t.someProperty).toBe(777);
  });

  it('maintains the prototype chain', function() {
    expect(this.t instanceof Test).toBe(true);
  });

  it('binds the instantiated class as the context of this for each route method', function() {
    @Routable(sapi)
    class Test4 {
      someProperty = 'instance';

      @Route()
      someMethodTest4() {
        return this.someProperty;
      }
    }

    const c = new Test4();

    expect(c.someMethodTest4()).toBe(c.someProperty);
    expect(c[routableSymbols.sakuraApiClassRoutes][0].f()).toBe(c.someProperty);
  });

  it('automatically instantiates its class and adds it to SakuraApi.instance.route(...)', function(done) {

    @Routable(sapi)
    class Test5 {

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
      routeParameterTest(req: express.Request, res: express.Response) {
        const test = req.params.test;

        res
          .status(200)
          .json({result: test});
      }

      @Route({
        path: 'route2/:parameter/test'
      })
      routeParameterTest2(req: express.Request, res: express.Response) {
        const test = req.params.parameter;

        res
          .status(200)
          .json({result: test});
      }

    }

    sapi
      .listen()
      .then(() => {
        request(sapi.app)
          .get(this.uri('/someMethodTest5'))
          .expect('Content-Type', /json/)
          .expect('Content-Length', '42')
          .expect('{"someMethodTest5":"testRouterGet worked"}')
          .expect(200)
          .end(function(err, res) {
            (err)
              ? done.fail(err)
              : done();
            return;
          });
      })
      .catch(done.fail);
  });

  describe('takes an @Model class in IRoutableOptions', function() {

    class Contact {
      @Db()
      @Json()
      phone = '000-000-0000';
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
        .listen()
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

      it('if provided an exposeApi option that is not an array', function() {
        expect(() => {
          @Routable(sapi, {
            exposeApi: (1 as any),
            model: User
          })
          class FailRoutableExposeApiOptionTest {
          }
        }).toThrow(new Error(`If @Routable 'FailRoutableExposeApiOptionTest' defines an 'exposeApi' option, that option`
          + ` must be an array of valid strings`));
      });

      it('if provided a suppressApi option that is not an array', function() {
        expect(() => {
          @Routable(sapi, {
            model: User,
            suppressApi: (1 as any)
          })
          class FailRoutableSuppressApiOptionTest {
          }
        }).toThrow(new Error(`If @Routable 'FailRoutableSuppressApiOptionTest' defines a 'suppressApi' option, that`
          + ` option must be an array of valid strings`));
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

    describe('generates routes', function() {
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
          .end((err) => err ? done.fail(err) : done());
      });
    });

    describe('GET ./model', function() {

      beforeEach(function(done) {
        User
          .removeAll({})
          .then(() => {
            const user1 = new User();
            const user2 = new User();
            user1.contact.phone = '111-111-1111';
            user2.firstName = 'Martha';

            const wait = [];
            wait.push(user1.create());
            wait.push(user2.create());

            Promise
              .all(wait)
              .then(() => {
                this.user1 = user1;
                this.user2 = user2;
                done();
              })
              .catch(done.fail);
          })
          .catch(done.fail);
      });

      it('returns all documents with all fields properly mapped by @Json', function(done) {
        request(sapi.app)
          .get(this.uri('/user'))
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBe(2);
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

        xit('does not allow for NoSQL injection', function() {

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

        xit('returns results with excluded fields', function(done) {
          const fields = {
            ln: 0
          };

          request(sapi.app)
            .get(this.uri(`/user?fields=${JSON.stringify(fields)}`))
            .expect(200)
            .then((res) => {
              expect(res.body.length).toBe(2);
              expect(res.body[0].ln).toBeUndefined();
              expect(res.body[1].ln).toBeUndefined();
            })
            .then(done)
            .catch(done.fail);
        });

      });
    });
  });
});
