#!/usr/bin/env node

/**
 * The hermetic verify set: every check that reads only the checked-out tree and
 * node_modules — no database, no base ref, no user-base ancestor, no network.
 *
 * ONE definition, TWO callers. `.github/workflows/test.yml` runs `yarn verify`
 * as a single step, and the pre-push gate
 * (user:cli/lib/pre-push-guard-local-verify.sh) runs the same script against the
 * outgoing SHA in a submodule-free worktree. That shared definition is the whole
 * point: when CI and the local gate keep separate lists, they drift, and a push
 * that passes locally reddens master anyway — which defers every session's push
 * to mistakia/league fleet-wide.
 *
 * FAIL-FAST, matching what CI did when these were fifteen separate steps: none
 * of them carried `if: !cancelled()`, so the first red already skipped the rest.
 * Fast feedback is also what the local gate wants — a lint error should not cost
 * the author the full set.
 *
 * NOT here, and each for a stated reason:
 *
 *   yarn test — needs postgres. CI provisions a `postgres:latest` service and
 *   overrides the script's blanked LEAGUE_DB_HOST with PGHOST/PGPORT/PGDATABASE.
 *   The package.json script blanking the DB host does NOT mean the suite runs
 *   without one; `check:private-tests` likewise exits 2 demanding an isolated
 *   league_test_private* database. Both stay CI-only / workstation-only.
 *
 *   check:private-tests — the private suite covers `private/`, which the verify
 *   worktree deliberately does not check out. See the file-set note below.
 *
 *   check:cluster and the workstation-only gates (check-returned-property-reads,
 *   check-call-site-param-contracts, the --gate 2 halves) — they compare a
 *   PRODUCER in one root against a CONSUMER in another, and no rule requires
 *   those to land in the same commit, so a sibling's in-flight rename would turn
 *   this red on a finding invisible in the author's own diff. They run per
 *   rename cluster, by hand.
 *
 * THE FILE SET IS PART OF THE CONTRACT. This must be run from a checkout whose
 * `private/` and `data/` submodules are UNPOPULATED and which carries no
 * `scratch/`, because that is the file set the runner sees — `private` is an SSH
 * URL into a private repo and no workflow initializes submodules. Run in a
 * workstation checkout instead, `yarn lint` reports 26 errors and 2 warnings on
 * a clean master whose CI is green, every one of them under `private/` or
 * `scratch/`. A gate stricter than CI blocks pushes over files CI never
 * validates, so the worktree, not this list, is what makes lint honest here.
 */

