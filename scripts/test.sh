#!/usr/bin/env bash

set -e

TEST_TYPE=${1:-"clearDb"}

COMPOSE_FILE="./docker-compose.yml"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. ${DIR}/_functions.sh

updateStart

npm run build test

if [ "$1" == "webstorm-debug" ]; then

  update "starting MongoDB"
  down
  compose up -d

else

  update "starting MongoDB"
  if [ "$1" != "saveDb" ]; then
    trap down EXIT
  fi
  compose up -d

  update "starting jasmine"
  npx jasmine

fi

updateDone
