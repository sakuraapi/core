#!/usr/bin/env bash

npm run build
npx tslint -t stylish -c tslint.json -p tsconfig.json
