import * as express from 'express';
import {
  NextFunction,
  Request,
  Response
} from 'express';
import * as request from 'supertest';
import {
  Db,
  Json,
  Model,
  SakuraApiModel
} from '../@model';
import {
  IRoutableLocals,
  Routable,
  routableSymbols,
  Route
} from './';

import {Sapi} from '../../spec/helpers/sakuraapi';

import method = require('lodash/method');
import before = require('lodash/before');

describe('core/Route', function() {
  const sapi = Sapi();

  @Routable(sapi, {
    autoRoute: false,
    baseUrl: 'testCoreRoute',
    blackList: ['someBlacklistedMethod']
  })
  class TestCoreRoute {

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
    this.t = new TestCoreRoute(777);
    this.sakuraApiClassRoutes = this.t[routableSymbols.sakuraApiClassRoutes];
  });

  it('gracefully handles an empty @Route(...), defaults path to baseUri/', function() {
    // if these expectations pass, the blackList was properly defaulted to false since
    // the route wouldn't be in sakuraApiClassRoutes if blackList had been true.
    expect(this.sakuraApiClassRoutes.length).toBe(4);
    expect(this.sakuraApiClassRoutes[3].path).toBe('/testCoreRoute');
    expect(this.sakuraApiClassRoutes[3].httpMethod).toBe('get');
    expect(this.sakuraApiClassRoutes[3].method).toBe('emptyRouteDecorator');
  });

  it('maintains the original functionality of the method', function() {
    const returnValue = this.sakuraApiClassRoutes[2].f();
    expect(returnValue).toBe('it works');
  });

  it('throws an exception when an invalid HTTP method is specificed', function() {
    let err;
    try {
      @Routable(sapi)
      class X {
        @Route({method: 'imnotarealhttpmethod'})
        badHttpMethod() {
        }
      }
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
  });

  it('excludes a method level blacklisted @Route', function() {
    @Routable(sapi)
    class Test3 {
      @Route({blackList: true})
      blackListedMethod() {

      }
    }

    const t3 = new Test3();
    expect(t3[routableSymbols.sakuraApiClassRoutes].length).toBe(0);
  });

  describe('handles route parameters', function() {

    @Routable(sapi, {
      baseUrl: 'handlesRouteParamtersTest'
    })
    class HandlesRouteParamtersTest {
      @Route({
        method: 'get',
        path: '/route/parameter/:id'
      })
      testA(req, res) {
        res
          .status(200)
          .json({result: req.params.id.toString()});
      }

      @Route({
        method: 'get',
        path: '/route2/:id/test'
      })
      testB(req, res) {
        res
          .status(200)
          .json({result: req.params.id.toString()});
      }
    }

    it('at the end of the path', function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => {
          request(sapi.app)
            .get(this.uri('/handlesRouteParamtersTest/route/parameter/777'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '16')
            .expect('{"result":"777"}')
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

    it('at the end of the path', function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => {
          request(sapi.app)
            .get(this.uri('/handlesRouteParamtersTest/route2/888/test'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '16')
            .expect('{"result":"888"}')
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
  });

  describe('before', function() {

    @Routable(sapi, {
      baseUrl: 'BeforeHandlerTests'
    })
    class BeforeHandlerTests {
      @Route({
        before: [(req, res, next) => {
          const reqLocals = res.locals as IRoutableLocals;
          reqLocals.send(200, {
            order: '1b'
          });
          next();
        }]
      })
      testHandler(req: Request, res: Response, next: NextFunction) {
        const reqLocals = res.locals as IRoutableLocals;
        reqLocals.send(200, {
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

    it('runs before handler before route handler', function(done) {
      request(sapi.app)
        .get(this.uri('/BeforeHandlerTests'))
        .expect(200)
        .then((result) => {
          expect(result.body.order).toBe('1b2b');
        })
        .then(done)
        .catch(done.fail);
    });

    it('does not run before handlers without before route handlers', function(done) {
      request(sapi.app)
        .get(this.uri(`/BeforeHandlerTests/test2Handler`))
        .expect(200)
        .then((result) => {
          expect(result.body.order).toBeUndefined();
        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('after', function() {
    @Model(sapi, {
      dbConfig: {
        collection: 'afterHandlerTestModel',
        db: 'userDb'
      }
    })
    class AfterHandlerTestModel extends SakuraApiModel {
      @Db() @Json()
      firstName = 'George';

      @Db() @Json()
      lastName = 'Washinton';
    }

    @Routable(sapi, {
      baseUrl: 'AfterHandlerTests'
    })
    class AfterHandlerTests {
      @Route({
        after: (req, res, next) => {
          AfterHandlerTestModel
            .getById(res.locals.data.id)
            .then((result) => {
              res.locals.send(200, {
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
            res.locals.send(200, {
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

    it('runs after handler after route handler', function(done) {
      request(sapi.app)
        .get(this.uri('/AfterHandlerTests'))
        .expect(200)
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

    it('does not run after handler after other handlers', function(done) {
      request(sapi.app)
        .get(this.uri('/AfterHandlerTests/test2Handler'))
        .expect(200)
        .then((result) => {
          expect(result.body.order).toBeUndefined();
        })
        .then(done)
        .catch(done.fail);
    });
  });

});
