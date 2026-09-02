#!/usr/bin/env node

/**
 * Runs every durable consistency gate for a schema/rename cluster, in one
 * command, and reports which of them actually proved anything.
 *
 * WHY THIS EXISTS. The gates themselves are good. Invoking them was PROSE —
 * a list scattered through a 500-line CLAUDE.md — and the recurring failure was
 * never a gate returning the wrong answer, it was a gate nobody ran. The 2026
 * plays/snaps cluster renamed 18 param keys and silently dropped filters on 45
 * saved views; CLAUDE.md's own verdict on it is "what was missing was running
 * the check at all".
 *
 * This is deliberately NOT a shared harness for the gates' internals. Each gate
 * picks its own oracle, and that choice is the load-bearing decision in every
 * one of them (check-api-response-shapes records at length why a static
 * comparison beats executing the routes). A shared library would be one place a
 * subtle bug blinds all of them at once, which is this codebase's signature
 * failure mode. Nothing here reaches inside a gate; it invokes them and reads
 * their exit codes and their output.
 *
 * WHAT IT ADDS BEYOND CONVENIENCE. A gate that cannot report is worse than no
 * gate, so most of these run an always-on negative control and fail themselves
 * when it does not go red. This runner makes that convention structural: a gate
 * DECLARING a control must print one, and a control that reports STAYED GREEN
 * fails the whole run even though the gate itself exited 0. The gates that
 * declare no control are printed as standing debt rather than quietly passing,
 * because a gate with no control is exactly where a silent green hides —
 * check-player-column-repoint stood RED on three false positives for twelve
 * days without anyone noticing, and check-plays-column-repoint exits 0 while
 * structurally unable to see renames on any table outside a hardcoded nine.
 *
 * Neither of those is fixed here. This reports; it does not repair.
 *
 * Usage:
 *   yarn check:cluster                      # everything whose prerequisites are up
 *   yarn check:cluster --base <pre-ref>     # ...including the base-ref gates
 *   yarn check:cluster --list               # the manifest, run nothing
 */

import fs from 'fs'
import net from 'net'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

import { CORPUS_INCOMPLETE_MARKER } from '../db/gates/scan-corpus.mjs'
import {
  NEGATIVE_CONTROL_MARKER,
  CONTROL_STAYED_GREEN_MARKER
} from '../db/gates/negative-control.mjs'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// The throwaway Postgres from compose.test.yaml, and the `base db` league SSH
// tunnel. Both are probed rather than assumed — a gate that needs one and does
// not get it must SKIP loudly, never report a green over a surface it could not
// read.
const TEST_CONTAINER = { host: '127.0.0.1', port: 5433 }
const PRODUCTION_TUNNEL = { host: '127.0.0.1', port: 15432 }

// The user-base prose corpus that stranded-vocabulary-literals gate 2 scans. It
// is reached by walking UP from the checkout, so it exists on a workstation and
// on no CI runner. Resolved here by the same marker directory the gate itself
// walks for, so the runner's SKIP and the gate's own reachability cannot drift.
const USER_BASE_PROSE_MARKER = path.join('text', 'nfl', 'query')

const find_user_base_prose_root = () => {
  let dir = repo_root
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, USER_BASE_PROSE_MARKER))) return dir
    dir = path.dirname(dir)
  }
  return null
}

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  LEAGUE_DB_HOST: PRODUCTION_TUNNEL.host,
  LEAGUE_DB_PORT: String(PRODUCTION_TUNNEL.port)
}

// A test-container gate must be PINNED to the container, not merely run after
// probing it. Without this the child inherits whatever `LEAGUE_DB_*` the
// operator's profile exports, so the runner probes :5433, declares the
// prerequisite met, and then hands the gate a different database entirely --
// which is the exact "green over a surface it could not read" the probe exists
// to prevent, arriving as a TOOLING ERROR and a BLIND instead of a skip.
// Observed 2026-08-06 with LEAGUE_DB_HOST=localhost and LEAGUE_DB_PORT=15432
// (the `base db` tunnel) in the environment: data-view-sql-validity and
// league-schema-consumers both aimed their scratch `CREATE DATABASE` at
// PRODUCTION and failed only because `league_test` is not a role there.
const TEST_CONTAINER_ENV = {
  LEAGUE_DB_HOST: TEST_CONTAINER.host,
  LEAGUE_DB_PORT: String(TEST_CONTAINER.port)
}

