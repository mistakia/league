#!/bin/bash
#
# Pre-flight gate for `yarn deploy:all`. Refuses to start a deploy from a tree
# whose contents would not match what production ends up running.
#
# Three failure modes, all of them observed in this repo rather than imagined:
#
#   1. Unpushed commits. Every recipient host deploys by `git pull` from
#      origin/master, so a local commit that is not pushed deploys the PRIOR
#      state and leaves production on stale code -- while the operator watches a
#      successful-looking deploy scroll past.
#
#   2. A dirty working tree. `yarn build` bundles the working tree, not the
#      pushed ref. This checkout is shared by several concurrent sessions, so a
#      sibling's uncommitted edit ships straight to production through the
#      frontend bundle: a 2026-07 deploy did exactly this with uncommitted
#      changes to libs-shared/get-draft-window.mjs, which reaches the SPA via
#      libs-shared/index.mjs.
#
#   3. An unpushed `private` submodule commit. The servers run
#      `git submodule update --init private`, which fetches from private's
#      origin. private is a NESTED submodule that user-base's sync-all does not
#      recurse into, so its commits are pushed by hand and are the easiest thing
#      in the deploy to forget.
#
# Being BEHIND origin/master is refused for the same reason as (1) inverted: the
# hosts would pull code newer than the tree `yarn build` bundled, so the served
# client and the running API would come from different revisions.
#
# This gate is what makes `deploy:all` safe to be the single documented deploy
# path. It never mutates anything -- it only fetches and compares.

set -euo pipefail

cd "$(dirname "$0")/.."

fail() {
  echo "" >&2
  echo "preflight-deploy: REFUSING TO DEPLOY" >&2
  echo "  $1" >&2
  shift
  for line in "$@"; do
    echo "  $line" >&2
  done
  echo "" >&2
  exit 1
}

git fetch --quiet origin

# (2) dirty working tree
dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  echo "$dirty" >&2
  fail \
    "working tree is dirty; 'yarn build' would bundle these edits into production." \
    "" \
    "This tree is shared by concurrent sessions -- do NOT stash work that is not" \
    "yours. If the dirt belongs to someone else, build from a throwaway worktree" \
    "pinned to the pushed ref instead:" \
    "" \
    "  WT=/tmp/league-deploy-\$\$   # unique per run: several sessions share this" \
    "                             # checkout and a fixed path collides" \
    "  git worktree add \"\$WT\" origin/master" \
    "  cd \"\$WT\" && ~/bin/sandbox-install yarn install --immutable" \
    "  yarn build && yarn deploy:dist && yarn deploy:sourcemaps" \
    "  cd - && git worktree remove --force \"\$WT\"" \
    "" \
    "Install into the worktree; do NOT symlink this checkout's node_modules in." \
    "The shared node_modules carries whatever a concurrent session installed but" \
    "has not committed, so a symlink ships a sibling's dependency bump to" \
    "production while the worktree itself is clean (this happened 2026-07-31)." \
    "'--immutable' builds strictly from the committed yarn.lock and fails rather" \
    "than resolving something new." \
    "" \
    "For a BACKEND+frontend deploy from the worktree, run 'yarn deploy:all' there" \
    "instead -- but init the submodule first, or this gate refuses again on (3):" \
    "" \
    "  git -C \"\$WT\" submodule update --init private"
fi

# (1) unpushed / behind
ahead=$(git rev-list --count origin/master..HEAD)
behind=$(git rev-list --count HEAD..origin/master)
if [ "$ahead" != "0" ]; then
  fail \
    "HEAD is $ahead commit(s) AHEAD of origin/master." \
    "" \
    "The hosts pull from origin/master, so deploying now would ship the prior" \
    "state and leave production on stale code. Let cli/sync/sync-all.sh push" \
    "first, then re-run. Never 'git push' this repo by hand."
fi
if [ "$behind" != "0" ]; then
  fail \
    "HEAD is $behind commit(s) BEHIND origin/master." \
    "" \
    "The hosts would pull code newer than the tree 'yarn build' bundles, leaving" \
    "the served client and the running API on different revisions."
fi

