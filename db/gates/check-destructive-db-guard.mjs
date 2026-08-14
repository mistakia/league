#!/usr/bin/env node
/**
 * Gate: no non-production config may name the production database, and every
 * destructive entrypoint must consult the target guard.
 *
 * This is the STATIC half of the two-layer control described in
 * db/guard-destructive-target.mjs. That module refuses at runtime, on the live
 * server's own current_database(); this gate refuses at review time, on the
 * files. They are independent on purpose -- the runtime guard cannot see a
 * config that was repointed at production, and this gate cannot see a target
 * resolved from an env override.
 *
 * Two checks:
 *
 *   GATE 1  config/config-{development,test}.json and config/config.sample.json
 *           must not name league_production, and must not name a non-loopback
 *           host. config-production.json is exempt and is not read (it is
 *           sops-encrypted at rest).
 *
 *   GATE 2  every file in DESTRUCTIVE_ENTRYPOINTS must import
 *           db/guard-destructive-target.mjs. The list is hand-maintained
 *           because there is no mechanical way to tell a destructive script
 *           from a read-only one; what keeps it honest is that a listed file
 *           which no longer exists is itself a finding, so the list cannot
 *           quietly go stale as files are renamed away.
 *
 * Both negative controls run on every invocation and a control that stays green
 * fails the run -- the discipline the rest of db/gates/ already keeps.
 *
 * Needs no database and no base ref, so it cannot go red on a sibling's
 * in-flight migration and is CI-eligible.
 *
 * usage: node db/gates/check-destructive-db-guard.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const gate_dir = dirname(fileURLToPath(import.meta.url))
const repo_root = join(gate_dir, '..', '..')

const GUARD_MODULE = 'db/guard-destructive-target.mjs'

// Configs that must never name production. config-production.json is absent by
// design: it is the one that SHOULD name it, and it is sops-encrypted anyway.
const NON_PRODUCTION_CONFIGS = [
  'config/config-development.json',
  'config/config-test.json',
  'config/config.sample.json'
]

const FORBIDDEN_DATABASES = ['league_production']

const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  '0:0:0:0:0:0:0:1'
])

// Files that can DROP, TRUNCATE, or restore over a database. Each must consult
// the guard. Add a file here when you add such a path; a listed file that no
// longer exists is reported, so renames cannot silently empty this list.
const DESTRUCTIVE_ENTRYPOINTS = [
  // Drops every table in the public schema of whatever #db resolved to. The
  // single chokepoint for the whole mocha suite, teardowns included.
  'test/global.mjs',
  // --drop drops and recreates, --truncate empties, --full pg_restores over.
  'scripts/restore-backup.mjs'
]

const read = (repo_relative_path) =>
  readFileSync(join(repo_root, repo_relative_path), 'utf8')

const check_configs = ({ source_overrides = {} } = {}) => {
  const findings = []

  for (const config_path of NON_PRODUCTION_CONFIGS) {
    if (!existsSync(join(repo_root, config_path))) {
      findings.push(`${config_path}: listed config does not exist`)
      continue
    }

    const raw = source_overrides[config_path] ?? read(config_path)
    const connection = JSON.parse(raw)?.postgres?.connection ?? {}

    if (FORBIDDEN_DATABASES.includes(connection.database)) {
      findings.push(
        `${config_path}: names the production database "${connection.database}"`
      )
    }

    if (connection.host && !LOOPBACK_HOSTS.has(String(connection.host))) {
      findings.push(`${config_path}: host "${connection.host}" is not loopback`)
    }
  }

  return findings
}

const check_entrypoints = ({ source_overrides = {} } = {}) => {
  const findings = []

  for (const entrypoint of DESTRUCTIVE_ENTRYPOINTS) {
    if (!existsSync(join(repo_root, entrypoint))) {
      findings.push(
        `${entrypoint}: listed destructive entrypoint does not exist -- ` +
          `remove it from DESTRUCTIVE_ENTRYPOINTS or fix the path`
      )
      continue
    }

    const source = source_overrides[entrypoint] ?? read(entrypoint)
    if (!source.includes('guard-destructive-target')) {
      findings.push(
        `${entrypoint}: does not import ${GUARD_MODULE}, so it can run its ` +
          `destructive statements against an unverified target`
      )
    }
  }

  return findings
}

// Each control mutates real corpus material and asserts the check reports it. A
// control that stays green means the check can no longer see its own subject.
const run_negative_controls = () => {
  const failures = []

  const production_config = JSON.stringify({
    postgres: {
      connection: { host: '127.0.0.1', database: 'league_production' }
    }
  })
  if (
    !check_configs({
      source_overrides: { 'config/config-test.json': production_config }
    }).some((finding) => finding.includes('league_production'))
  ) {
    failures.push(
      'control 1 STAYED GREEN: a config naming league_production was not reported'
    )
  }

  const remote_config = JSON.stringify({
    postgres: { connection: { host: '38.242.199.45', database: 'league_test' } }
  })
  if (
    !check_configs({
      source_overrides: { 'config/config-test.json': remote_config }
    }).some((finding) => finding.includes('not loopback'))
  ) {
    failures.push(
      'control 2 STAYED GREEN: a config on a non-loopback host was not reported'
    )
  }

  if (
    !check_entrypoints({
      source_overrides: { 'test/global.mjs': 'import knex from "#db"\n' }
    }).some((finding) => finding.includes('does not import'))
  ) {
    failures.push(
      'control 3 STAYED GREEN: an entrypoint with the guard import removed was ' +
        'not reported'
    )
  }

  return failures
}

const main = () => {
  const control_failures = run_negative_controls()
  const findings = [...check_configs(), ...check_entrypoints()]

  console.log(
    `checked ${NON_PRODUCTION_CONFIGS.length} non-production config(s) and ` +
      `${DESTRUCTIVE_ENTRYPOINTS.length} destructive entrypoint(s)`
  )
  // The literal "NEGATIVE CONTROL" is the marker scripts/check-cluster-gates.mjs
  // greps for to decide whether a gate DECLARING a control actually printed one.
  // Without it this gate read as BLIND through the runner -- "declares a
  // negative control and printed none" -- while its three controls were in fact
  // running and going red on every invocation.
  console.log('NEGATIVE CONTROL')
  console.log(`  ${3 - control_failures.length}/3 went red`)

  for (const failure of control_failures) console.error(`  ${failure}`)
  for (const finding of findings) console.error(`  FINDING: ${finding}`)

  if (control_failures.length || findings.length) {
    console.error(
      `GATE FAIL: ${findings.length} finding(s), ` +
        `${control_failures.length} control failure(s)`
    )
    process.exit(1)
  }

  console.log('GATE OK')
}

main()

export { check_configs, check_entrypoints, DESTRUCTIVE_ENTRYPOINTS }