// The pin above named HOST and PORT, but `db/index.mjs` honours five overrides --
// host, port, user, password and database -- so the other three walked straight
// through it and the pin was only ever two-fifths of what it claimed. Setting
// LEAGUE_DB_DATABASE to clear check-private-tests (the one gate that REQUIRES it,
// and which is `requires: 'none'` so it still receives it) redirected every
// pinned gate to that database too: on 2026-08-28 saved-view-param-coverage and
// data-view-url-param-coverage both reported `TOOLING ERROR: database
// "league_test_privsuite" does not exist` and conflated-player-rows went BLIND,
// three verdicts manufactured by the environment on gates the change never
// touched. That is the LOUD direction. The quiet one is worse and is the reason
// this scrubs rather than adds two more keys: an ambient LEAGUE_DB_DATABASE
// naming a database that DOES exist on the pinned host -- a leftover
// `league_test_<slug>` from an isolated suite run, which this guide's own test
// recipe tells people to export -- silently runs a pinned gate against a stale
// schema and reports a green over it.
const DB_CONNECTION_OVERRIDES = [
  'LEAGUE_DB_HOST',
  'LEAGUE_DB_PORT',
  'LEAGUE_DB_USER',
  'LEAGUE_DB_PASSWORD',
  'LEAGUE_DB_DATABASE'
]

// Pinning means the ambient value cannot reach the child AT ALL, so drop the
// whole family first and then apply the pin. A gate whose `requires` is not a
// pinned class keeps `process.env` untouched, which is what check-private-tests
// consumes.
const pinned_env = (pin) => {
  const env = { ...process.env }
  for (const key of DB_CONNECTION_OVERRIDES) delete env[key]
  return { ...env, ...pin }
}

// The user-base trees the league-schema-consumer gate reads. They are arguments
// rather than a hardcoded path inside that gate because the gate is about the
// league SCHEMA and the corpus is a parameter of the run — but this repo's
// cluster recipe always passes these, so the runner supplies them.
const USER_BASE_ROOTS = [
  '--root',
  '../../../guideline/nfl',
  '--root',
  '../../../text/league',
  '--root',
  '../../../workflow/nfl',
  // text/nfl holds the six runnable query files under text/nfl/query/, which are
  // the canonical SQL analysis sessions execute. text/nfl-betting is a SIBLING
  // directory that text/nfl does not reach, and text/home-dynasty-league is a
  // third root again -- all three were outside the corpus until the 2026-08-15
  // pct conform, whose breaking SQL lived in every one of them and over which
  // the gate returned green.
  '--root',
  '../../../text/nfl',
  '--root',
  '../../../text/nfl-betting',
  '--root',
  '../../../text/home-dynasty-league',
  // The user-base CLI tree, for GATE 3. It holds EXECUTABLE schema consumers --
  // monitoring scripts shipping SQL over ssh to psql, and scripts POSTing SQL to
  // `/api/db/<database>/query` — a different corpus from the three prose roots
  // above, and in no gate at all until 2026-08-07, when a lineage check had been
  // exiting 1 nightly since the season_grain conform. Not content-gated: every
  // `.sh` and `.mjs` under it is read, so the denominator cannot move when a
  // table reference is renamed away. Each statement is bound to the database its
  // TRANSPORT names, so the tree can hold nano, finance and content-feed SQL
  // beside league SQL without any of it being judged against the league schema.
  '--executable-root',
  '../../../cli'
]

/**
 * One row per durable gate, ordered cheapest-first so a cluster gets its fast
 * static answers before anything waits on a container or a tunnel.
 *
 * `negative_control` records whether the gate PRINTS an always-on control
 * block, not whether it ought to. It is an observation about the gate as it
 * stands today; the three that carry one are held to it, and the rest are
 * reported as debt. Setting this true for a gate that does not print one makes
 * the run red, which is the intended direction.
 *
 * `oracle` is the one line a reader needs to decide whether a green from this
 * gate covers the surface they are worried about.
 */
