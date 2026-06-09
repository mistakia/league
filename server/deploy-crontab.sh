#!/bin/bash
# Deploy crontab files to a remote server using the additive ~/crontab/ pattern.
# Routes through bootstrap's deploy_crontab_scope helper (installed to ~/bin)
# so basenames removed from this source directory are reaped from ~/crontab/
# on the remote on the next deploy -- no more orphans firing forever after a
# rename or removal.
#
# Usage: server/deploy-crontab.sh <ssh-host> <crontab-dir> [scope-key]
#
# scope-key defaults to "league-$(basename crontab-dir | sed 's/^crontab-//')"
# so server/crontab-main yields scope league-main and server/crontab-worker-1
# yields league-worker-1. Distinct scope keys keep this repo's manifest
# isolated from bootstrap-owned and other-project crontabs on shared hosts.

set -euo pipefail

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  echo "Usage: $(basename "$0") <ssh-host> <crontab-dir> [scope-key]" >&2
  exit 1
fi

SSH_HOST="$1"
CRONTAB_DIR="$2"
SCOPE_KEY="${3:-league-$(basename "$CRONTAB_DIR" | sed 's/^crontab-//')}"

if [ ! -d "$CRONTAB_DIR" ]; then
  echo "Error: Directory not found: $CRONTAB_DIR" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for f in "$CRONTAB_DIR"/*.cron; do
  base crontab build "$f" > "$TMPDIR/$(basename "$f")"
done

REMOTE_TMP=$(ssh -A "$SSH_HOST" 'mktemp -d')
scp -q "$TMPDIR"/*.cron "$SSH_HOST":"$REMOTE_TMP/"
ssh -A "$SSH_HOST" "deploy_crontab_scope '$SCOPE_KEY' '$REMOTE_TMP' cat && rm -rf '$REMOTE_TMP' && \$HOME/bin/load_crontab_files"

echo "Deployed crontab files from $CRONTAB_DIR to $SSH_HOST (scope=$SCOPE_KEY)"
