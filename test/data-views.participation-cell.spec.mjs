/* global describe it */

import * as chai from 'chai'

import {
  render_participation_null,
  PARTICIPATION_STATUS
} from '#libs-shared/data-views/participation-cell.mjs'

const expect = chai.expect

describe('data-views participation cell helper', () => {
  it('renders active as 0 (played, recorded zero)', () => {
    expect(
      render_participation_null({
        participation_status: PARTICIPATION_STATUS.ACTIVE
      })
    ).to.equal('0')
  })

  it('renders bye as BYE', () => {
    expect(
      render_participation_null({
        participation_status: PARTICIPATION_STATUS.BYE
      })
    ).to.equal('BYE')
  })

  it('renders null / undefined / unknown status as blank', () => {
    expect(render_participation_null({ participation_status: null })).to.equal(
      ''
    )
    expect(
      render_participation_null({ participation_status: undefined })
    ).to.equal('')
    expect(
      render_participation_null({ participation_status: 'inactive' })
    ).to.equal('')
  })

  it('exposes the canonical status strings the server emits', () => {
    expect(PARTICIPATION_STATUS.ACTIVE).to.equal('active')
    expect(PARTICIPATION_STATUS.BYE).to.equal('bye')
  })
})
