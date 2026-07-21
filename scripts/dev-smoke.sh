#!/usr/bin/env bash
#
# Browser smoke for a working-tree change that touches BOTH the API response
# shape and the SPA that reads it (e.g. a player-column rename), where the edit
# is not yet deployed.
#
# `yarn dev:live` cannot verify these: it points the production-mode frontend at
# the LIVE xo.football API, which serves only what is already deployed, so the
# frontend reads fields the un-deployed API does not emit yet and renders them
# blank -- a false negative. This runs a LOCAL API (working-tree backend) that
# the dev frontend talks to (IS_DEV routes the SPA to the local API on :8082),
# over an SSH tunnel to the PRODUCTION database opened READ-ONLY. You get real
# players / rosters / draft / trades and your real login, while every write is
# refused at the database (default_transaction_read_only), so production is
# untouchable. Open confirmation dialogs to verify rendering; a submit will
# (safely) fail against the read-only session.
#
# This is the develop-league guideline's sanctioned `yarn dev` case -- exercising
# locally-modified API logic that is not on the live server -- not a substitute
# for dev:live on already-deployed UI work.
#
set -euo pipefail
cd "$(dirname "$0")/.."

TUNNEL_PORT="${SMOKE_TUNNEL_PORT:-15433}"
TUNNEL_SPEC="${TUNNEL_PORT}:127.0.0.1:5432"
DEV_CONFIG="config/config-development.json"
CONFIG_BACKUP="$(mktemp)"
OWN_TUNNEL=

cleanup() {
  # Restore the untouched dev config and tear down a tunnel we opened.
  [ -f "$CONFIG_BACKUP" ] && cp "$CONFIG_BACKUP" "$DEV_CONFIG" && rm -f "$CONFIG_BACKUP"
  [ -n "$OWN_TUNNEL" ] && pkill -f "ssh -f -N -L ${TUNNEL_SPEC} league" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Reuse an existing tunnel on this port, otherwise open one we own.
if ! nc -z 127.0.0.1 "$TUNNEL_PORT" 2>/dev/null; then
  echo "[dev-smoke] Opening read-path SSH tunnel localhost:${TUNNEL_PORT} -> league:5432"
  ssh -f -N -L "$TUNNEL_SPEC" league
  OWN_TUNNEL=1
else
  echo "[dev-smoke] Reusing existing tunnel on localhost:${TUNNEL_PORT}"
fi

# The API runs in development mode (plain HTTP on :8082, no prod TLS certs) and
# config-development already targets league_production / league_writer -- only its
# secrets are blank locally (dev config ships blank by design). We fill exactly two
# things without persisting any real secret:
#   1) jwt.secret: a throwaway value. The local API both issues and verifies its
#      own tokens, so it only needs to be internally consistent, never prod's real
#      secret. Patched into the tracked dev config transiently, restored on exit.
#   2) LEAGUE_DB_PASSWORD: the real password, derived from config-production
#      (sops/age) at runtime and passed via env only -- it never lands on disk.
cp "$DEV_CONFIG" "$CONFIG_BACKUP"
node -e '
const fs = require("fs");
const f = "config/config-development.json";
const c = JSON.parse(fs.readFileSync(f, "utf8"));
c.jwt = Object.assign({ algorithms: ["HS256"] }, c.jwt, { secret: "dev-smoke-readonly-local" });
fs.writeFileSync(f, JSON.stringify(c, null, 2));
'

export NODE_ENV=development
export LEAGUE_DB_HOST=127.0.0.1
export LEAGUE_DB_PORT="$TUNNEL_PORT"
export LEAGUE_DB_PASSWORD="$(NODE_ENV=production node -e 'import("#config").then(c=>process.stdout.write(String(c.default.postgres.connection.password)))')"
export PGOPTIONS='-c default_transaction_read_only=on'
[ -n "$LEAGUE_DB_PASSWORD" ] || { echo "[dev-smoke] ERROR: could not derive the production DB password from config-production (age key present?)."; exit 1; }

echo "[dev-smoke] Starting frontend + local API (Ctrl-C to stop). Log in with your real xo.football account."
npx concurrently -k -n web,api -c blue,green "yarn start" "node server.mjs"
