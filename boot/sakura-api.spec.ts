import {SakuraApi} from './sakura-api';
import * as request from 'supertest';
import * as express from 'express';

describe('SakuraApi', () => {

  let app;
  beforeEach(() => {
    app = express();
    spyOn(app, 'listen').and.callFake((port, cb) => {
      cb();
    });

    spyOn(console, 'log');
  });

  it('port property defaults to a valid integer > 1000', () => {
    let sapi = new SakuraApi(app);
    expect(sapi.port).toBeDefined();
    expect(typeof  sapi.port).toBe('number');
    expect(sapi.port).toBeGreaterThanOrEqual(1000);
  });

  it('app property exposes the Express app object used for construction', () => {
    let sapi = new SakuraApi(app);
    expect(sapi.app).toBeDefined();
    expect(sapi.app).toEqual(app);
  });

  describe('listen(...)', () => {
    it('bootstraps Express with defaulting settings when no parameters are provided', (done) => {
      let sapi = new SakuraApi(app);

      sapi
        .listen()
        .then(() => {
          expect(app.listen).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledTimes(1);
          expect(sapi.port).toBeDefined();
          expect(typeof sapi.port).toEqual('number');
          expect(sapi.port).toBeGreaterThanOrEqual(1000);
          done();
        })
        .catch((err) => {
          expect(err).toBeUndefined();
          done();
        });
    });

    it('sets the express app port, when provided', (done) => {
      let sapi = new SakuraApi(app);
      sapi
        .listen(9000)
        .then(() => {
          expect(sapi.port).toEqual(9000);
          done();
        })
        .catch(done.fail);
    });

    it('calls the provided next function parameter when provided', (done) => {
      let sapi = new SakuraApi(app);

      let next = () => {
        return Promise.resolve();
      };
      next = jasmine.createSpy('testSpy', next).and.callThrough();

      sapi
        .listen(9000, next)
        .then(() => {
          expect(next).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledTimes(0);
          done()
        })
        .catch(done.fail)
    });

    it('uses the provided next string parameter when provided to notify the server is listening', (done) => {
      let sapi = new SakuraApi(app);

      sapi
        .listen(9000, 'custom boot message')
        .then(() => {
          expect(app.listen).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledTimes(1);
          done();
        })
        .catch(done.fail);
    });
  });
});
