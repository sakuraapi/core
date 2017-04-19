import * as path from 'path';

import {sapi} from './sakuraapi';

beforeEach(function() {
  this.baseUri = sapi.baseUri;
  this.uri = (endpoint: string) => {
    return path.join(this.baseUri, endpoint);
  };

  this.mongoDbBaseUri = `mongodb://localhost:${sapi.config.TEST_MONGO_DB_PORT}`;
});
