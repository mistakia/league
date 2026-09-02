/* global describe it */

import * as chai from 'chai'

import db from '#db'
import {
  get_data_view_results_query,
  load_data_view_test_queries_sync
} from '#libs-server'

const { expect } = chai

// Result-equivalence harness for data-view queries.
//
// The sibling SQL-snapshot harness (libs-server.data-view-queries.mjs) asserts
// the *generated SQL string*. That gates against accidental SQL drift but says
// nothing about whether a query returns the *right rows* -- a migration can
// produce different SQL that is still correct, or identical SQL that is wrong
// for a reason the snapshot can't see. This harness closes that gap: it seeds a
// known dataset, executes the data-view query against it, and asserts the
// executed result set matches an independent oracle. Migrations of the
// year_offset correlation / aggregate handling are the motivating case (an
// offset-year value, an AVG vs SUM reduction, a numerator/denominator
// recombination is only provable by running the query).
//
// A fixture opts in with a `result_equivalence` block:
//   {
//     "request": { ...data view request... },
//     "result_equivalence": {
//       "seed": ["INSERT ...", ...],      // rows inserted before the query
//       "reference_sql": "SELECT ...",     // independent oracle (live compare)
//       "expected_rows": [ { ... } ],      // OR a literal snapshot oracle
//       "compare_columns": ["adp_0"],      // project both sides before compare
//       "ignore_columns": ["pid"]          // or drop volatile columns
//     }
//   }
// Exactly one of reference_sql / expected_rows is the oracle. Everything runs
// inside a transaction that is always rolled back, so fixtures are isolated and
// leave the shared test database untouched.

const project = (row, { compare_columns, ignore_columns }) => {
  let keys = Object.keys(row)
  if (compare_columns && compare_columns.length) {
    keys = compare_columns
  } else if (ignore_columns && ignore_columns.length) {
    keys = keys.filter((k) => !ignore_columns.includes(k))
  }
  const out = {}
  for (const k of keys.sort()) {
    // Normalise numeric-like values (knex returns NUMERIC as strings, raw SQL
    // may return numbers) so the comparison is value-based, not type-based.
    const v = row[k]
    out[k] = v == null ? null : typeof v === 'number' ? String(v) : v
  }
  return out
}

const normalize_rows = (rows, opts) =>
  rows.map((r) => JSON.stringify(project(r, opts))).sort()

// `project` builds its key list from `compare_columns` WITHOUT checking that the
// row carries those keys, and `row[k]` for an absent key is `undefined`, which
// the null-normalisation below turns into `null`. So a compare_column that
// exists in NEITHER side compares null against null and the fixture passes while
// asserting nothing -- the exact vacuous green this corpus exists to catch, since
// its whole job is semantics that valid SQL gets wrong. A misspelled column id
// and a column the query stopped emitting are the same shape.
//
// The guard is per-SIDE and requires presence in at least one row of a NON-EMPTY
// row set. Presence in one executed row means presence in all of them (knex
// returns a uniform key set); on a literal `expected_rows` oracle a fixture may
// legitimately spell a null by omitting the key on some rows, so "at least one"
// is the honest threshold there. An empty row set is not checked, because it
// carries no keys to check against and its own vacuity is a different question
// than the one this guard answers.
const assert_compare_columns_present = ({
  rows,
  compare_columns,
  side,
  filename
}) => {
  if (!compare_columns || !compare_columns.length) return
  if (!rows.length) return
  const present = new Set()
  for (const row of rows) for (const key of Object.keys(row)) present.add(key)
  const missing = compare_columns.filter((c) => !present.has(c))
  if (missing.length) {
    throw new Error(
      `${filename}: compare_column(s) [${missing.join(', ')}] are absent from the ${side} row set, so comparing them asserts nothing. Present columns: [${[...present].sort().join(', ')}]`
    )
  }
}

// Kept in sync with the `pos` / `primary_position` values in the
// test/data-view-queries/*-result-equivalence.json seeds.
const SEED_ISOLATION_POSITION = 'MLB'

const get_fixtures = () =>
  load_data_view_test_queries_sync().filter((f) => f.result_equivalence)

describe('Data View', () => {
  describe('Result Equivalence', () => {
    const fixtures = get_fixtures()

    for (const fixture of fixtures) {
      it(fixture.name || fixture.filename, async function () {
        this.timeout(fixture.timeout_ms || 40000)
        const re = fixture.result_equivalence
        const has_reference = Boolean(re.reference_sql)
        const has_expected = Array.isArray(re.expected_rows)
        if (has_reference === has_expected) {
          throw new Error(
            `${fixture.filename}: result_equivalence needs exactly one of reference_sql / expected_rows`
          )
        }

        const trx = await db.transaction()
        try {
          // The seeds isolate themselves by giving their players a position no
          // shared fixture uses, then filtering the data view on it. That was
          // 'ZZ' until the position vocabulary became CHECK-constrained; MLB is
          // the one canonical value the shared fixtures leave free. Unlike 'ZZ'
          // it is a real position, so a future fixture could claim it and make
          // these tests wrong rather than red -- assert it stays free.
          const [{ count: mlb_fixture_players }] = await trx('player')
            .where({ primary_position: SEED_ISOLATION_POSITION })
            .whereNot('pid', 'like', 'TEST-%')
            .count()
          if (Number(mlb_fixture_players) > 0) {
            throw new Error(
              `result-equivalence seeds isolate on primary_position=${SEED_ISOLATION_POSITION}, but ${mlb_fixture_players} shared fixture player(s) now carry it. Pick another unused vocabulary member and update the fixtures' seed and request.`
            )
          }

          for (const stmt of re.seed || []) {
            await trx.raw(stmt)
          }

          const { query } = await get_data_view_results_query(fixture.request)
          const actual_rows = await query.transacting(trx)

          let oracle_rows
          if (has_reference) {
            const result = await trx.raw(re.reference_sql)
            oracle_rows = result.rows
          } else {
            oracle_rows = re.expected_rows
          }

          assert_compare_columns_present({
            rows: actual_rows,
            compare_columns: re.compare_columns,
            side: 'executed',
            filename: fixture.filename
          })
          assert_compare_columns_present({
            rows: oracle_rows,
            compare_columns: re.compare_columns,
            side: has_reference ? 'reference_sql' : 'expected_rows',
            filename: fixture.filename
          })

          expect(normalize_rows(actual_rows, re)).to.deep.equal(
            normalize_rows(oracle_rows, re),
            `${fixture.filename}: executed result set did not match the oracle`
          )
        } finally {
          await trx.rollback()
        }
      })
    }

    if (!fixtures.length) {
      it('has no result-equivalence fixtures (harness is wired and ready)', () => {
        expect(get_fixtures()).to.be.an('array')
      })
    }
  })
})
