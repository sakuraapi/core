import {routable, route} from './routable';
import {SakuraApi}       from './sakura-api';
import * as express      from 'express';

fdescribe('core/routable', () => {
  it('does something', () => {
    let t = new Test();
    SakuraApi.instance.route(t);

    console.log(t['sakuraApiClassRoutes']);
  });
});

@routable({
  baseUrl: 'test'
})
class Test {
  constructor() {
  }

  @route({
    path: '/',
    method: 'get'
  })
  someMethod(req: express.Request, res: express.Response) {
    res.status(200).send({});
  }

  @route({
    path: 'someOtherMethod/',
    method: 'post'
  })
  someOtherMethod(req: express.Request, res: express.Response) {
    res.status(200).send({});
  }
}
