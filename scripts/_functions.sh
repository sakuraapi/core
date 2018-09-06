#!/usr/bin/env bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename ${PROJECT_DIR})"

function compose {
  docker-compose --project-name ${PROJECT_NAME} --file ${COMPOSE_FILE} $@
}

function down {
  compose down --remove-orphans
  docker volume prune -f || echo "skipped docker volume prune"
}

function pull {
  local services
  local remoteServices
  services=$(compose config --services)
  remoteServices=""
  for service in ${services[@]}; do
    if [[ ${service} != local-* ]]; then
      remoteServices+=" $service"
    fi
  done

  compose pull --parallel ${remoteServices}
}


function saveVersion {
  cat package.json \
    | grep version \
    | head -1 \
    | awk -F: '{ print $2 }' \
    | sed 's/[",]//g' \
    | tr -d '[[:space:]]' > ./lib/version
}

function updateStart {
  echo
  echo "🚀  starting $0"
}

function update {
  echo "✔  $1"
}

function updateDone {
  echo "☘  $0 done"
  echo
}
