#!/usr/bin/env bash

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. ${DIR}/_functions.sh

updateStart

update "starting tslint"
npx tslint -t stylish -c tslint.json -p tsconfig.json

updateDone
