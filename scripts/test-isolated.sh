#!/usr/bin/env bash
#
# Run the suite against a private database on the shared :5433 container.
#
# WHY THIS EXISTS
#
# `league-test-pg` is a singleton and `test/global.mjs` drops every table in
# whatever database it is pointed at, so two sessions running `yarn test:local`
# at once destroy each other's run. The failure is not clean -- a sibling's
# DROP/reload lands partway through yours and surfaces as a scatter of
# `relation "player" does not exist` across unrelated specs, which reads exactly
# like a regression in whatever you were editing. That has cost multiple
# sessions a wrong diagnosis.
#
# The cure was already documented (give your run its own database), but it was a
# recipe you had to hand-assemble from environment variables, so sessions kept
# reaching for `yarn test:local` and rediscovering the collision instead. This
# turns the recipe into the default path.
#
# Usage:
#   yarn test:isolated                        # whole suite
#   yarn test:isolated test/some.spec.mjs     # one spec, or any mocha args
#
# The database is named for the slug in LEAGUE_TEST_SLUG when set, otherwise for
# this shell's pid, and it is DROPPED on exit -- including on failure and on
# interrupt. That matters beyond tidiness: these databases are never reaped
# otherwise, and 85 of them holding 7.4 GB had accumulated by 2026-08-29.
#
# Keep the drop conditional on us having created it, so an interrupted run
# cannot delete a database that was already there and belongs to somebody else.

set -euo pipefail

DB_USER=league_test
DB_HOST="${LEAGUE_TEST_DB_HOST:-127.0.0.1}"
DB_PORT="${LEAGUE_TEST_DB_PORT:-5433}"
SLUG="${LEAGUE_TEST_SLUG:-$$}"
DB_NAME="league_test_${SLUG}"
created=0

# Admin statements go over TCP through `pg`, the same driver and the same port
# mocha uses below -- NOT `docker exec ... psql`, which needed a docker socket
# purely to borrow a psql client and so made the entire isolated runner
# unavailable inside base-container. Output is psql -tAc shaped; see the script.
psql_admin() {
  LEAGUE_TEST_DB_HOST="$DB_HOST" \
  LEAGUE_TEST_DB_PORT="$DB_PORT" \
  LEAGUE_TEST_DB_USER="$DB_USER" \
    node scripts/test-db-admin.mjs "$1"
}

cleanup() {
  local status=$?
  if [ "$created" -eq 1 ]; then
    # Terminate stragglers first: a pool connection that outlives mocha makes
    # DROP DATABASE fail with "is being accessed by other users", which would
    # leak exactly the database this script exists to reap.
    psql_admin "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
    psql_admin "DROP DATABASE IF EXISTS \"${DB_NAME}\"" >/dev/null 2>&1 \
      || echo "warning: could not drop ${DB_NAME}; drop it by hand" >&2
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

# The container has to be up before the CREATE, not merely before mocha.
yarn test:db:up

# CREATE and CONFIRM it returned BEFORE mocha starts. Pointing LEAGUE_DB_DATABASE
# at a database that does not exist yet does not fail -- the pool retries and the
# run hangs forever with no output, which has burned an hour before now.
psql_admin "CREATE DATABASE \"${DB_NAME}\" OWNER ${DB_USER}" >/dev/null
if [ "$(psql_admin "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")" != "1" ]; then
  echo "error: ${DB_NAME} was not created; refusing to start mocha" >&2
  exit 1
fi
created=1

# Stamp it disposable. db/guard-destructive-target.mjs refuses to drop tables in
# a database that has not said this about itself, and this script is the only
# thing that knows the per-run name. Done HERE, by the provisioner, and never by
# the suite: a target that stamps itself on the way to being dropped proves
# nothing. Keep the string identical to DISPOSABLE_DATABASE_MARKER in the guard.
psql_admin "COMMENT ON DATABASE \"${DB_NAME}\" IS 'league:disposable-test-database'" >/dev/null
if [ -z "$(psql_admin "SELECT 1 FROM pg_database d
            WHERE d.datname = '${DB_NAME}'
              AND shobj_description(d.oid, 'pg_database') = 'league:disposable-test-database'")" ]; then
  echo "error: ${DB_NAME} was not stamped disposable; refusing to start mocha" >&2
  exit 1
fi

echo "test database: ${DB_NAME}"

# Arguments mean a SPEC SUBSET, so declare it. The response-validation teardown
# reports a hold-out entry stale when the run produced its (operation, status)
# and the response validated -- an inference that only holds for a full run,
# because one pair can have several response shapes and a subset exercising only
# the conformant one reports a LIVE entry as stale. Following that report deletes
# an entry the full suite still needs and turns master red. Declared here rather
# than sniffed inside the suite, so the flag tracks the invocation that knows.
#
# The other half of the artifact -- a subset that issues no HTTP at all being
# failed for observing zero pairs -- is handled in the guard itself, on whether
# any request was served, so it holds for a bare `mocha` invocation too.
#
# Matched against what NARROWS the run, not against "any argument was passed".
# The earlier form tested `$# -gt 0`, which reads `--reporter dot` or `--bail`
# on a FULL run as a subset and suppresses both checks -- including the
# blindness check, the one the whole mechanism exists for. Nor can this be a
# blanket "any non-flag argument", because that is exactly what a separated
# flag value like the `dot` in `--reporter dot` looks like. So the two things
# that genuinely narrow a run are named: a spec path, and a grep.
declares_subset=0
for arg in "$@"; do
  case "$arg" in
    *.spec.mjs | test/* | private/test/*) declares_subset=1 ;;
    -g | --grep | --grep=* | --fgrep | --fgrep=*) declares_subset=1 ;;
  esac
done

if [ "$declares_subset" -eq 1 ]; then
  export LEAGUE_SUITE_SUBSET=1
fi

# `yarn test` blanks LEAGUE_DB_HOST/PORT, so invoke mocha directly. Loading the
# rc (no --no-config) keeps local collection identical to CI's.
LEAGUE_DB_HOST="$DB_HOST" \
LEAGUE_DB_PORT="$DB_PORT" \
LEAGUE_DB_DATABASE="$DB_NAME" \
TZ=America/New_York \
NODE_ENV=test \
TEST=all \
  node_modules/.bin/mocha --exit --require test/global.mjs "$@"
