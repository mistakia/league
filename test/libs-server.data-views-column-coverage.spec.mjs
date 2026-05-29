/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import { identities } from '#libs-server/data-views/identities.mjs'
import derive_granularity from '#libs-server/data-views/derive-granularity.mjs'
import derive_column_subjects from '#libs-server/data-views/derive-column-subjects.mjs'

const expect = chai.expect

const known_identity_ids = new Set(Object.keys(identities))
const known_subjects = new Set(['player', 'team'])

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

  it('every column derives a non-empty subset of known subjects', () => {
    const missing = []
    const unknown = []
    for (const [column_id, def] of Object.entries(
      data_views_column_definitions
    )) {
      if (!def || typeof def !== 'object') continue
      const subjects = derive_column_subjects(def)
      if (!subjects.length) {
        missing.push(column_id)
        continue
      }
      for (const s of subjects) {
        if (!known_subjects.has(s)) unknown.push(`${column_id}: ${s}`)
      }
    }
    expect(
      missing,
      `columns missing subject declaration: ${missing.join(', ')}`
    ).to.have.length(0)
    expect(
      unknown,
      `columns referencing unknown subjects: ${unknown.join(', ')}`
    ).to.have.length(0)
  })
})