import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// Ordered cheapest-first where the ordering is free, so a broken tree fails in
// seconds rather than after the 16s checks at the end. Measured 2026-08-30 in a
// submodule-free worktree: 44s for the whole set.
const checks = [
  {
    name: 'test collection guard',
    // Fails when a test file under test/ is not collected by mocha. First
    // because an uncollected spec should fail in a second rather than after a
    // full suite that silently skipped it.
    cmd: ['yarn', 'check:test-collection']
  },
  {
    name: 'destructive database guard',
    // Fails when a non-production config names league_production or a remote
    // host, or when a destructive entrypoint stops consulting the target guard.
    cmd: ['node', 'db/gates/check-destructive-db-guard.mjs']
  },
  {
    name: 'schema conformance ratchet',
    // Fails when db/schema.postgres.sql carries a naming violation the checked-in
    // baseline does not know about. Hermetic despite living next to the postgres
    // steps in CI: the audit PARSES the tracked schema file and never opens a
    // connection.
    //
    // It was a separate CI step and not in this set until 2026-09-01, and the
    // gap is what that day cost. docs/guides/gates.md already had to tell every
    // author to "run it before pushing any commit that adds a table or column"
    // precisely because nothing in the suite exercises it -- a standing
    // instruction to remember a command is the shape this file exists to
    // replace. users.data_view_export_max_rows then reddened master for a day
    // on two ordinary English words, and a red master defers EVERY session's
    // push to mistakia/league. 0.15s here would have refused that push.
    cmd: ['node', 'db/gates/check-schema-conformance-ratchet.mjs']
  },
  {
    name: 'dev fixture scrub',
    // Fails when a column in the committed schema carries no disposition in
    // scripts/dev-fixture-projection.json, or when a required scrub has been
    // relaxed. Reads the schema file and the projection; no database.
    //
    // Landed here in the same change and for a sharper reason than its
    // neighbour: it was the step immediately AFTER the ratchet in CI, so when
    // the ratchet failed this never ran, and the run summary reported one
    // broken gate when the same column had broken two. A fail-fast pipeline
    // reports the first failure, never the set -- which reads as a complete
    // diagnosis and is not one. Ordering both before the suite means the author
    // sees both at once.
    cmd: ['node', 'db/gates/check-dev-fixture-scrub.mjs']
  },
  {
    name: 'z-index scale guard',
    // Fails when a floating surface sets a global-layer z-index as a bare number
    // instead of taking it from the scale in app/styles/variables.styl.
    cmd: ['yarn', 'check:z-index-scale']
  },
  {
    name: 'renamed-column consumer gate (gate 1)',
    // Fails when a table-qualified column literal in server code does not
    // resolve against db/schema.postgres.sql. GATE 1 ONLY, deliberately: it
    // needs no rename list and no base ref, so it cannot drift and cannot go red
    // on a sibling's in-flight migration.
    //
    // Gate 2 is NOT wired and must not be until it can see `year`. It diffs the
    // schema against a base ref, which makes it depend on which ref CI picks,
    // and its findings need per-site adjudication by someone who knows the
    // cluster. Run it by hand per rename cluster:
    //   node db/gates/check-renamed-column-consumers.mjs --gate 2 \
    //     --base <pre-cluster-ref> --unadjudicated
    cmd: ['node', 'db/gates/check-renamed-column-consumers.mjs', '--gate', '1']
  },
  {
    name: 'knex column resolution gate',
    // The companion to the gate above, covering the references that name no
    // table LITERALLY: an alias-qualified 'r.year' bound by a join, and an
    // unqualified object key like .where({ lid, year }). Both were invisible to
    // every gate until 2026-08-07, which is how the season_grain conform left
    // rosters_players.year live in compute-roster-slot-metrics (37cc9f36b), and
    // three more 42703s on master besides.
    //
    // Its ten negative controls run on every invocation, and four of them are
    // what proves the scan is not vacuous — each has to find real corpus
    // material of its shape before it can mutate it, so all four go red when the
    // walk reaches nothing. That is why this gate asserts no coverage floor.
    cmd: ['node', 'db/gates/check-knex-column-resolution.mjs']
  },
  {
    name: 'league fixture reset coverage',
    // Fails when a league-scoped table in db/schema.postgres.sql is not cleared
    // by the per-league test fixture, does not cascade from something the
    // fixture clears, and carries no adjudication. The class has produced two
    // incidents (a restricted-free-agency table in 2026-08, league_pauses in
    // 2026-08-13) and both were "a human has to remember to edit a list".
    //
    // It CAN go red on a table someone adds without adjudicating it — that is
    // the gate working, and both of its inputs land in the same commit under
    // this repo's one-commit rule for DDL plus schema export plus dependent
    // code.
    cmd: ['node', 'db/gates/check-league-fixture-reset-coverage.mjs']
  },
  {
    name: 'API response shape gate (gate 1)',
    // Fails when a swagger response schema disagrees with itself — a `required`
    // name absent from the resolved properties, or a $ref that does not resolve.
    // GATE 1 ONLY: the gate's own header names it the CI-eligible half, since it
    // reads the spec against ITSELF and so cannot go red on a schema change at
    // all.
    //
    // Gate 2 (wholesale single-table handlers vs db/schema.postgres.sql) is
    // deliberately NOT wired. It is green today, so this is a wiring decision
    // rather than a repair — but CLAUDE.md's standing verdict is that it stays
    // out and runs per cluster from a clean worktree.
    cmd: ['node', 'db/gates/check-api-response-shapes.mjs', '--gate', '1']
  },
  {
    name: 'stranded vocabulary literal gate (gate 1)',
    // GATE 1 ONLY, for the same reason as the gate above: gate 1 is the knex
    // half, over this repo's own server roots against db/schema.postgres.sql, so
    // it needs nothing outside the checkout. Gate 2 reads a SQL corpus that
    // lives in user-base, which a runner has no ancestor for.
    cmd: [
      'node',
      'db/gates/check-stranded-vocabulary-literals.mjs',
      '--gate',
      '1'
    ]
  },
  {
    name: 'dropped table consumer gate',
    // Reads only the checked-out tree and walks it in Node, so it needs no
    // database, no base ref and no binary that is not node itself.
    cmd: ['node', 'db/gates/check-dropped-table-consumers.mjs']
  },
  {
    name: 'type check',
    // The incremental //@ts-check tier. check:types regenerates
    // db/schema-types.d.ts from db/schema.postgres.sql and fails if the
    // committed copy disagrees, then runs tsc over the files carrying the
    // pragma.
    cmd: ['yarn', 'check:types']
  },
  {
    name: 'ts-check adoption ratchet',
    // tsc is STRUCTURALLY UNABLE to see a file that has been un-adopted:
    // deleting one comment makes a type error disappear, and the check above
    // still exits 0 (measured). This compares the committed adoption list
    // against the tree in both directions so the covered set can only grow, and
    // it carries four always-on negative controls.
    cmd: ['node', 'db/gates/check-ts-check-ratchet.mjs']
  },
  {
    name: 'knex table types in effect',
    // The knex table-type map is what makes the row types reach ~1,500
    // `db('<table>')` call sites without any of them annotating anything. It
    // only applies if db/knex-tables.d.ts is in the program, and every `include`
    // pattern in tsconfig.json ends in *.mjs and matches no .d.ts — so the file
    // is listed there explicitly, and losing that one line leaves both checks
    // above exiting 0 over a tree that is no longer covered.
    cmd: ['node', 'db/gates/check-knex-table-types.mjs']
  },
  {
    name: 'bare-container JSDoc baseline',
    // The bare-container JSDoc ratchet's DOWNWARD half. `yarn lint` already
    // errors on any occurrence past a file's allowance, so the upward direction
    // is held by the lint check below. This is the other one: it fails when a
    // baseline entry allows MORE than the file contains, which is the slack a
    // later regression would be reabsorbed into silently.
    cmd: ['yarn', 'check:jsdoc-baseline']
  },
  {
    name: 'dead code (knip)',
    // `--include files` deliberately. Only the unused-FILES report is a gate.
    // The unused-EXPORTS report is not trustworthy and must never be acted on —
    // see docs/guides/dead-code.md. Dependency reports are a separate cleanup
    // and are not clean yet.
    //
    // private/ is unpopulated here, exactly as on the runner. That is benign for
    // knip — the files are absent rather than unreferenced, and core never
    // statically imports #private, so the rest of the graph is unchanged. It
    // does mean this covers everything EXCEPT private/, which has to be checked
    // from a local clone.
    cmd: ['yarn', 'knip', '--include', 'files']
  },
  {
    name: 'lint',
    // Last because it is the joint-slowest and the one most likely to be red on
    // a work-in-progress tree, so every cheaper signal is already reported by
    // the time it runs. See the file-set note in the header: this is honest only
    // against an unpopulated private/ and no scratch/.
    cmd: ['yarn', 'lint']
  }
]

let failed = null

for (const check of checks) {
  const started = Date.now()
  process.stdout.write(`\n=== ${check.name} ===\n`)

  const [command, ...args] = check.cmd
  const result = spawnSync(command, args, {
    cwd: repo_root,
    stdio: 'inherit'
  })

  const elapsed = ((Date.now() - started) / 1000).toFixed(1)

  // A spawn that never ran (missing binary) is an infrastructure fact, not a
  // verdict about the tree — but it is also not something this script can
  // paper over, so it fails here and the pre-push guard decides whether to
  // fail open on it.
  if (result.error) {
    process.stdout.write(`FAILED ${check.name} (${result.error.message})\n`)
    failed = { name: check.name, code: 1 }
    break
  }

  if (result.status !== 0) {
    process.stdout.write(
      `FAILED ${check.name} after ${elapsed}s (exit ${result.status})\n`
    )
    failed = { name: check.name, code: result.status ?? 1 }
    break
  }

  process.stdout.write(`ok ${check.name} (${elapsed}s)\n`)
}

if (failed) {
  process.stdout.write(`\nverify FAILED: ${failed.name}\n`)
  process.exit(failed.code)
}

process.stdout.write(`\nverify OK: ${checks.length} checks passed\n`)
