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
