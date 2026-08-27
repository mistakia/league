/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import {
  nfl_week_offset_params,
  current_nfl_week_params
} from '#libs-shared/nfl-week-identifier.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

describe('LIBS-SHARED nfl_week_offset_params', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('POST week 1 offset -1 returns REG era-max week', function () {
    set_date_for_week({ seas_type: 'POST', week: 1 })
    const current = current_nfl_week_params()
    expect(current.seas_type).to.equal('POST')
    expect(current.week).to.equal(1)
    const prior = nfl_week_offset_params({ offset: -1 })
    expect(prior.seas_type).to.equal('REG')
    expect(prior.week).to.be.at.least(17)
  })

  it('POST week 2 offset -1 returns POST week 1', function () {
    set_date_for_week({ seas_type: 'POST', week: 2 })
    const prior = nfl_week_offset_params({ offset: -1 })
    expect(prior.seas_type).to.equal('POST')
    expect(prior.week).to.equal(1)
  })

  it('REG week 2 offset -1 returns REG week 1', function () {
    set_date_for_week({ seas_type: 'REG', week: 2 })
    const prior = nfl_week_offset_params({ offset: -1 })
    expect(prior.seas_type).to.equal('REG')
    expect(prior.week).to.equal(1)
  })

  it('REG week 1 offset -1 returns null', function () {
    set_date_for_week({ seas_type: 'REG', week: 1 })
    const prior = nfl_week_offset_params({ offset: -1 })
    expect(prior).to.equal(null)
  })
})
