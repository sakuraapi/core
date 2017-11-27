#!/usr/bin/env bash

set -ex
rm -rf docs
mkdir -p docs
npx typedoc \
    --exclude "**/**/*+(spec|index).ts" \
    --excludeExternals \
    --excludePrivate \
    --mode modules \
    --name "SakuraApi" \
    --out docs/ src/**/** \
    --readme doc.md \
    --target ES6 \
    --tsconfig tsconfig.json \
    src/**/**

touch docs/.nojekyll
