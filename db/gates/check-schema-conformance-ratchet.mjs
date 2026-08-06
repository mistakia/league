// Schema conformance ratchet for the league four-layer redesign.
//
// audit-schema-conformance.mjs is the oracle; this is the gate. The audit
// alone cannot be the CI gate because it is not zero yet (82 known violations
// as of 2026-07-29) and will not be zero for months -- a zero-gate would just
// get disabled. This wraps it in a ratchet: any violation NOT in the checked-in
// baseline fails the build, and any baselined violation that disappears from
// the schema passes silently, with no baseline edit required. Debt can only
// go down through CI; it can only go up through a reviewed baseline commit.
//
// Usage:
//   node db/gates/check-schema-conformance-ratchet.mjs              # check (CI mode)
//   node db/gates/check-schema-conformance-ratchet.mjs --rebaseline # regenerate baseline
//
// Exit non-zero if any violation is present that the baseline does not know
// about. Exit zero if every current violation is already baselined (whether
// or not the baseline also contains entries the schema no longer has -- those
// are stale-but-harmless and get pruned by the next --rebaseline).

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The audit lives in db/tools, not here, and that split is the point: it exits 1
// by design on standing debt, so it is an ORACLE and not a gate. This file is the
// gate -- it turns the oracle's output into a pass/fail against a checked-in
// baseline. See db/README.md for the boundary.
const audit_script = path.join(
  __dirname,
  '..',
  'tools',
  'audit-schema-conformance.mjs'
)
const baseline_path = path.join(__dirname, 'schema-conformance-baseline.json')

function key_of(finding) {
  return `${finding.table}.${finding.column || ''}::${finding.rule}`
}

function run_audit() {
  // audit-schema-conformance.mjs sets a non-zero exitCode whenever it finds
  // violations, which is the whole point of running it -- so a plain
  // execFileSync (which throws on non-zero exit) can't be used here.
  const result = spawnSync('node', [audit_script, '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  })
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `audit-schema-conformance.mjs exited ${result.status}: ${result.stderr}`
    )
  }
  return JSON.parse(result.stdout).findings
}

function load_baseline() {
  if (!fs.existsSync(baseline_path)) return []
  const parsed = JSON.parse(fs.readFileSync(baseline_path, 'utf8'))
  return parsed.violations
}

function sorted_violations(findings) {
  return findings
    .map((f) => ({
      table: f.table,
      column: f.column || null,
      rule: f.rule
    }))
    .sort((a, b) => key_of(a).localeCompare(key_of(b)))
}

function write_baseline(findings) {
  const violations = sorted_violations(findings)
  const payload = {
    note:
      'Checked-in ratchet baseline for db/tools/audit-schema-conformance.mjs, ' +
      'enforced by db/gates/check-schema-conformance-ratchet.mjs in CI. Regenerate ' +
      'with `node db/gates/check-schema-conformance-ratchet.mjs --rebaseline` -- never ' +
      'hand-edit. Clearing a violation needs no edit here; only a deliberate widening ' +
      'of the audit (a new rule, a broadened heuristic) should add entries.',
    generated_at: new Date().toISOString(),
    count: violations.length,
    violations
  }
  fs.writeFileSync(baseline_path, JSON.stringify(payload, null, 2) + '\n')
  return violations
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('rebaseline', {
      type: 'boolean',
      default: false,
      description:
        'Regenerate the baseline from the current schema instead of checking against it'
    })
    .help().argv

  const findings = run_audit()

  if (argv.rebaseline) {
    const violations = write_baseline(findings)
    console.log(
      `schema conformance ratchet -- wrote ${violations.length} violations to ${path.relative(process.cwd(), baseline_path)}`
    )
    return
  }

  const baseline = load_baseline()
  const baseline_keys = new Set(baseline.map(key_of))
  const current = sorted_violations(findings)
  const new_violations = current.filter((f) => !baseline_keys.has(key_of(f)))
  const cleared_count = baseline.filter(
    (f) => !current.some((c) => key_of(c) === key_of(f))
  ).length

  if (new_violations.length) {
    console.error(
      `schema conformance ratchet -- ${new_violations.length} violation(s) not in the baseline:\n`
    )
    for (const f of new_violations) {
      const loc = f.column ? `${f.table}.${f.column}` : `${f.table} (table)`
      console.error(`  [${f.rule}] ${loc}`)
    }
    console.error(
      '\nIf this is new debt (a feature added a non-conforming column/table): fix ' +
        'the name before merging -- see user:guideline/league/database-schema-standards.md.\n' +
        'If this is a deliberate audit widening (a new/broadened rule that legitimately ' +
        'surfaces existing debt): run ' +
        '`node db/gates/check-schema-conformance-ratchet.mjs --rebaseline` and commit the ' +
        'updated db/gates/schema-conformance-baseline.json alongside the audit change.'
    )
    process.exitCode = 1
    return
  }

  console.log(
    `schema conformance ratchet -- ${current.length} known violation(s), all baselined` +
      (cleared_count
        ? ` (${cleared_count} baselined violation(s) no longer present -- baseline is stale but harmless; run --rebaseline to prune)`
        : '') +
      '.'
  )
  process.exitCode = 0
}

main()
