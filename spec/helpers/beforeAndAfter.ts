import * as path from 'path';

import {baseUri} from './sakuraapi';

beforeEach(function() {
  this.baseUri = baseUri;
  this.uri = (endpoint: string) => {
    return path.join(this.baseUri, endpoint);
  };

  this.mongoDbBaseUri = (sapi) => `mongodb://localhost:${sapi.config.TEST_MONGO_DB_PORT}`;
});
