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
    "  ln -s \"\$PWD/node_modules\" \"\$WT/node_modules\"" \
    "  cd \"\$WT\" && yarn build && yarn deploy:dist && yarn deploy:sourcemaps" \
    "  cd - && rm -f \"\$WT/node_modules\" && git worktree remove \"\$WT\"" \
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

echo "preflight-deploy: clean tree, HEAD == origin/master ($(git rev-parse --short HEAD)), private pushed"
