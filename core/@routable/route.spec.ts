import * as express from 'express';
import * as request from 'supertest';
import {
  Routable,
  routableSymbols,
  Route
} from './';

import {sapi} from '../../spec/helpers/sakuraapi';

import method = require('lodash/method');
import before = require('lodash/before');

describe('core/Route', function() {

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
  });

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

    afterEach(function(done) {
      sapi
        .close()
        .then(done)
        .catch(done.fail);
    });

    it('at the end of the path', function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => {
          request(sapi.app)
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
        })
        .catch(done.fail);
    });

    it('at the end of the path', function(done) {
      sapi
        .listen({bootMessage: ''})
        .then(() => {
          request(sapi.app)
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
        })
        .catch(done.fail);
    });
  });
});