# (3) unpushed private submodule
if [ -e private/.git ]; then
  private_ahead=$(git -C private rev-list --count origin/main..HEAD)
  if [ "$private_ahead" != "0" ]; then
    fail \
      "private submodule is $private_ahead commit(s) ahead of its origin/main." \
      "" \
      "The hosts run 'git submodule update --init private' and would fetch the" \
      "older commit. private is a NESTED submodule that sync-all does not" \
      "recurse into, so push it directly:" \
      "" \
      "  git -C private push origin main"
  fi
else
  fail "private submodule is not initialized; the hosts deploy it."
fi

# (4) the API host's pm2 environment carries LEAGUE_REDIS_HOST
#
# server.mjs refuses to start without it, because Redis backs the data-view
# result cache, the data_view_sql:enabled kill switch and all three generation
# spend limits, and each of those fails OPEN and silently when Redis is absent.
#
# The gate exists because `yarn deploy` reloads pm2, and a RELOAD re-executes
# the app with the environment pm2 already holds -- it does not re-read
# server.pm2.config.js. So a deploy that first ships the refusal to a process
# started before LEAGUE_REDIS_HOST was pinned there takes the API down at the
# moment it reloads, and the config file naming the variable is no defense.
#
# The check reports which of FOUR states it found, rather than testing the
# variable directly. `pm2 jlist | grep -q` collapses "variable absent" and
# "pm2 could not run" into the same empty output, and pm2 CANNOT RUN in a
# non-interactive ssh session unless nvm is sourced first: /usr/local/bin/pm2
# exists and `command -v pm2` finds it, but its shebang resolves `node` through
# PATH and node lives under ~/.nvm, so it dies with "env: 'node': No such file
# or directory". A grep alone therefore reports a confident ABSENT for a probe
# that never ran -- measured against this host, where the positive control
# (BASE_INSTANCE_KEY_FILE, which IS in that environment) also read as absent.
#
# The oracle is pm2's exit status and a non-empty jlist, not the grep. The nvm
# incantation is the same one the `load:main` deploy script uses.
if [ -n "${SKIP_REDIS_ENV_GATE:-}" ]; then
  echo "preflight-deploy: skipping the pm2 LEAGUE_REDIS_HOST check (SKIP_REDIS_ENV_GATE set)"
else
  # The API host is fleet topology, not a fact about league, and this
  # repository is public -- so it is configuration with no default. Resolved
  # before the probe so a missing config fails HERE, naming the file, rather
  # than as an `ssh ''` whose error names nothing.
  main_host=$(node scripts/league-topology-value.mjs deploy.main_host) || exit 1

  redis_env_state=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$main_host" '
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    jlist=$(pm2 jlist 2>/dev/null) || { echo NO_PM2; exit 0; }
    [ -n "$jlist" ] || { echo NO_PM2; exit 0; }
    case "$jlist" in
    *LEAGUE_REDIS_HOST*) echo PRESENT ;;
    *) echo ABSENT ;;
    esac' 2>/dev/null) || redis_env_state=UNREACHABLE

  case "$redis_env_state" in
  PRESENT) ;;
  NO_PM2)
    fail \
      "pm2 could not be run on the API host over a non-interactive ssh" \
      "session, so this gate cannot read the running process environment." \
      "It refuses rather than reporting a clean result it did not obtain."
    ;;
  UNREACHABLE | '')
    fail \
      "could not reach the API host to read the running pm2 environment." \
      "" \
      "Set SKIP_REDIS_ENV_GATE=1 only once you have confirmed LEAGUE_REDIS_HOST" \
      "is in the running process another way."
    ;;
  *)
    fail \
      "the running pm2 'server' process has no LEAGUE_REDIS_HOST in its environment." \
      "" \
      "A pm2 RELOAD does not re-read server.pm2.config.js, so this deploy would" \
      "restart the API into code that refuses to start without that variable." \
      "Pick it up with a delete-then-start on the host, which is the only pm2" \
      "operation that re-reads the config file:" \
      "" \
      "  ssh $main_host 'cd /root/league && pm2 delete server && \\" \
      "    pm2 start server.pm2.config.js --env production'" \
      "" \
      "A delete-then-start of 'server' drops every live websocket, so it is a" \
      "deploy-window operation -- not something to run under an active auction."
    ;;
  esac
fi

echo "preflight-deploy: clean tree, HEAD == origin/master ($(git rev-parse --short HEAD)), private pushed, pm2 redis env present"
