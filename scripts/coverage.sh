#!/usr/bin/env bash

set -e

COMPOSE_FILE="./docker-compose.yml"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. ${DIR}/_functions.sh

updateStart

update "starting mongodb"
trap down EXIT
compose up -d

npm run build test

update "starting istanbul"
npx istanbul cover --include-all-sources node_modules/jasmine/bin/jasmine.js

update "opening report"
(open coverage/lcov-report/index.html || echo '')

updateDone
