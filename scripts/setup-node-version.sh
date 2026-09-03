#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NODE_VERSION=$(cat "$PROJECT_ROOT/.nvmrc" | tr -d '[:space:]')

echo "Target Node version: v$NODE_VERSION"
echo ""

# Remote servers (Linux). The hostnames are fleet topology and this repository
# is public, so they come from configuration with no default -- resolved up
# front so a missing config fails before the first ssh rather than midway
# through a partial fan-out.
MAIN_HOST=$(node "$SCRIPT_DIR/league-topology-value.mjs" deploy.main_host)
WORKER1_HOST=$(node "$SCRIPT_DIR/league-topology-value.mjs" deploy.worker1_host)

for host in "$MAIN_HOST" "$WORKER1_HOST"; do
  echo "Setting up $host..."
  ssh $host "source ~/.nvm/nvm.sh && nvm install $NODE_VERSION && npm install -g yarn pm2 && ln -sfn ~/.nvm/versions/node/v$NODE_VERSION ~/.nvm/versions/node/current && echo 'Done: current -> v$NODE_VERSION (with yarn, pm2)'"
  echo ""
done

# Local development machine (Mac)
echo "Setting up local development machine..."
source ~/.nvm/nvm.sh && nvm install $NODE_VERSION && npm install -g yarn && ln -sfn ~/.nvm/versions/node/v$NODE_VERSION ~/.nvm/versions/node/current
echo "Done: current -> v$NODE_VERSION (with yarn)"
echo ""

echo "All machines configured to use Node v$NODE_VERSION"
echo ""
echo "Verify:"
echo "  Local:    ~/.nvm/versions/node/current/bin/node --version"
echo "  Remote:   ssh $MAIN_HOST '~/.nvm/versions/node/current/bin/node --version'"
