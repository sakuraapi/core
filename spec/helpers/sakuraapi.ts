import * as path from 'path';
import {SakuraApi} from '../../core/sakura-api';

import bodyParser = require('body-parser');
import helmet = require('helmet');

export const baseUri = '/testApi';
export const testUrl = (endpoint: string) => path.join(baseUri, endpoint);
export const testMongoDbUrl = (sapi) => `mongodb://localhost:${sapi.config.TEST_MONGO_DB_PORT}`;

export function testSapi(options: { models: any[], routables: any[] }): SakuraApi {

  const sapi = new SakuraApi({
    configPath: 'spec/config/environment.json',
    models: options.models,
    routables: options.routables
  });

  sapi.baseUri = baseUri;

  sapi.addMiddleware(helmet());
  sapi.addMiddleware(bodyParser.json());

  if (process.env.TRACE_REQ) {
    sapi.addMiddleware((req, res, next) => {
      // tslint:disable:no-console
      console.log(`REQUEST: ${req.method}: ${req.url}`.blue);
      // tslint:enable:no-console
      next();
    });
  }

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
