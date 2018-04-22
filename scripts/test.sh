#!/usr/bin/env bash

set -ex

TEST_TYPE=${1:-clearDb}

npm run docker:compose-test
npm run build
npx jasmine || ((say 'fail' || echo 'fail') ; exit 1)

if [ $TEST_TYPE != "saveDb" ]; then
  docker-compose down
fi
