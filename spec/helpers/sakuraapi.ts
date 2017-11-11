import * as path from 'path';
import {SakuraApi, SakuraApiPlugin} from '../../core/sakura-api';
import bodyParser = require('body-parser');
import helmet = require('helmet');

const baseUri = '/testApi';

export const testUrl = (endpoint: string) => path.join(baseUri, endpoint);
export const testMongoDbUrl = (sapi) => `mongodb://localhost:${sapi.config.TEST_MONGO_DB_PORT}`;

export interface ITestSapiOptions {
  providers?: any[];
  models?: any[];
  routables?: any[];
  plugins?: SakuraApiPlugin[];
}

export function testSapi(options: ITestSapiOptions): SakuraApi {

  const sapi = new SakuraApi({
    baseUrl: baseUri,
    configPath: 'spec/config/environment.json',
    providers: options.providers,
    models: options.models,
    plugins: options.plugins,
    routables: options.routables
  });

  sapi.addMiddleware(helmet(), 0);
  sapi.addMiddleware(bodyParser.json(), 0);

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
