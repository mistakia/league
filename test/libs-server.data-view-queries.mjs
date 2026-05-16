/* global describe it before */

import MockDate from 'mockdate'
import debug from 'debug'
import fs from 'node:fs'
import path from 'node:path'
import * as chai from 'chai'
import { fileURLToPath } from 'node:url'

import {
  get_data_view_results_query,
  load_data_view_test_queries_sync,
  process_expected_query
} from '#libs-server'
import { compare_queries } from './utils/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Source/bridge migration: byte-identical SQL is no longer the gate -- result
// equivalence is. Fixtures whose SQL shape intentionally changes set
// `skip_query_match: true`; the harness logs the diff to the working-tier slug
// for hand review and continues to assert metadata. Toggle SBA_LOG_SQL_DIFFS=0
// to silence the catalog write.
const SQL_DIFF_CATALOG_PATH = path.resolve(
  __dirname,
  '../../../../scratch/league/source-bridge-architecture/sql-diff-catalog.md'
)
const sql_diff_catalog_enabled = process.env.SBA_LOG_SQL_DIFFS !== '0'
let sql_diff_catalog_initialized = false

const log_sql_diff = (filename, actual, expected) => {
  if (!sql_diff_catalog_enabled) return
  try {
    if (!sql_diff_catalog_initialized) {
      fs.mkdirSync(path.dirname(SQL_DIFF_CATALOG_PATH), { recursive: true })
      fs.writeFileSync(
        SQL_DIFF_CATALOG_PATH,
        `# SQL diff catalog\n\nRun ${new Date().toISOString()}\n`
      )
      sql_diff_catalog_initialized = true
    }
    const entry =
      `\n## ${filename}\n\n` +
      '### actual\n```sql\n' +
      actual +
      '\n```\n\n### expected (legacy)\n```sql\n' +
      expected +
      '\n```\n'
    fs.appendFileSync(SQL_DIFF_CATALOG_PATH, entry)
  } catch {
    // best-effort logging; never fail the harness on catalog write errors
  }
}

const { expect } = chai

// Cache TTL constants - matching the original test files
const one_week = 1000 * 60 * 60 * 24 * 7
const twelve_hours = 43200000
const six_hours = 21600000
const one_hour = 3600000

// Map string names to actual values for easier JSON configuration
const cache_ttl_constants = {
  one_week,
  twelve_hours,
  six_hours,
  one_hour
}

// Load test cases synchronously at module level
const data_view_test_queries = load_data_view_test_queries_sync()
console.log(`\nLoaded ${data_view_test_queries.length} JSON test cases\n`)

describe('Data View', () => {
  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  describe('Data View Test Queries', () => {
    // Generate individual test cases for each JSON file
    for (const data_view_test_query of data_view_test_queries) {
      it(
        data_view_test_query.name || data_view_test_query.filename,
        async function () {
          // Set timeout from test case or default
          this.timeout(data_view_test_query.timeout_ms || 40000)

          try {
            // Generate query using the data view system
            const { query, data_view_metadata } =
              await get_data_view_results_query(data_view_test_query.request)
            const actual_query = query.toString()

            // Process the expected query to handle template literals
            const expected_query = process_expected_query(
              data_view_test_query.expected_query
            )

            // Source/bridge migration: fixtures whose SQL shape intentionally
            // diverges (orphan-CTE drops, direct team-subject joins, dispatcher
            // re-routed bridges) flag skip_query_match. The harness logs the
            // diff for hand review; result-set equivalence is gated by the
            // separate data-view-queries-result-equivalence.spec.mjs harness.
            if (data_view_test_query.skip_query_match) {
              if (actual_query !== expected_query) {
                log_sql_diff(
                  data_view_test_query.filename,
                  actual_query,
                  expected_query
                )
              }
            } else {
              compare_queries(actual_query, expected_query)
            }

            // Validate data_view_metadata if specified in test case
            if (data_view_test_query.expected_metadata) {
              const expected_metadata = data_view_test_query.expected_metadata

              // Check cache_ttl - support both numeric values and named constants
              if (expected_metadata.cache_ttl !== undefined) {
                const expected_cache_ttl =
                  typeof expected_metadata.cache_ttl === 'string'
                    ? cache_ttl_constants[expected_metadata.cache_ttl]
                    : expected_metadata.cache_ttl

                expect(data_view_metadata.cache_ttl).to.equal(
                  expected_cache_ttl
                )
              }

              // Check cache_expire_at
              if (expected_metadata.cache_expire_at !== undefined) {
                expect(data_view_metadata.cache_expire_at).to.equal(
                  expected_metadata.cache_expire_at
                )
              }
            }
          } catch (error) {
            // Provide cleaner error message with more context
            const clean_error = new Error(
              `${data_view_test_query.filename} failed: ${error.message}`
            )
            clean_error.original_error = error
            clean_error.test_case = data_view_test_query
            clean_error.stack = error.stack
            throw clean_error
          }
        }
      )
    }

    // Add a fallback test if no individual tests were created
    if (data_view_test_queries.length === 0) {
      it('should have test cases to run', function () {
        throw new Error(
          'No JSON test cases found in data-view-queries directory'
        )
      })
    }
  })

  describe('errors', () => {
    it('should throw an error if where value is missing', async () => {
      try {
        await get_data_view_results_query({
          prefix_columns: ['player_name'],
          columns: [
            {
              column_id: 'player_weighted_opportunity_rating_from_plays',
              params: {
                year: [2023]
              }
            },
            {
              column_id: 'player_bench_press'
            }
          ],
          where: [
            {
              column_id: 'player_position',
              operator: 'IN',
              value: ['WR']
            },
            {
              column_id: 'player_draft_position',
              operator: '=',
              value: ''
            }
          ],
          sort: [
            {
              column_id: 'player_weighted_opportunity_rating_from_plays',
              desc: true
            }
          ]
        })
      } catch (error) {
        expect(error.message).to.equal(
          "The 'where[1].value' field must be an alphanumeric string. (player_draft_position, =, )\nThe 'where[1].value' field must be a number. (player_draft_position, =, )\nThe 'where[1].value' field must be an array. (player_draft_position, =, )\nThe 'where[1].value' field must be an array. (player_draft_position, =, )"
        )
      }
    })
  })
})
