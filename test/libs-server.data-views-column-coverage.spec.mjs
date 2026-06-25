/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import { identities } from '#libs-server/data-views/identities.mjs'
import derive_granularity from '#libs-server/data-views/derive-granularity.mjs'
import derive_column_row_grains from '#libs-server/data-views/derive-column-row-grains.mjs'

const expect = chai.expect

const known_identity_ids = new Set(Object.keys(identities))
const known_row_grains = new Set(['player', 'team'])

describe('data-views column-definition coverage', () => {
  it('every column carries granularity with known identity ids', () => {
    const missing = []
    const unknown = []
    for (const [column_id, def] of Object.entries(
      data_views_column_definitions
    )) {
      if (!def || typeof def !== 'object') continue
      const granularity = derive_granularity(def)
      if (!granularity.length) {
        missing.push(column_id)
        continue
      }
      for (const g of granularity) {
        if (!known_identity_ids.has(g)) unknown.push(`${column_id}: ${g}`)
      }
    }
    expect(
      missing,
      `columns missing granularity: ${missing.join(', ')}`
    ).to.have.length(0)
    expect(
      unknown,
      `columns referencing unknown identity ids: ${unknown.join(', ')}`
    ).to.have.length(0)
  })

  // Every *_from_plays column scans nfl_plays, which carries a week dimension,
  // and its with/aggregator builder projects year AND week onto the stat CTE.
  // Such a column MUST declare source.supports_row_axes covering ['year','week'].
  // Without it, group_tables_by_supported_row_axes intersects the requested
  // row_axes against the grain identity's narrower row_axes (player_year ->
  // ['year'], team -> []), silently drops week, and the per-week rows collapse
  // to the season total repeated at every week. This is the class of bug that
  // commit 343f4cd3 fixed for the *-stats-from-plays columns but missed for
  // player_fantasy_points_from_plays. Asserting it statically catches every
  // current and future from-plays column at module load -- no per-column
  // fixture or database required.
  it('every *_from_plays column declares week split support', () => {
    const offenders = []
    for (const [column_id, def] of Object.entries(
      data_views_column_definitions
    )) {
      if (!def || typeof def !== 'object') continue
      if (!column_id.endsWith('_from_plays')) continue
      const supports_row_axes = def.source?.supports_row_axes
      const declares_week =
        Array.isArray(supports_row_axes) &&
        supports_row_axes.includes('year') &&
        supports_row_axes.includes('week')
      if (!declares_week) {
        offenders.push(
          `${column_id} (source.supports_row_axes=${JSON.stringify(supports_row_axes)})`
        )
      }
    }
    expect(
      offenders,
      `from-plays columns missing source.supports_row_axes ['year','week']: ${offenders.join(', ')}`
    ).to.have.length(0)
  })

  it('every column derives a non-empty subset of known row_grains', () => {
    const missing = []
    const unknown = []
    for (const [column_id, def] of Object.entries(
      data_views_column_definitions
    )) {
      if (!def || typeof def !== 'object') continue
      const row_grains = derive_column_row_grains(def)
      if (!row_grains.length) {
        missing.push(column_id)
        continue
      }
      for (const g of row_grains) {
        if (!known_row_grains.has(g)) unknown.push(`${column_id}: ${g}`)
      }
    }
    expect(
      missing,
      `columns missing row_grain declaration: ${missing.join(', ')}`
    ).to.have.length(0)
    expect(
      unknown,
      `columns referencing unknown row_grains: ${unknown.join(', ')}`
    ).to.have.length(0)
  })
})
