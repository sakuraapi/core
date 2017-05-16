import {SakuraApi} from '../../core/sakura-api';

import bodyParser = require('body-parser');
import helmet = require('helmet');

export const baseUri = '/testApi';

export function Sapi(): SakuraApi {
  const sapi = new SakuraApi();
  sapi.baseUri = baseUri;

  sapi.addMiddleware(helmet());

  sapi.addMiddleware(bodyParser.json());

  sapi.addLastErrorHandlers((err, req, res, next) => {

    // tslint:disable:no-console
    console.log('------------------------------------------------'.red);
    console.log('↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓'.zebra);
    console.log('An error bubbled up in an unexpected way during testing');
    console.log(err);
    console.log('↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑'.zebra);
    console.log('------------------------------------------------'.red);
    // tslint:enable:no-console

    next(err);
  });

  return sapi;
}
