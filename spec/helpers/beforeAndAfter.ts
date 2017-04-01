import * as path from 'path';
import {SakuraApi} from '../../core/sakura-api';

beforeEach(function() {
  this.baseUri = SakuraApi.instance.baseUri;
  this.sapi = SakuraApi.instance;

  this.uri = (endpoint: string) => {
    return path.join(this.baseUri, endpoint);
  };

  this.mongoDbBaseUri = `mongodb://localhost:${SakuraApi.instance.config.TEST_MONGO_DB_PORT}`;
});
