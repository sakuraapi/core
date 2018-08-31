#!/usr/bin/env bash

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. ${DIR}/_functions.sh

updateStart

update "removing lib"
rm -rf lib/

update "compiling typescript"
npx tsc

update "syncing assets"
rsync -r --exclude=*.ts spec/ lib/spec

update "saving version"
saveVersion
