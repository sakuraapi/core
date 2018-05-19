#!/usr/bin/env bash

set -e

dirty=$(git status --porcelain | wc -l)
branch=$(git branch | grep \* | cut -d ' ' -f2)

if [ dirty != 0 ]; then
  git status

  read -p "Your repo is dirty, are you sure you want to continue? (y/[n])" -n 1 -r
  echo
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
      exit 0
  fi
fi

output=${1:-../docs-core}

if [ dirty -eq 0 ]; then
  git checkout develop
fi
scripts/docs:generate.sh "${output}/develop"


if [ dirty -eq 0 ]; then
  git checkout master
fi
scripts/docs:generate.sh "${output}/master"

git checkout ${branch}
