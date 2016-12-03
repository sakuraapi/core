import {
  Route,
  Routable
}                   from '../../core/routable';
import {SakuraApi}  from '../../core/sakura-api';

import * as request from 'supertest';

describe('SakuraApi.instance.middleware', () => {

  afterEach((done) => {
    SakuraApi
      .instance
      .close()
      .then(done)
      .catch(done.fail)
  });

  it('injects middleware before @Routable classes', (done) => {
    SakuraApi.addMiddleware((req, res, next) => {
      (<any>req).bootStrapTest = 778;
      next();
    });

    SakuraApi
      .instance
      .listen()
      .then(() => {
        request(SakuraApi.instance.app)
          .get('/middleware/test')
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
