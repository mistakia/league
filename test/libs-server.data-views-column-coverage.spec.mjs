/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import { identities } from '#libs-server/data-views/identities.mjs'

const expect = chai.expect

const known_identity_ids = new Set(Object.keys(identities))

describe('data-views column-definition coverage', () => {
  it('every column carries granularity with known identity ids', () => {
    const missing = []
    const unknown = []
    for (const [column_id, def] of Object.entries(data_views_column_definitions)) {
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
