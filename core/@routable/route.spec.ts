import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import * as request from 'supertest';
import {testSapi, testUrl} from '../../spec/helpers/sakuraapi';
import {Db, Json, Model, SakuraApiModel} from '../@model';
import {IRoutableLocals, Routable, routableSymbols, Route} from './';

import method = require('lodash/method');
import before = require('lodash/before');

describe('core/Route', () => {
  @Routable({
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
      // lint empty
    }
  }

  beforeEach(() => {
    this.t = new TestCoreRoute(777);
    this.routes = this.t[routableSymbols.routes];
  });

  it('gracefully handles an empty @Route(...), defaults path to baseUri/', () => {
    // if these expectations pass, the blackList was properly defaulted to false since
    // the route wouldn't be in sakuraApiClassRoutes if blackList had been true.
    expect(this.routes.length).toBe(4);
    expect(this.routes[3].path).toBe('/testCoreRoute');
    expect(this.routes[3].httpMethod).toBe('get');
    expect(this.routes[3].method).toBe('emptyRouteDecorator');
  });

  it('maintains the original functionality of the method', () => {
    const returnValue = this.routes[2].f();
    expect(returnValue).toBe('it works');
  });

  it('throws an exception when an invalid HTTP method is specificed', () => {
    let err;
    try {
      @Routable()
      class X {
        @Route({method: 'imnotarealhttpmethod'})
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
        .expect(200)
        .then(done)
        .catch(done.fail);
    });

    it('at the end of the path', (done) => {
      request(sapi.app)
        .get(testUrl('/handlesRouteParamtersTest/route2/888/test'))
        .expect('Content-Type', /json/)
        .expect('Content-Length', '16')
        .expect('{"result":"888"}')
        .expect(200)
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
        .expect(200)
        .then((result) => {
          expect(result.body.order).toBe('1b2b');
        })
        .then(done)
        .catch(done.fail);
    });

    it('does not run before handlers without before route handlers', (done) => {
      request(sapi.app)
        .get(testUrl(`/BeforeHandlerTests/test2Handler`))
        .expect(200)
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
    class AfterHandlerTestModel extends SakuraApiModel {
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

    const sapi = testSapi({
      models: [AfterHandlerTestModel],
      routables: [AfterHandlerTests]
    });

    beforeEach((done) => {
      sapi
        .listen()
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

    it('does not run after handler after other handlers', (done) => {
      request(sapi.app)
        .get(testUrl('/AfterHandlerTests/test2Handler'))
        .expect(200)
        .then((result) => {
          expect(result.body.order).toBeUndefined();
        })
        .then(done)
        .catch(done.fail);
    });
  });
});
