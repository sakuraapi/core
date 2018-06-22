#!/usr/bin/env bash

set -ex

docPath="${1:-docs/}"

rm -rf ${docPath}
mkdir -p ${docPath}

npx typedoc \
    --exclude "**/**/*+(spec|index).ts" \
    --excludeExternals \
    --excludePrivate \
    --mode file \
    --name "SakuraApi" \
    --out "${docPath}" \
    --readme doc.md \
    --target ES6 \
    --tsconfig tsconfig.json \
    src/**/**
