#!/bin/bash
# Deploy crontab files to a remote server using the additive ~/crontab/ pattern.
# Processes each .cron source through `base crontab build`, copies to remote
# ~/crontab/, then calls load_crontab_files to rebuild the system crontab.
#
# Usage: server/deploy-crontab.sh <ssh-host> <crontab-dir>

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $(basename "$0") <ssh-host> <crontab-dir>" >&2
  exit 1
fi

SSH_HOST="$1"
CRONTAB_DIR="$2"

if [ ! -d "$CRONTAB_DIR" ]; then
  echo "Error: Directory not found: $CRONTAB_DIR" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for f in "$CRONTAB_DIR"/*.cron; do
  base crontab build "$f" > "$TMPDIR/$(basename "$f")"
done

ssh -A "$SSH_HOST" 'mkdir -p ~/crontab'
scp -q "$TMPDIR"/*.cron "$SSH_HOST":~/crontab/
ssh -A "$SSH_HOST" 'cat ~/crontab/*.cron | crontab -'

echo "Deployed crontab files from $CRONTAB_DIR to $SSH_HOST"
