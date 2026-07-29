#!/usr/bin/env bash
set -euo pipefail

# Apply a SQL file to league_production in a single transaction.
#
# For files under db/adhoc/ this also OWNS THE STATUS BANNER. Three adhoc headers
# advertised applied work as pending until 2026-07-27, one of them a
# non-idempotent two-DROP-COLUMN file -- so the audit trail said "safe to run"
# about a file that would have failed, or worse, half-succeeded on a second run.
# Documenting "remember to update the header" is what produced those three, so the
# banner is machine-owned here instead:
#
#   - a db/adhoc file must carry a `-- STATUS: PENDING` line to be applied at all
#   - a file already marked APPLIED is REFUSED (this is the non-idempotent guard;
#     override with --reapply when the file is genuinely idempotent and you mean it)
#   - on success the banner is rewritten in place to APPLIED with the date, before
#     the script exits, so there is no window in which the apply has happened and
#     the file still says pending
#
# The remaining human step is committing the rewritten file, which the script
# prints as a ready-to-paste command with an explicit pathspec.
#
# usage: yarn db:exec <path/to/file.sql> [--reapply]

REAPPLY=0
SQL_FILE=""

for arg in "$@"; do
  case "$arg" in
    --reapply) REAPPLY=1 ;;
    -*)
      echo "db:exec: unknown option: $arg" >&2
      exit 2
      ;;
    *)
      if [[ -n "$SQL_FILE" ]]; then
        echo "db:exec: only one SQL file may be given" >&2
        exit 2
      fi
      SQL_FILE="$arg"
      ;;
  esac
done

if [[ -z "$SQL_FILE" ]]; then
  echo "usage: yarn db:exec <path/to/file.sql> [--reapply]" >&2
  exit 2
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "db:exec: file not found: $SQL_FILE" >&2
  exit 2
fi

# Status-banner discipline applies to the append-only adhoc history, not to
# ad-hoc one-off paths a caller may pass.
IS_ADHOC=0
case "$SQL_FILE" in
  *db/adhoc/*) IS_ADHOC=1 ;;
esac

if [[ $IS_ADHOC -eq 1 ]]; then
  if grep -qE '^-- STATUS: APPLIED' "$SQL_FILE"; then
    if [[ $REAPPLY -eq 0 ]]; then
      echo "db:exec: REFUSING -- $SQL_FILE is already marked APPLIED." >&2
      echo "db:exec: re-running an applied file is how a non-idempotent migration" >&2
      echo "db:exec: (two DROP COLUMNs, a backfill without a guard) corrupts state." >&2
      echo "db:exec: if this file really is idempotent and you mean to re-run it," >&2
      echo "db:exec: pass --reapply." >&2
      exit 3
    fi
    echo "db:exec: file is marked APPLIED; proceeding under --reapply"
  elif ! grep -qE '^-- STATUS: PENDING' "$SQL_FILE"; then
    echo "db:exec: REFUSING -- $SQL_FILE carries no machine-readable status banner." >&2
    echo "db:exec: add this line to the header before applying:" >&2
    echo >&2
    echo "    -- STATUS: PENDING" >&2
    echo >&2
    echo "db:exec: it is rewritten to APPLIED automatically once the apply succeeds," >&2
    echo "db:exec: which is what keeps the audit trail from lying about what has run." >&2
    exit 3
  fi
fi

REMOTE_PATH="/tmp/db-exec.$(date +%s).$$.sql"

echo "db:exec: copying $SQL_FILE -> league:$REMOTE_PATH"
scp -q "$SQL_FILE" "league:$REMOTE_PATH"

echo "db:exec: executing on league_production (single transaction, ON_ERROR_STOP=1)"
ssh league "psql -U league_writer -h localhost --dbname=league_production --single-transaction --set ON_ERROR_STOP=1 -f $REMOTE_PATH; rc=\$?; rm -f $REMOTE_PATH; exit \$rc"

# Only reached when psql exited 0: `set -e` plus ON_ERROR_STOP means a failed
# apply never rewrites the banner, so a PENDING file that stays PENDING is an
# accurate record of a migration that did not land.
if [[ $IS_ADHOC -eq 1 ]]; then
  APPLIED_LINE="-- STATUS: APPLIED $(date -u +%Y-%m-%d) against league_production"
  if grep -qE '^-- STATUS: PENDING' "$SQL_FILE"; then
    tmp_file="$(mktemp)"
    # Rewrite only the banner line; every other byte of the header is the
    # author's audit trail and must survive verbatim.
    awk -v replacement="$APPLIED_LINE" \
      '!done && /^-- STATUS: PENDING/ { print replacement; done = 1; next } { print }' \
      "$SQL_FILE" > "$tmp_file"
    mv "$tmp_file" "$SQL_FILE"
    echo "db:exec: banner rewritten -> $APPLIED_LINE"
    echo
    echo "db:exec: commit the rewritten header in the SAME commit as the apply:"
    echo
    echo "    git add -- $SQL_FILE"
    echo "    git commit -m '<message>' -- $SQL_FILE"
    echo
  fi
fi

echo "db:exec: done"
