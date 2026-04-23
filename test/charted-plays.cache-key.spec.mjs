/* global describe, it */

import * as chai from 'chai'

const expect = chai.expect

const build_request_key = ({ years, seas_types }) =>
  `GET_CHARTED_PLAYS_${years.join('_')}_${[...seas_types].sort().join('_')}`

describe('CHARTED PLAYS cache key', function () {
  it('distinguishes REG-only and REG+POST for the same year set', function () {
    const key_reg = build_request_key({
      years: [2024],
      seas_types: ['REG']
    })
    const key_both = build_request_key({
      years: [2024],
      seas_types: ['REG', 'POST']
    })
    expect(key_reg).to.not.equal(key_both)
  })

  it('key is stable under seas_types permutation', function () {
    const a = build_request_key({
      years: [2024],
      seas_types: ['POST', 'REG']
    })
    const b = build_request_key({
      years: [2024],
      seas_types: ['REG', 'POST']
    })
    expect(a).to.equal(b)
  })
})
