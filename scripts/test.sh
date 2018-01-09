#!/usr/bin/env bash

set -ex

TEST_TYPE=${1:-clearDb}

npm run docker:compose-test
npm run build
((npx jasmine && npm run say:pass) || npm run say:fail)

if [ $TEST_TYPE != "saveDb" ]; then
  docker-compose down
fi
