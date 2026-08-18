// Schema conformance ratchet for the league four-layer redesign.
//
// audit-schema-conformance.mjs is the oracle; this is the gate. The audit alone
// could not be the CI gate when this was written: it stood at 82 violations on
// 2026-07-29, and a zero-gate over standing debt just gets disabled. The debt
// has since been cleared and the baseline is empty, which does NOT make the
// ratchet redundant -- it is what keeps a future violation from being baselined
// by accident, and it is why the controls below matter more now, not less.
// This wraps the audit in a ratchet: any violation NOT in the checked-in
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
//
// NEGATIVE CONTROLS run on EVERY invocation and a control that does not hold
// fails the run, per the runner's rule. They matter more here than on a gate
// with standing findings, because the baseline reached ZERO on 2026-08-18: the
// ratchet now passes over an empty violation set and an empty baseline, so
// every green it prints is a green it produced by comparing nothing to nothing.
// An audit that silently stopped parsing -- a schema-format change, a broken
// rule table, a `--json` shape drift -- reads exactly like a fully-conformant
// schema from the outside.
//
// So the controls do not mutate a standing violation (there are none to
// mutate). They plant a violation in a copy of the REAL schema, at a REAL table
// and column the audit currently reads as clean, and drive the REAL audit and
// the REAL comparison over it. That makes the whole chain load-bearing: if the
// audit stops finding things, or stops being reachable, or its output shape
// moves, the planted violation goes missing and the control goes red.
//
// Two of the five run in the OVER-EAGER direction, because half of what a
// ratchet does is decide something is NOT new -- a comparison that reported
// every current violation as new would fail closed and be noticed, but one that
// suppressed too much fails in the direction that looks like success.

import fs from 'fs'
import os from 'os'
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
// The audit's own default input, read here only so the controls can plant a
// violation in a copy of it.
const schema_source_path = path.join(__dirname, '..', 'schema.postgres.sql')

function key_of(finding) {
  return `${finding.table}.${finding.column || ''}::${finding.rule}`
}

function run_audit({ schema_file } = {}) {
  // audit-schema-conformance.mjs sets a non-zero exitCode whenever it finds
  // violations, which is the whole point of running it -- so a plain
  // execFileSync (which throws on non-zero exit) can't be used here.
  const result = spawnSync(
    'node',
    [
      audit_script,
      '--json',
      ...(schema_file ? ['--schema-file', schema_file] : [])
    ],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    }
  )
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

/**
 * The whole ratchet verdict, as a pure function of the two inputs, so the
 * controls can drive it with a baseline they mutate rather than reimplementing
 * the comparison beside it. A control that restates the rule it is checking
 * proves only that the restatement agrees with itself.
 */
export const evaluate_ratchet = ({ findings, baseline }) => {
  const baseline_keys = new Set(baseline.map(key_of))
  const current = sorted_violations(findings)
  const new_violations = current.filter((f) => !baseline_keys.has(key_of(f)))
  const cleared_count = baseline.filter(
    (f) => !current.some((c) => key_of(c) === key_of(f))
  ).length
  return { current, new_violations, cleared_count }
}

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

// The planted name. Its capital letters make it a `quoted_camelcase` violation
// under a rule that tests the NAME rather than the dump's quoting, so the plant
// needs no type, default or constraint to be well-formed -- a rule keyed on
// anything richer would make the mutation itself the fragile part.
const CONTROL_COLUMN = 'zzzControlAbsentColumn'

// A real table and a real column the audit currently reads as CLEAN, so the
// plant is anchored in corpus material rather than in a fixture. Returns null
// when the schema yields no such column, which the runner below reports as NO
// MATERIAL and fails on -- an emptied or unparseable schema must not pass here
// by leaving the controls nothing to do.
const pick_conforming_column = ({ schema_sql, findings }) => {
  const flagged = new Set(findings.map((f) => `${f.table}.${f.column || ''}`))
  const table_re = /^CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);$/gm
  let table_match
  while ((table_match = table_re.exec(schema_sql)) !== null) {
    const [, table, body] = table_match
    const body_offset = table_match.index + table_match[0].indexOf(body)
    const column_re = /^ {4}(\w+) /gm
    let column_match
    while ((column_match = column_re.exec(body)) !== null) {
      const column = column_match[1]
      if (flagged.has(`${table}.${column}`)) continue
      return {
        table,
        column,
        // Offset of the NAME itself in the whole schema text. The mutation is
        // applied by offset, never by pattern: an ordinary column name recurs
        // in indexes, constraints and other tables, and a pattern rewrite would
        // plant violations the control is not aiming at.
        offset: body_offset + column_match.index + 4
      }
    }
  }
  return null
}

const plant_violation = ({ schema_sql, target }) =>
  schema_sql.slice(0, target.offset) +
  CONTROL_COLUMN +
  schema_sql.slice(target.offset + target.column.length)

/**
 * Five controls, run on EVERY invocation. Three assert the ratchet REPORTS,
 * two that it stays SILENT.
 *
 * All five read one planted violation produced by the real audit over a
 * mutated copy of the real schema. That single plant is what makes the audit
 * itself load-bearing; the baseline halves are then driven off it, since the
 * checked-in baseline is empty and carries no entry to mutate.
 */
