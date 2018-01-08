#!/usr/bin/env bash

set -ex

rm -rf lib/
npx tsc
rsync -r --exclude=*.ts spec/ lib/spec
