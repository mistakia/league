/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import { identities } from '#libs-server/data-views/identities.mjs'

const expect = chai.expect

const known_identity_ids = new Set(Object.keys(identities))

// Empty placeholder stubs in the aggregator that no code path references.
// They are not real column definitions and are excluded from the coverage
// assertion until they either gain implementations or get removed.
const COVERAGE_ALLOWLIST = new Set([
  'week_opponent_abbreviation',
  'week_opponent_points_allowed_over_average'
])

describe('data-views column-definition coverage', () => {
  it('every column carries granularity with known identity ids', () => {
    const missing = []
    const unknown = []
    for (const [column_id, def] of Object.entries(data_views_column_definitions)) {
      if (COVERAGE_ALLOWLIST.has(column_id)) continue
      if (!def || typeof def !== 'object') continue
      const granularity = def.granularity
      if (!Array.isArray(granularity) || granularity.length === 0) {
        missing.push(column_id)
        continue
      }
      for (const g of granularity) {
        if (!known_identity_ids.has(g)) unknown.push(`${column_id}: ${g}`)
      }
    }
    expect(missing, `columns missing granularity: ${missing.join(', ')}`).to.have.length(0)
    expect(unknown, `columns referencing unknown identity ids: ${unknown.join(', ')}`).to.have.length(0)
  })
})