const GATES = [
  {
    id: 'destructive-db-guard',
    command: ['db/gates/check-destructive-db-guard.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'non-production configs must not name league_production or a remote host, and every destructive entrypoint must import the target guard'
  },
  {
    id: 'player-mint-guard',
    command: ['db/gates/check-player-mint-guard.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'every automated createPlayer call site has a resolve_canonical_player call ahead of it in the enclosing function -- structural reachability only, not that the verdict was branched on correctly'
  },
  {
    id: 'dev-fixture-scrub',
    command: ['db/gates/check-dev-fixture-scrub.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'every dumped column carries a disposition in the dev-fixture projection, and the named secrets are not emitted verbatim'
  },
  {
    id: 'league-fixture-reset-coverage',
    command: ['db/gates/check-league-fixture-reset-coverage.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'every league-scoped table in the schema is cleared by db/fixtures/league.mjs, cascade-cleared, or adjudicated — MEMBERSHIP only, not the list ORDER'
  },
  {
    id: 'schema-conformance-ratchet',
    command: ['db/gates/check-schema-conformance-ratchet.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'schema file vs checked-in violation baseline — new debt fails, cleared debt passes silently'
  },
  {
    id: 'api-response-shapes',
    command: ['db/gates/check-api-response-shapes.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'swagger vs itself, and wholesale single-table handlers vs the schema file'
  },
  {
    id: 'renamed-column-consumers-gate-1',
    command: ['db/gates/check-renamed-column-consumers.mjs', '--gate', '1'],
    requires: 'none',
    negative_control: true,
    oracle:
      "every 'table.column' literal in server code resolves against the schema file"
  },
  {
    id: 'knex-column-resolution',
    command: ['db/gates/check-knex-column-resolution.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'alias-qualified and unqualified knex column references, resolved through the statement that binds them, vs the schema file'
  },
  // Split into its two gates for the same reason renamed-column-consumers is:
  // the halves have different prerequisites. Invoked bare, gate 2 could not
  // reach its user-base corpus on a runner and the whole gate declared itself
  // BLIND, which the private corpus-gates workflow then had to allow BY NAME --
  // an allowance that would have hidden a genuinely blind gate of the same name
  // forever. Named per gate, gate 1 is CI-eligible and gate 2 SKIPS loudly.
  {
    id: 'stranded-vocabulary-literals-gate-1',
    command: ['db/gates/check-stranded-vocabulary-literals.mjs', '--gate', '1'],
    requires: 'none',
    negative_control: true,
    oracle:
      "a knex literal bound to a CHECK-constrained column vs that column's permitted set — the bound VALUE, not the column name, so no other gate here shares its class"
  },
  {
    id: 'dropped-table-consumers',
    command: ['db/gates/check-dropped-table-consumers.mjs'],
    requires: 'none',
    negative_control: true,
    oracle: 'each deliberately dropped table name has no surviving consumer'
  },
  {
    id: 'call-site-param-contracts',
    command: ['db/gates/check-call-site-param-contracts.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      "a cross-file call's object keys vs the callee's destructured parameter list, resolved through the IMPORT EDGE — the silent-default class no column-anchored or query-site-anchored gate here can see"
  },
  // The RETURN-VALUE dual of the gate above, sharing its resolver
  // (db/gates/import-edge-resolution.mjs) rather than copying it. Same
  // prerequisite, same cost, and deliberately adjacent so a session weakening
  // one resolution rule meets both sets of decoy controls.
  //
  // WORKSTATION-ONLY, on the same terms as its dual and NOT by omission. A
  // finding pairs a producer in one root with a reader in another, and nothing
  // in this repo requires the two to land in one commit — unlike the DDL rule
  // that makes the schema-anchored gates CI-safe. So a sibling renaming a
  // returned key ahead of its consumer repair would turn master red on a
  // finding invisible in anyone else's diff, and a red master defers EVERY
  // push to mistakia/league.
  {
    id: 'returned-property-reads',
    command: ['db/gates/check-returned-property-reads.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'a read of `x.foo` where x is bound to a call, vs the key set the callee provably returns, resolved through the IMPORT EDGE or the same module — fails when it judges NOTHING, so a zero is a measurement rather than a narrowing'
  },
  {
    id: 'private-tests',
    command: ['db/gates/check-private-tests.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'the private suite (yarn test:private) ONCE, where the submodule is present; reports CORPUS INCOMPLETE where it is absent, so a green locally and a green in CI stop being the same claim'
  },
  {
    id: 'ts-check-ratchet',
    command: ['db/gates/check-ts-check-ratchet.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'the committed ts-check adoption list vs the tree, BOTH ways — a file that loses its pragma fails, and a file that gains one fails until it is listed; distinct from yarn check:types, which cannot see a file that has been un-adopted'
  },
  {
    id: 'plays-column-repoint',
    command: ['db/gates/check-plays-column-repoint.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'consumer code vs a rename map, anchored on the tables the MAP itself renames on and with shared tokens derived from the schema export; the control perturbs the anchor and requires the two readings to differ'
  },
  {
    id: 'data-view-description-coverage',
    command: ['db/gates/check-data-view-description-coverage.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'the queryable column registry vs the prose description index, BOTH ways — an undescribed column and an orphaned description each fail; says nothing about whether a description is ACCURATE'
  },
  {
    id: 'rename-target-liveness',
    command: ['db/gates/check-rename-target-liveness.mjs'],
    requires: 'none',
    negative_control: true,
    oracle:
      'every data-view rename registry target, resolved THROUGH its chain, is a live param/column/rate-type key — covers param_key, column_id and rate_type only; table_state, scoring_format and dvoa_type have their own specs and a zero here says nothing about them'
  },
  {
    id: 'renamed-column-consumers-gate-2',
    command: ['db/gates/check-renamed-column-consumers.mjs', '--gate', '2'],
    requires: 'base-ref',
    negative_control: false,
    oracle:
      'columns this cluster removed vs consumers still reading them, per-site adjudicated'
  },
  {
    id: 'stranded-vocabulary-literals-gate-2',
    command: ['db/gates/check-stranded-vocabulary-literals.mjs', '--gate', '2'],
    requires: 'user-base-prose',
    negative_control: true,
    oracle:
      "a SQL literal in the user-base query corpus vs its CHECK-constrained column's permitted set — the half no CI runner can reach, since the corpus is not in this repo"
  },
  {
    id: 'rename-alias-residue',
    command: ['db/gates/check-rename-alias-residue.mjs'],
    requires: 'base-ref',
    negative_control: true,
    oracle:
      'alias-backs whose target is a column the table LOST — the class both other rename gates are structurally blind to'
  },
  {
    id: 'retyped-column-arithmetic',
    command: ['db/gates/check-retyped-column-arithmetic.mjs'],
    requires: 'base-ref',
    negative_control: true,
    oracle:
      'columns whose TYPE moved numeric -> temporal vs code still treating them as epoch seconds — the class every name-resolving gate here is structurally blind to'
  },
  {
    id: 'data-view-sql-validity',
    command: ['db/gates/check-data-view-sql-validity.mjs'],
    requires: 'test-container',
    negative_control: false,
    oracle: 'every generated data-view statement EXPLAINs against the schema'
  },
  {
    id: 'league-schema-consumers',
    command: ['db/gates/check-league-schema-consumers.mjs', ...USER_BASE_ROOTS],
    requires: 'test-container',
    negative_control: true,
    oracle:
      'every statement bound to the league database — documented pairs, fenced SQL, executable SQL from shell and /api/db/league/query, and standalone .sql files bound by their root — vs the schema'
  },
  {
    id: 'conflated-player-rows',
    command: ['db/gates/check-conflated-player-rows.mjs'],
    requires: 'production-tunnel',
    negative_control: true,
    oracle: 'player rows whose own identity fields contradict each other'
  },
  {
    id: 'saved-view-param-coverage',
    command: ['db/gates/check-saved-view-param-coverage.mjs'],
    requires: 'production-tunnel',
    negative_control: false,
    oracle:
      'params persisted inside production saved views vs the live param registry'
  },
  {
    id: 'data-view-url-param-coverage',
    command: ['db/gates/check-data-view-url-param-coverage.mjs'],
    requires: 'production-tunnel',
    negative_control: false,
    oracle:
      'top-level query-string keys of production short URLs vs the accepted key set'
  }
]

/**
 * The whole verdict rule, as a pure function of what a gate produced.
 *
 * It is separated out for one reason: it is the only thing here that can be
 * WRONG in the direction that looks like success, so the controls at the bottom
 * of this file drive it directly with synthetic results. They inject inputs
 * rather than monkeypatching anything — an ESM namespace object is frozen, so a
 * control that patches a member silently does nothing and then reports a green
 * it never earned.
 */
export const evaluate_gate_result = ({
  exit_code,
  output,
  declares_negative_control
}) => {
  if (declares_negative_control) {
    // Anchored on the marker DECLARED in db/gates/negative-control.mjs, not on
    // a token spelled independently at each end. The gates' own control lines
    // carry at least three phrasings (`RED as expected`, `WENT RED`,
    // `RED (good)`); the header is the one thing they agree on, and it is
    // agreement by convention until something declares it.
    if (!output.includes(NEGATIVE_CONTROL_MARKER)) {
      return {
        verdict: 'BLIND',
        detail: 'declares a negative control and printed none'
      }
    }
    if (output.includes(CONTROL_STAYED_GREEN_MARKER)) {
      return {
        verdict: 'BLIND',
        detail: 'a negative control STAYED GREEN — this gate cannot report'
      }
    }
  }

  // Checked before the exit code, because this is exactly the case where the
  // exit code is the misleading half: a gate that never read part of its
  // declared corpus cannot go red on it, so its 0 is narrower than an
  // unqualified OK claims. Reported as its own verdict rather than folded into
  // OK, so `GATE OK` stops meaning two different things depending on which
  // directories happened to exist.
  if (exit_code === 0 && output.includes(CORPUS_INCOMPLETE_MARKER)) {
    const match = output.match(
      new RegExp(`${CORPUS_INCOMPLETE_MARKER} -- not scanned: (.*)`)
    )
    const roots = match ? match[1] : ''
    return {
      verdict: 'OK (PARTIAL)',
      detail: roots ? `not scanned: ${roots.trim()}` : 'corpus incomplete'
    }
  }

  if (exit_code === 0) return { verdict: 'OK', detail: '' }
  if (exit_code === 1) return { verdict: 'FINDINGS', detail: 'exit 1' }
  if (exit_code === 2) {
    return {
      verdict: 'TOOLING ERROR',
      detail: 'exit 2 — the gate could not run'
    }
  }
  return { verdict: 'TOOLING ERROR', detail: `exit ${exit_code}` }
}

const is_listening = ({ host, port }) =>
  new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(1000)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })

const missing_prerequisite = async ({ requires, base_ref }) => {
  if (requires === 'none') return null
  if (requires === 'base-ref') {
    if (!base_ref) return '--base <pre-cluster-ref> was not given'
    // A base ref that does not resolve is a MISSING prerequisite, not a clean
    // run. check-renamed-column-consumers prints `SKIPPED: could not read
    // db/schema.postgres.sql at <ref>` and then exits 0 with `GATE OK`, so a
    // typo'd or garbage-collected ref reads as a passed gate from the outside.
    // Resolve it here rather than trusting the gate's exit code.
    const resolved = spawnSync(
      'git',
      ['rev-parse', '--verify', '--quiet', `${base_ref}^{commit}`],
      { cwd: repo_root, encoding: 'utf8' }
    )
    return resolved.status === 0
      ? null
      : `--base ${base_ref} does not resolve to a commit in this repo`
  }
  if (requires === 'test-container') {
    return (await is_listening(TEST_CONTAINER))
      ? null
      : `no test container on :${TEST_CONTAINER.port} — run \`yarn test:db:up\``
  }
  if (requires === 'production-tunnel') {
    return (await is_listening(PRODUCTION_TUNNEL))
      ? null
      : `no production tunnel on :${PRODUCTION_TUNNEL.port} — bring up \`base db\``
  }
  if (requires === 'user-base-prose') {
    return find_user_base_prose_root()
      ? null
      : `no ${USER_BASE_PROSE_MARKER} above this checkout — the corpus lives in user-base, so this gate is unrunnable on a CI runner`
  }
  throw new Error(`unknown prerequisite: ${requires}`)
}

const run_gate = ({ gate, base_ref }) => {
  const command =
    gate.requires === 'base-ref'
      ? [...gate.command, '--base', base_ref]
      : gate.command

  const result = spawnSync('node', command, {
    cwd: repo_root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env:
      gate.requires === 'production-tunnel'
        ? pinned_env(PRODUCTION_ENV)
        : gate.requires === 'test-container'
          ? pinned_env(TEST_CONTAINER_ENV)
          : process.env
  })

  // A spawn that never produced a process is a tooling error, not a finding.
  if (result.error) {
    return { exit_code: -1, output: String(result.error.message) }
  }

  return {
    exit_code: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`
  }
}

/**
 * Runs on EVERY invocation rather than behind a flag, for the same reason the
 * gates' own controls do: the failure this runner exists to catch is a green it
 * cannot go red on. Each case asserts the verdict rule reports a specific
 * failure, and a case that stops failing fails the run.
 */
const CONTROLS = [
  {
    label: 'a declared control that printed no block is BLIND',
    input: { exit_code: 0, output: 'GATE OK', declares_negative_control: true },
    expect: 'BLIND'
  },
  {
    label: 'a declared control reporting STAYED GREEN is BLIND',
    input: {
      exit_code: 0,
      output: 'NEGATIVE CONTROL\n  STAYED GREEN  x\nGATE OK',
      declares_negative_control: true
    },
    expect: 'BLIND'
  },
  {
    label: 'a blind gate outranks its own exit 0',
    input: { exit_code: 0, output: '', declares_negative_control: true },
    expect: 'BLIND'
  },
  {
    label: 'exit 1 is a finding',
    input: { exit_code: 1, output: '', declares_negative_control: false },
    expect: 'FINDINGS'
  },
  {
    label: 'exit 2 is a tooling error, not a finding',
    input: { exit_code: 2, output: '', declares_negative_control: false },
    expect: 'TOOLING ERROR'
  },
  {
    label: 'a passing declared control still reports the gate verdict',
    input: {
      exit_code: 0,
      output: 'NEGATIVE CONTROL\n  RED as expected  x\nGATE OK',
      declares_negative_control: true
    },
    expect: 'OK'
  },
  // The next three carry the ts-check-ratchet regression as a PAIR, and their
  // strings are written out longhand rather than built from the imported marker
  // -- a control that shares a constant with the code it drives cannot see that
  // constant move, which is the whole failure being pinned here.
  {
    label: "the ts-check ratchet's real control block is OK, not BLIND",
    input: {
      exit_code: 0,
      output:
        'ts-check adoption: 34 file(s) checked\nNEGATIVE CONTROL\n  RED as expected  a listed file losing its pragma is reported\nGATE OK',
      declares_negative_control: true
    },
    expect: 'OK'
  },
  {
    label:
      'controls printed under a gate-private spelling, with no declared header, are still BLIND',
    input: {
      exit_code: 0,
      output:
        'ts-check adoption: 34 file(s) checked\n  CONTROL WENT RED: a listed file losing its pragma is reported\nGATE OK',
      declares_negative_control: true
    },
    expect: 'BLIND'
  },
  {
    label: 'a ts-check-shaped block whose control did not fire is BLIND',
    input: {
      exit_code: 0,
      output:
        'ts-check adoption: 34 file(s) checked\nNEGATIVE CONTROL\n  STAYED GREEN  a listed file losing its pragma is reported\nGATE OK',
      declares_negative_control: true
    },
    expect: 'BLIND'
  },
  {
    label: 'exit 0 over an incomplete corpus is not a plain OK',
    input: {
      exit_code: 0,
      output: `CORPUS\n  MISSING  private\n\n  ${CORPUS_INCOMPLETE_MARKER} -- not scanned: private\nGATE OK`,
      declares_negative_control: false
    },
    expect: 'OK (PARTIAL)'
  },
  {
    label: 'a complete corpus block is still a plain OK',
    input: {
      exit_code: 0,
      output: 'CORPUS\n  scanned  scripts   211 files\nGATE OK',
      declares_negative_control: false
    },
    expect: 'OK'
  },
  {
    label: 'an incomplete corpus does not mask a finding',
    input: {
      exit_code: 1,
      output: `CORPUS\n  MISSING  private\n  ${CORPUS_INCOMPLETE_MARKER} -- not scanned: private`,
      declares_negative_control: false
    },
    expect: 'FINDINGS'
  }
]

const run_controls = () => {
  const failures = []
  for (const control of CONTROLS) {
    const { verdict } = evaluate_gate_result(control.input)
    const passed = verdict === control.expect
    console.log(
      `  ${passed ? 'held' : 'FAILED'}  ${control.label} (${verdict})`
    )
    if (!passed) failures.push(control.label)
  }
  return failures
}

const parse_argv = (argv) => {
  const base_index = argv.indexOf('--base')
  return {
    list: argv.includes('--list'),
    base_ref: base_index === -1 ? null : argv[base_index + 1]
  }
}

const main = async () => {
  const { list, base_ref } = parse_argv(process.argv.slice(2))

  if (list) {
    for (const gate of GATES) {
      console.log(`${gate.id}\n  requires ${gate.requires}\n  ${gate.oracle}`)
    }
    return 0
  }

  console.log('RUNNER CONTROL')
  const control_failures = run_controls()
  console.log('')

  const rows = []
  for (const gate of GATES) {
    const missing = await missing_prerequisite({
      requires: gate.requires,
      base_ref
    })

    if (missing) {
      console.log(`SKIP  ${gate.id} — ${missing}`)
      rows.push({ gate, verdict: 'SKIPPED', detail: missing })
      continue
    }

    process.stdout.write(`run   ${gate.id} ... `)
    const { exit_code, output } = run_gate({ gate, base_ref })
    const { verdict, detail } = evaluate_gate_result({
      exit_code,
      output,
      declares_negative_control: gate.negative_control
    })
    console.log(verdict)
    rows.push({ gate, verdict, detail, output })
  }

  console.log('\nGATE                             CONTROL   VERDICT')
  for (const row of rows) {
    const control = row.gate.negative_control ? 'declared' : 'none    '
    console.log(
      `${row.gate.id.padEnd(32)} ${control}  ${row.verdict}${
        row.detail ? `  (${row.detail})` : ''
      }`
    )
  }

  const blind = rows.filter((row) => row.verdict === 'BLIND')
  const findings = rows.filter((row) => row.verdict === 'FINDINGS')
  const errored = rows.filter((row) => row.verdict === 'TOOLING ERROR')
  const skipped = rows.filter((row) => row.verdict === 'SKIPPED')
  const uncontrolled = rows.filter(
    (row) => !row.gate.negative_control && row.verdict !== 'SKIPPED'
  )

  for (const row of [...findings, ...errored, ...blind]) {
    console.log(`\n--- ${row.gate.id} ---\n${row.output}`)
  }

  console.log(
    `\n${rows.length} gate(s): ${
      rows.filter((row) => row.verdict === 'OK').length
    } OK, ${findings.length} with findings, ${errored.length} tooling error(s), ${
      blind.length
    } blind, ${skipped.length} skipped.`
  )

  if (uncontrolled.length) {
    console.log(
      `\n${uncontrolled.length} gate(s) ran with NO negative control, so their green is unproven:\n  ` +
        uncontrolled.map((row) => row.gate.id).join('\n  ')
    )
  }

  if (skipped.length) {
    console.log(
      '\nA skipped gate is not a passed gate. Bring up what it needs and re-run before calling a cluster done.'
    )
  }

  if (control_failures.length) {
    console.error(
      `\nRUNNER CONTROL FAILED: ${control_failures.length} case(s) did not report as expected. ` +
        'This runner cannot be trusted until they do.'
    )
    return 2
  }

  if (blind.length) {
    console.error(
      '\nFAIL: a gate that declares a negative control did not prove it can report.'
    )
    return 1
  }

  if (errored.length) {
    console.error('\nFAIL: a gate could not run. Its surface is unchecked.')
    return 2
  }

  if (findings.length) {
    console.error('\nFAIL: at least one gate reported findings.')
    return 1
  }

  console.log('\nCLUSTER GATES OK')
  return 0
}

process.exit(await main())
