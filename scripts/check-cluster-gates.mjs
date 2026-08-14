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
 * gate, so three of these run an always-on negative control and fail themselves
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

import net from 'net'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

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
    negative_control: false,
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
    negative_control: false,
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
  {
    id: 'dropped-table-consumers',
    command: ['db/gates/check-dropped-table-consumers.mjs'],
    requires: 'none',
    negative_control: false,
    oracle: 'each deliberately dropped table name has no surviving consumer'
  },
  {
    id: 'plays-column-repoint',
    command: ['db/gates/check-plays-column-repoint.mjs'],
    requires: 'none',
    negative_control: false,
    oracle:
      'consumer code vs a rename map — ANCHORED ON NINE HARDCODED TABLES, so a zero is a floor'
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
      'every statement bound to the league database — documented pairs, fenced SQL, and executable SQL from shell and /api/db/league/query — vs the schema'
  },
  {
    id: 'conflated-player-rows',
    command: ['db/gates/check-conflated-player-rows.mjs'],
    requires: 'production-tunnel',
    negative_control: false,
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
    if (!output.includes('NEGATIVE CONTROL')) {
      return {
        verdict: 'BLIND',
        detail: 'declares a negative control and printed none'
      }
    }
    if (output.includes('STAYED GREEN')) {
      return {
        verdict: 'BLIND',
        detail: 'a negative control STAYED GREEN — this gate cannot report'
      }
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
        ? { ...process.env, ...PRODUCTION_ENV }
        : gate.requires === 'test-container'
          ? { ...process.env, ...TEST_CONTAINER_ENV }
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
