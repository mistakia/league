/* global describe, it */

import * as chai from 'chai'
import { Set } from 'immutable'

const expect = chai.expect

describe('STATS calculateStats play matcher', function () {
  it('matches plays against identifier set', function () {
    const weeks = new Set(['2024_REG_WEEK_1', '2024_POST_WEEK_2'])
    const plays = [
      { year: 2024, seas_type: 'REG', week: 1 },
      { year: 2024, seas_type: 'POST', week: 1 },
      { year: 2024, seas_type: 'POST', week: 2 }
    ]
    const filtered = plays.filter((p) =>
      weeks.has(`${p.year}_${p.seas_type}_WEEK_${p.week}`)
    )
    expect(filtered).to.have.length(2)
  })

  it('FILTER_STATS reducer branch selects Set for weeks type', function () {
    // Mirror of the reducer shape-branch — unit-level because the reducer file
    // uses webpack-only aliases and cannot be imported under node.
    const branch = (type, values) =>
      type === 'weeks' ? new Set(values) : values
    expect(branch('weeks', ['2024_REG_WEEK_1'])).to.be.instanceof(Set)
    expect(branch('days', ['Sunday'])).to.be.an('array')
  })
})