const run_negative_controls = ({ baseline, findings }) => {
  const schema_sql = fs.readFileSync(schema_source_path, 'utf8')
  const target = pick_conforming_column({ schema_sql, findings })
  if (!target) {
    return [
      {
        name: 'a violation planted in the real schema is reported as new',
        result: 'NO MATERIAL',
        detail:
          'no clean CREATE TABLE column to plant on -- the schema may be empty or unparseable',
        passed: false
      }
    ]
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-control-'))
  const planted_path = path.join(directory, 'schema.postgres.sql')
  let planted_findings
  try {
    fs.writeFileSync(planted_path, plant_violation({ schema_sql, target }))
    planted_findings = run_audit({ schema_file: planted_path })
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }

  const planted = planted_findings.find(
    (finding) => finding.column === CONTROL_COLUMN
  )
  if (!planted) {
    return [
      {
        name: 'a violation planted in the real schema is reported as new',
        result: 'STAYED GREEN',
        detail:
          `planted ${target.table}.${CONTROL_COLUMN} and the audit did not ` +
          'flag it -- the oracle, not the ratchet, is what has stopped reporting',
        passed: false
      }
    ]
  }

  const planted_key = { table: planted.table, column: planted.column }
  // One planted name can trip more than one rule, and the baselining controls
  // have to cover EVERY entry it produced -- a partial baseline leaves a real
  // unbaselined violation behind and reads as a false positive.
  const planted_entries = planted_findings
    .filter((finding) => finding.column === CONTROL_COLUMN)
    .map((finding) => ({
      table: finding.table,
      column: finding.column,
      rule: finding.rule
    }))
  const cases = [
    {
      name: 'a violation planted in the real schema is reported as new',
      direction: 'must-report',
      findings: planted_findings,
      baseline,
      holds: (result) =>
        result.new_violations.some((f) => f.column === CONTROL_COLUMN)
    },
    {
      name: 'a baseline entry matching on table and column but NOT rule does not suppress it',
      direction: 'must-report',
      findings: planted_findings,
      baseline: [
        ...baseline,
        { ...planted_key, rule: 'zzz_control_other_rule' }
      ],
      holds: (result) =>
        result.new_violations.some((f) => f.column === CONTROL_COLUMN)
    },
    {
      name: 'a baseline entry matching on table and rule but NOT column does not suppress it',
      direction: 'must-report',
      findings: planted_findings,
      baseline: [
        ...baseline,
        {
          table: planted.table,
          column: 'zzz_control_other_column',
          rule: planted.rule
        }
      ],
      holds: (result) =>
        result.new_violations.some((f) => f.column === CONTROL_COLUMN)
    },
    {
      name: 'an exactly baselined violation is NOT reported as new',
      direction: 'must-stay-silent',
      findings: planted_findings,
      baseline: [...baseline, ...planted_entries],
      holds: (result) =>
        !result.new_violations.some((f) => f.column === CONTROL_COLUMN)
    },
    {
      // Cleared debt must pass with NO baseline edit. A ratchet that failed on
      // a stale baseline entry would make every repair a red build, which is
      // how a gate gets disabled rather than fixed.
      name: 'a baselined violation the schema no longer carries passes, counted as cleared',
      direction: 'must-stay-silent',
      findings,
      baseline: [...baseline, ...planted_entries],
      // Asserted on the planted key rather than on the total, so a real
      // unbaselined violation in the tree fails the GATE without also
      // corrupting the control into a second report of the same thing.
      holds: (result) =>
        result.cleared_count >= 1 &&
        !result.new_violations.some((f) => f.column === CONTROL_COLUMN)
    }
  ]

  return cases.map((control) => {
    const result = evaluate_ratchet({
      findings: control.findings,
      baseline: control.baseline
    })
    const passed = control.holds(result)
    return {
      name: control.name,
      result: passed
        ? control.direction === 'must-report'
          ? 'WENT RED'
          : 'STAYED SILENT'
        : control.direction === 'must-report'
          ? 'STAYED GREEN'
          : 'FALSE POSITIVE',
      detail: `${planted.table}.${CONTROL_COLUMN} [${planted.rule}]`,
      passed
    }
  })
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
  const { current, new_violations, cleared_count } = evaluate_ratchet({
    findings,
    baseline
  })

  const controls = run_negative_controls({ baseline, findings })
  const failed_controls = controls.filter((control) => !control.passed)
  console.log('NEGATIVE CONTROLS')
  for (const control of controls) {
    console.log(
      `  [${control.passed ? 'ok' : 'FAIL'}] ${control.result}  ${control.name}`
    )
    if (!control.passed) console.log(`      ${control.detail}`)
  }
  console.log('')

  if (failed_controls.length) {
    console.error(
      `schema conformance ratchet -- ${failed_controls.length} negative control(s) did not hold. ` +
        'This gate cannot prove it is able to report, so its verdict on the schema is worthless ' +
        'until they do.'
    )
    process.exitCode = 1
    return
  }

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
        'the name before merging -- see user:guideline/nfl/league/database-schema-standards.md.\n' +
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
