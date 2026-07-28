#!/bin/bash
#
# Export the production schema to db/schema.postgres.sql.
#
# USE A UNIQUE REMOTE PATH. This script used to dump to a fixed
# /root/schema.postgres.sql on the league host and scp that back. The league
# host is shared by every session, and `yarn export:schema` is run by whoever
# is landing a schema change, so two sessions exporting at once had both
# pg_dumps writing the same path while one of them scp'd it. On 2026-07-28
# that produced a locally-inconsistent dump: 83 GRANT SELECT lines for
# league_reader were missing from the middle of the file even though all 276
# were live in production, and committing it would have recorded those grants
# as revoked. It was caught only because the diff was reviewed line by line.
# mktemp makes the collision impossible rather than unlikely.
#
# The completeness check below is defense in depth, NOT the fix for that
# incident -- interleaved writers can still leave a valid trailer, so it would
# not reliably have caught it. It catches the simpler failure: a dump truncated
# by a dropped connection or a full disk.
#
# Always read the resulting diff. A schema export rewrites the whole file, so
# it silently carries any drift that is not yours.

set -euo pipefail

SSH_HOST="league"
DB_NAME="league_production"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${SCRIPT_DIR}/../db/schema.postgres.sql"
RAW="$(mktemp "${TMPDIR:-/tmp}/league-schema.XXXXXX")"
trap 'rm -f "$RAW"' EXIT

ssh "$SSH_HOST" '
    set -eu
    remote_file="$(mktemp /tmp/league-schema.XXXXXX)"
    trap "rm -f \"$remote_file\"" EXIT
    pg_dump -U league_writer -h localhost --dbname='"$DB_NAME"' \
        --schema-only --clean --no-owner --if-exists --no-tablespaces \
        --file="$remote_file"
    cat "$remote_file"
' > "$RAW"

if ! grep -q '^-- PostgreSQL database dump complete' "$RAW"; then
    echo "export-schema: dump is missing its completion marker; refusing to overwrite ${OUT}" >&2
    exit 1
fi

# Insert the search_path the dump itself clears (it sets search_path='' at line
# 15), and drop the \restrict / \unrestrict wrappers pg16 emits, which psql
# outside an interactive session cannot parse.
awk 'NR==17{print "SET search_path = public;"} !/^\\(un)?restrict /{print}' \
    "$RAW" > "${OUT}.tmp"
mv "${OUT}.tmp" "$OUT"

echo "export-schema: wrote ${OUT} ($(wc -l < "$OUT" | tr -d ' ') lines)"
