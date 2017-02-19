import {
  Route,
  Routable
} from '../../core/@routable/routable';
import {SakuraApi} from '../../core/sakura-api';
import * as request from 'supertest';

// These tests have to happen before anything else happens
describe('SakuraApi.instance.middleware', function () {
  @Routable({
    baseUrl: 'middleware'
  })
  class MiddleWareTest {

    constructor() {
    }

    @Route({
      path: 'test',
      method: 'get'
    })
    test(req, res) {
      res
        .status(200)
        .json({result: req.bootStrapTest});
    }
  }

  beforeEach(function () {
    spyOn(console, 'log');
  });

  afterEach(function (done) {
    this
      .sapi
      .close()
      .then(done)
      .catch(done.fail);
  });

  it('injects middleware before @Routable classes', function (done) {
    this.sapi.addMiddleware((req, res, next) => {
      (<any>req).bootStrapTest = 778;
      next();
    });

    this
      .sapi
      .listen()
      .then(() => {
        request(SakuraApi.instance.app)
          .get(this.uri('/middleware/test'))
          .expect('Content-Type', /json/)
          .expect('Content-Length', '14')
          .expect('{"result":778}')
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done.fail(err);
            }
            done();
          });
      })
      .catch(done.fail);
  });
});


