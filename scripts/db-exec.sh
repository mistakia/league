#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: yarn db:exec <path/to/file.sql>" >&2
  exit 2
fi

SQL_FILE="$1"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "db:exec: file not found: $SQL_FILE" >&2
  exit 2
fi

REMOTE_PATH="/tmp/db-exec.$(date +%s).$$.sql"

echo "db:exec: copying $SQL_FILE -> league:$REMOTE_PATH"
scp -q "$SQL_FILE" "league:$REMOTE_PATH"

echo "db:exec: executing on league_production (single transaction, ON_ERROR_STOP=1)"
ssh league "psql -U league_user -h localhost --dbname=league_production --single-transaction --set ON_ERROR_STOP=1 -f $REMOTE_PATH; rc=\$?; rm -f $REMOTE_PATH; exit \$rc"

echo "db:exec: done"
