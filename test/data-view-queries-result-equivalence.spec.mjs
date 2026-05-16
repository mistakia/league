/* global describe it before */
//
// Result-set equivalence harness for the source/bridge migration. For each
// fixture under test/data-view-queries/, runs the pipeline against the seeded
// test DB, hashes the rows, and asserts the hash matches the recorded baseline
// in test/data-view-queries-result-baselines.json.
//
// Sparse fixtures (row_count === 0 at baseline capture) are gated only on
// remaining sparse -- production-replay fingerprint check happens in the
// pre-merge perf gate, not here.

import MockDate from 'mockdate'
import debug from 'debug'
import fs from 'node:fs'
import path from 'node:path'
import * as chai from 'chai'
import { fileURLToPath } from 'node:url'

import {
  get_data_view_results_query,
  load_data_view_test_queries_sync
} from '#libs-server'

import { capture_fixture_baseline } from '../../../../scratch/league/source-bridge-architecture/baseline-capture.mjs'

const { expect } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baselines_path = path.resolve(
  __dirname,
  'data-view-queries-result-baselines.json'
)

const load_baselines = () => {
  if (!fs.existsSync(baselines_path)) return null
  return JSON.parse(fs.readFileSync(baselines_path, 'utf8'))
}

describe('Data View result-set equivalence', function () {
  this.timeout(20 * 60 * 1000)

  const baselines = load_baselines()
  const fixtures = load_data_view_test_queries_sync()

  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  if (!baselines) {
    it('baselines file is missing', function () {
      throw new Error(
        `Baselines not found at ${baselines_path}. Run the baseline-capture spec and the promote-baselines task before this harness can gate commits.`
      )
    })
    return
  }

  for (const fixture of fixtures) {
    const key = fixture.filename
    it(key, async function () {
      this.timeout(fixture.timeout_ms || 60000)

      const baseline = baselines.results[key]
      if (!baseline) {
        throw new Error(
          `No baseline recorded for ${key}. Re-run baseline-capture if the fixture set changed.`
        )
      }
      if (baseline.error) {
        // Baseline itself errored at capture time. Skip until the underlying
        // issue is fixed; do not let it silently green migration commits.
        this.skip()
        return
      }

      const captured = await capture_fixture_baseline({
        fixture,
        get_data_view_results_query,
        captured_against: 'equivalence-check'
      })

      if (captured.error) {
        throw new Error(
          `Pipeline threw for ${key}: ${captured.error}`
        )
      }

      if (baseline.seed_sparse) {
        // Seed-sparse fixtures: assert we still produce 0 rows; production
        // replay fingerprint check is the pre-merge perf gate.
        expect(captured.row_count).to.equal(
          0,
          `${key}: seed_sparse baseline now returns ${captured.row_count} rows`
        )
        return
      }

      expect(captured.row_count).to.equal(
        baseline.row_count,
        `${key}: row count diverged`
      )
      expect(captured.column_count).to.equal(
        baseline.column_count,
        `${key}: column count diverged`
      )
      expect(captured.row_hash).to.equal(
        baseline.row_hash,
        `${key}: row hash diverged (column ordering ignored)`
      )
    })
  }
})
