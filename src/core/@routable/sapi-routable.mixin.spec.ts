import {
  NextFunction,
  Request,
  Response
}                          from 'express';
import * as request        from 'supertest';
import {
  testSapi,
  testUrl
}                          from '../../../spec/helpers/sakuraapi';
import {SakuraApi}         from '../sakura-api';
import {Routable}          from './routable';
import {Route}             from './route';
import {SapiRoutableMixin} from './sapi-routable-mixin';

describe('SapiRoutableMixin', () => {
  it('allows inheritance', async (done) => {

    // Note: you cannot currently inherit handlers since `@Route` will have registered its route against
    // the baseUrl of its @Routable. This may not even be desirable behavior anyhow. What you can do,
    // is implement a new method in the derived class that's decorated with @Route, which calls the base handler.

    @Routable({
      baseUrl: 'baseApi'
    })
    class BaseApi extends SapiRoutableMixin() {

      @Route({
        method: 'get',
        path: '/'
      })
      getBaseHandler(req: Request, res: Response, next: NextFunction) {
        res.json({result: '1'});
        next();
      }

      someBaseMethod(): string {
        return '2';
      }
    }

    @Routable({
      baseUrl: 'derivedApi'
    })
    class DerivedApi extends SapiRoutableMixin(BaseApi) {
      @Route({
        method: 'get',
        path: '/'
      })
      getHandler(req: Request, res: Response, next: NextFunction) {
        res.json({result: this.someBaseMethod()});
        next();
      }

      @Route({
        method: 'get',
        path: '/base'
      })
      getHandlerFromBase(req: Request, res: Response, next: NextFunction) {
        (this.getBaseHandler as any)(...arguments);
      }

    }

    let sapi: SakuraApi;
    try {

      sapi = testSapi({
        routables: [
          BaseApi,
          DerivedApi
        ]
      });

      sapi.listen({bootMessage: ''});

      const result1 = await request(sapi.app)
        .get(testUrl('baseApi'))
        .expect(200);

      expect(result1.body.result).toBe('1');

      const result2 = await request(sapi.app)
        .get(testUrl('derivedApi'))
        .expect(200);

      expect(result2.body.result).toBe('2');

      const result3 = await request(sapi.app)
        .get(testUrl('derivedApi/base'))
        .expect(200);

      expect(result3.body.result).toBe('1');

      done();
    } catch (err) {
      done.fail(err);
    } finally {
      if (sapi) {
        sapi.close();
      }
    }

  });
});
