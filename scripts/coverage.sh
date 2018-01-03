#!/usr/bin/env bash

set -ex
npm run docker:compose-test
npm run build
npx istanbul cover --include-all-sources node_modules/jasmine/bin/jasmine.js
docker-compose down
(open coverage/lcov-report/index.html || echo '')
