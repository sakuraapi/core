#!/usr/bin/env bash

set -ex

docPath="${1:-docs/}"

rm -rf ${docPath}
mkdir -p ${docPath}

npx typedoc \
    --exclude "**/**/*+(spec|index).ts" \
    --excludeExternals \
    --excludePrivate \
    --mode modules \
    --name "SakuraApi" \
    --out "${docPath}" \
    --readme doc.md \
    --target ES6 \
    --tsconfig tsconfig.json \
    src/**/**

touch "${docPath}/.nojekyll"
cp favicon.ico "${docPath}" || true
