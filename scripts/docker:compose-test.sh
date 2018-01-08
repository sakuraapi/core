#!/usr/bin/env bash

set -ex
docker volume prune -f || echo \"skipped docker volume prune\"
docker-compose up -d --remove-orphans
