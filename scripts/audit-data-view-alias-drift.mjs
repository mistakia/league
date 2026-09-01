// Report golden fixtures whose stored table-alias hashes the current tree no
// longer reproduces.
//
// WHY THIS EXISTS. Both comparison paths -- `normalize_sql_for_comparison` in
// scripts/data-view-test-cli.mjs and test/utils/compare-queries.mjs -- rewrite
// every alias hash to a positional `table_0`, `table_1`, ... before comparing.
// That normalization is deliberate and worth keeping: it is what stops adding a
// column from reddening a hundred unrelated goldens. Its cost is that a change
// to what FEEDS an alias hash is invisible. A fixture can store an alias no
// code path will ever emit again and every suite stays green, which
// docs/create-data-view-test.md names as the one thing the goldens cannot
// catch. This script is the thing that looks.
//
// WHAT IT FOUND (2026-09-01, the sweep that motivated it). Seven of 256
// generable fixtures stored an unreproducible alias. Six of those were swept
// against 157 candidate blessing clocks, which split them in a way worth
// knowing:
//
//   2 were reproducible at any clock before 2026-09-03 -- ordinary residue from
//     before test/utils/golden-clock.mjs pinned the corpus, now frozen because
//     the pin instant sits later than their blessing date.
//   4 were reproducible at NO clock at all. Those are the interesting ones: the
//     alias INPUT changed in code and nothing could report it.
//
// So the seasonal-drift reading is right for a third of them and wrong for the
// rest. The clock half is already solved -- the pin is unconditional, so a
// fixture blessed today stays reproducible. The code half is not, and this
// script is the only thing that sees it.
//
// The seventh is its own lesson: it was INVISIBLE from the shared checkout,
// where a sibling's uncommitted edit to a column definition made it read as an
// ordinary red instead. Run this from a worktree pinned to the pushed ref when
// the tree is dirty, or the dirt decides what you find.
//
// DELIBERATELY NOT A GATE. It is not in `yarn check:cluster` and not in CI. A
// red master defers every session's push to this repo fleet-wide until it
// clears, and an alias hash moves legitimately during any column migration --
// so wiring this as a blocking gate would park unrelated work behind cosmetic
// churn on a routine day. Run it when you touch an alias input, and re-bless
// what it names.
//
// Usage:
//   NODE_ENV=test TZ=America/New_York node scripts/audit-data-view-alias-drift.mjs
//   ... --json                 machine-readable report on stdout
//
// Exits 1 when any fixture carries drift, 0 otherwise. 31 fixtures reach the
// database during query generation and are UNMEASURED without one; they are
// counted and named as such rather than folded into the clean total, because a
// blind spot reported as a pass is the failure this whole file is about.

import MockDate from 'mockdate'

import { GOLDEN_CLOCK } from '../test/utils/golden-clock.mjs'

MockDate.set(GOLDEN_CLOCK)

// Imported AFTER the clock is set, and dynamically for that reason: the season
// constants read the clock during module evaluation, so a static import here
// would bind them to the real date and every fixture would regenerate against
// an instant the corpus was never blessed at.
const {
  get_data_view_results_query,
  load_data_view_test_queries_sync,
  is_main
} = await import('#libs-server')
const compare_queries = (await import('../test/utils/compare-queries.mjs'))
  .default

// A table alias is `t` + 32 hex. It is frequently SUFFIXED (`..._markets`), and
// `_` is a word character -- so a trailing \b anchor silently fails to match
// exactly those, which is a false clean in the direction that looks like a pass.
// No trailing anchor for that reason.
const ALIAS = /t[0-9a-f]{32}/g

const normalize_aliases = (sql) => {
  const seen = new Map()
  return sql.replace(ALIAS, (h) => {
    if (!seen.has(h)) seen.set(h, `alias_${seen.size}`)
    return seen.get(h)
  })
}

const distinct_aliases = (sql) => [...new Set(sql.match(ALIAS) || [])].sort()

// The verification rule: show the instrument can report before trusting a clean
// run from it. Two controls, each pinning one direction of the normalization.
const self_check = () => {
  const a = `with "t${'0'.repeat(32)}_markets" as (select 1)`
  const b = `with "t${'1'.repeat(32)}_markets" as (select 1)`
  const failures = []
  if (normalize_aliases(a) !== normalize_aliases(b)) {
    failures.push('two differing aliases must normalize EQUAL (they did not)')
  }
  if (
    normalize_aliases(a) ===
    normalize_aliases(a.replace('select 1', 'select 2'))
  ) {
    failures.push('a real SQL change must normalize UNEQUAL (it did not)')
  }
  if (distinct_aliases(a).length !== 1) {
    failures.push('a suffixed alias must still be extracted (it was not)')
  }
  return failures
}

const main = async () => {
  const as_json = process.argv.includes('--json')

  const control_failures = self_check()
  if (control_failures.length) {
    console.error('SELF-CHECK FAILED -- this run cannot report:')
    control_failures.forEach((f) => console.error(`  ${f}`))
    process.exit(2)
  }

  const fixtures = load_data_view_test_queries_sync()
  const report = {
    loaded: fixtures.length,
    identical: 0,
    alias_drift: [],
    sql_differs: [],
    unmeasured: []
  }

  for (const fixture of fixtures) {
    const name = fixture.filename || fixture.name
    if (!fixture.expected_query || fixture.skip_query_match) continue

    let actual
    try {
      const { query } = await get_data_view_results_query(fixture.request)
      actual = query.toString()
    } catch (error) {
      report.unmeasured.push({ name, reason: error.message.slice(0, 80) })
      continue
    }

    if (actual === fixture.expected_query) {
      report.identical++
      continue
    }

    // Green under the suite's own comparator but not byte-identical means the
    // difference is confined to alias hashes -- exactly the invisible case.
    try {
      compare_queries(actual, fixture.expected_query)
    } catch {
      report.sql_differs.push(name)
      continue
    }

    report.alias_drift.push({
      name,
      stored: distinct_aliases(fixture.expected_query),
      current: distinct_aliases(actual)
    })
  }

  if (as_json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`fixtures loaded:        ${report.loaded}`)
    console.log(`byte-identical:         ${report.identical}`)
    console.log(`unmeasured (no db):     ${report.unmeasured.length}`)
    console.log(`sql differs beyond alias: ${report.sql_differs.length}`)
    console.log(`ALIAS DRIFT:            ${report.alias_drift.length}`)
    for (const drift of report.alias_drift) {
      console.log(`\n  ${drift.name}`)
      console.log(`    stored : ${drift.stored.join(' ')}`)
      console.log(`    current: ${drift.current.join(' ')}`)
    }
    for (const name of report.sql_differs) {
      console.log(`\n  [sql differs, not alias drift] ${name}`)
    }
  }

  // Both buckets are failures, and the exit code says so. `sql_differs` is the
  // golden spec's business rather than this script's, but a run that PRINTS a
  // problem and exits 0 is the exact shape a caller reads as clean.
  process.exit(report.alias_drift.length || report.sql_differs.length ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
