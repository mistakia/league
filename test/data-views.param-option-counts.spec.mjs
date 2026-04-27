/* global describe it */

import * as chai from 'chai'

import { serialize_preset_value } from '#libs-shared'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'

chai.should()
const expect = chai.expect

describe('serialize_preset_value', function () {
  it('produces sorted-key signature', () => {
    expect(serialize_preset_value({ wr: 3, rb: 1, te: 1 })).to.equal(
      'rb:1,te:1,wr:3'
    )
  })

  it('is independent of input key order', () => {
    const a = serialize_preset_value({ rb: 1, te: 1, wr: 3 })
    const b = serialize_preset_value({ wr: 3, te: 1, rb: 1 })
    const c = serialize_preset_value({ te: 1, wr: 3, rb: 1 })
    expect(a).to.equal(b)
    expect(b).to.equal(c)
  })

  it('returns empty string for null/undefined/array input', () => {
    expect(serialize_preset_value(null)).to.equal('')
    expect(serialize_preset_value(undefined)).to.equal('')
    expect(serialize_preset_value([1, 2])).to.equal('')
  })

  it('matches existing get_stats_column_param_key serialization', () => {
    const value_object = { rb: 1, te: 1, wr: 3 }
    const sig = serialize_preset_value(value_object)
    const key = get_stats_column_param_key({
      params: { off_personnel: [value_object] }
    })
    expect(key).to.include(sig)
  })
})
