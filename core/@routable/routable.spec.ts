import * as express from 'express';
import * as request from 'supertest';
import {SakuraApi} from '../sakura-api';
import {
  Routable,
  routableSymbols,
  Route
} from './routable';

import method = require('lodash/method');
import before = require('lodash/before');

describe('core/Routable', function() {

  beforeEach(function() {
    this.t = new Test(777);
    this.sakuraApiClassRoutes = this.t[routableSymbols.sakuraApiClassRoutes];

    spyOn(console, 'log');
  });

  describe('Routable(...)', function() {

    describe('options', function() {
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
        const t2 = new Test2();
        expect(t2[routableSymbols.sakuraApiClassRoutes][0].path).toBe('/');
        expect(t2[routableSymbols.sakuraApiClassRoutes][1].path).toBe('/someOtherMethodTest2');
      });

      it('suppress autoRouting if options.autoRoute = false', function(done) {

        @Routable({
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

        SakuraApi
          .instance
          .listen()
          .then(function() {
            request(SakuraApi.instance.app)
              .get('/autoRoutingFalseTest')
              .expect(404)
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }
                SakuraApi
                  .instance
                  .close()
                  .then(done)
                  .catch(done.fail);
              });
          });
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

    it('property binds the instantiated class as the context of this for each route method', function() {
      const c = new Test4();

      expect(c.someMethodTest4()).toBe(c.someProperty);
      expect(c[routableSymbols.sakuraApiClassRoutes][0].f()).toBe(c.someProperty);
    });

    it('automatically instantiates its class and adds it to SakuraApi.instance.route(...)', function(done) {
      SakuraApi
        .instance
        .listen()
        .then(() => {
          request(SakuraApi.instance.app)
            .get(this.uri('/someMethodTest5'))
            .expect('Content-Type', /json/)
            .expect('Content-Length', '42')
            .expect('{"someMethodTest5":"testRouterGet worked"}')
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done.fail(err);
              }
              done();
            });
        })
        .catch(done.fail);
    });

  });

  describe('route(...)', function() {

    it('gracefully handles an empty @Route(...), defaults path to baseUri/', function() {
      // if these expectations pass, the blackList was properly defaulted to false since
      // the route wouldn't be in sakuraApiClassRoutes if blackList had been true.
      expect(this.sakuraApiClassRoutes.length).toBe(4);
      expect(this.sakuraApiClassRoutes[3].path).toBe('/test');
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
        @Routable()
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
      const t3 = new Test3();
      expect(t3[routableSymbols.sakuraApiClassRoutes].length).toBe(0);
    });

    describe('handles route parameters', function() {

      afterEach(function(done) {
        SakuraApi
          .instance
          .close()
          .then(function() {
            done();
          })
          .catch((err) => {
            done.fail(err);
          });
      });

      it('at the end of the path', function(done) {
        SakuraApi
          .instance
          .listen()
          .then(() => {
            request(SakuraApi.instance.app)
              .get(this.uri('/route/parameter/777'))
              .expect('Content-Type', /json/)
              .expect('Content-Length', '16')
              .expect('{"result":"777"}')
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }
                done();
              });
          });
      });

      it('at the end of the path', function(done) {
        SakuraApi
          .instance
          .listen()
          .then(() => {
            request(SakuraApi.instance.app)
              .get(this.uri('/route2/888/test'))
              .expect('Content-Type', /json/)
              .expect('Content-Length', '16')
              .expect('{"result":"888"}')
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done.fail(err);
                }
                done();
              });
          });
      });
    });
  });
});

@Routable({
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

@Routable()
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

@Routable()
class Test3 {
  @Route({blackList: true})
  blackListedMethod() {

  }
}

@Routable()
class Test4 {
  someProperty = 'instance';

  @Route()
  someMethodTest4() {
    return this.someProperty;
  }
}

@Routable()
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
