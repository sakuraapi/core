#!/usr/bin/env bash

set -ex

nodemon --config nodemon.typedoc.json -e ts --exec 'npm run docs:generate && npx http-server docs/ -- -a localhost -c-1'
