import {SakuraApi} from '../../core/sakura-api';
import * as path   from 'path';

beforeEach(function () {
  this.baseUri = SakuraApi.instance.baseUri;
  this.sapi = SakuraApi.instance;

  this.uri = (endpoint: string) => {
    return path.join(this.baseUri, endpoint);
  };
  
});
