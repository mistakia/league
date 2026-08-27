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

  // Used to assert null. The walk now crosses the season boundary backwards,
  // because stopping here truncated every `last_n_nfl_weeks` list to a single
  // week for the whole offseason and all of live REG week 1.
  it('REG week 1 offset -1 crosses into the prior season POST week 4', function () {
    set_date_for_week({ seas_type: 'REG', week: 1 })
    const current = current_nfl_week_params()
    const prior = nfl_week_offset_params({ offset: -1 })
    expect(prior.year).to.equal(current.year - 1)
    expect(prior.seas_type).to.equal('POST')
    expect(prior.week).to.equal(4)
  })

  it('floors at MIN_YEAR rather than walking below it', function () {
    set_date_for_week({ seas_type: 'REG', week: 1 })
    const { year } = current_nfl_week_params()
    // Every REG week of every season back to MIN_YEAR, plus the POST weeks
    // between them, is far fewer steps than this.
    const steps = (year - 2000 + 1) * 30
    expect(nfl_week_offset_params({ offset: -steps })).to.equal(null)
  })
})
