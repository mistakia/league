#!/usr/bin/env bash
#
# Ensure a Postgres is serving on the test port, starting the compose service
# only when one is not already there.
#
# WHY THIS EXISTS
#
# `docker compose -f compose.test.yaml up -d --wait` was the only way to satisfy
# `yarn test:db:up`, which made docker a hard requirement for running the suite
# at all. Inside base-container there is no docker binary and no socket, so every
# league session that landed in a container rediscovered that the suite could not
# run -- while :5433 was reachable the whole time, because the container shares
# the host's network namespace and the suite talks plain TCP.
#
# So the check is on the thing that actually matters -- is something serving on
# the port -- and docker is only consulted when nothing is. A host with docker
# behaves exactly as before on a cold start; a container with a live :5433 gets
# on with it; and a container with a dead :5433 gets an error that names the one
# command that fixes it instead of `docker: not found`.

set -euo pipefail

DB_HOST="${LEAGUE_TEST_DB_HOST:-127.0.0.1}"
DB_PORT="${LEAGUE_TEST_DB_PORT:-5433}"

port_is_serving() {
  # A bare TCP connect, not pg_isready: this has to work where no postgres
  # client binary is installed, which is the whole point of the script.
  timeout 3 bash -c "exec 3<>/dev/tcp/${DB_HOST}/${DB_PORT}" 2>/dev/null
}

if port_is_serving; then
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<EOF
test:db:up: nothing is serving ${DB_HOST}:${DB_PORT} and there is no docker here.

This is expected inside base-container, which has no docker socket by design.
league-test-pg runs on the HOST and the container reaches it over the shared
network namespace, so start it from a host shell:

    cd repository/active/league && docker compose -f compose.test.yaml up -d --wait

Then re-run this command. Nothing else in the suite needs docker.
EOF
  exit 1
fi

exec docker compose -f compose.test.yaml up -d --wait
