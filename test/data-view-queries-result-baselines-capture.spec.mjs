/* global describe it before */
//
// Captures result-set baseline hashes for every fixture under
// test/data-view-queries/. Wraps the dependency-injected engine in
// user-base/scratch/league/source-bridge-architecture/baseline-capture.mjs so
// the engine can live alongside the rest of the working-tier slug while still
// running through the league repo's seeded test DB bootstrap (test/global.mjs).
//
// Invocation:
//   yarn test --reporter min test/data-view-queries-result-baselines-capture.spec.mjs
//
// Output: writes the consolidated hashes to
//   scratch/league/source-bridge-architecture/baseline-result-hashes.json
// Promote step (separate task) copies that file to
//   test/data-view-queries-result-baselines.json
// once the captured hashes are reviewed.

import MockDate from 'mockdate'
import debug from 'debug'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  get_data_view_results_query,
  load_data_view_test_queries_sync
} from '#libs-server'

import { capture_all_baselines } from '../../../../scratch/league/source-bridge-architecture/baseline-capture.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const output_path = path.resolve(
  __dirname,
  '../../../../scratch/league/source-bridge-architecture/baseline-result-hashes.json'
)

const get_master_sha = () => {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

describe('Data View result-set baselines capture', function () {
  this.timeout(20 * 60 * 1000)

  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  it('captures row-set hashes for every fixture', async () => {
    const fixtures = load_data_view_test_queries_sync()
    if (!fixtures.length) {
      throw new Error('No fixtures discovered under test/data-view-queries/.')
    }

    const captured_against = get_master_sha()
    let completed = 0
    const results = await capture_all_baselines({
      fixtures,
      get_data_view_results_query,
      captured_against,
      on_progress: (key, entry) => {
        completed += 1
        const tag = entry.error
          ? `ERROR (${entry.error})`
          : `${entry.row_count} rows / hash ${entry.row_hash.slice(0, 12)}${
              entry.seed_sparse ? ' [seed_sparse]' : ''
            }`
        console.log(`  [${completed}/${fixtures.length}] ${key} -> ${tag}`)
      }
    })

    const payload = {
      version: 1,
      captured_against,
      captured_at: new Date().toISOString(),
      fixture_count: fixtures.length,
      results
    }
    await fs.mkdir(path.dirname(output_path), { recursive: true })
    await fs.writeFile(output_path, JSON.stringify(payload, null, 2) + '\n')

    const errors = Object.entries(results).filter(([, v]) => v.error)
    const sparse = Object.entries(results).filter(
      ([, v]) => v.seed_sparse && !v.error
    )
    console.log(
      `\nBaseline capture: ${fixtures.length} fixtures, ${errors.length} errors, ${sparse.length} seed-sparse.\nWrote ${output_path}`
    )
  })
})
