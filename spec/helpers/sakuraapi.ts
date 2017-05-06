import {SakuraApi} from '../../core/sakura-api';

import bodyParser = require('body-parser');
import helmet = require('helmet');

export const sapi = new SakuraApi();
sapi.baseUri = '/testApi';

sapi.addMiddleware(helmet());
sapi.addMiddleware(bodyParser.json());
