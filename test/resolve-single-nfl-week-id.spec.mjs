/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

const expect = chai.expect
const {
  regular_season_start,
  nflFinalWeek,
  superBowlByeWeeks = 1
} = current_season

const set_date_for_week = ({ seas_type, week }) => {
  let offset
  if (seas_type === 'REG') offset = week
  else if (seas_type === 'POST')
    offset = nflFinalWeek + superBowlByeWeeks + week
  MockDate.set(regular_season_start.add(offset, 'week').toISOString())
}

describe('LIBS-SERVER resolve_single_nfl_week_id', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('empty params returns current identifier under REG', function () {
    set_date_for_week({ seas_type: 'REG', week: 3 })
    const id = resolve_single_nfl_week_id({ params: {} })
    expect(id).to.match(/_REG_WEEK_3$/)
  })

  it('empty params returns current identifier under POST', function () {
    set_date_for_week({ seas_type: 'POST', week: 2 })
    const id = resolve_single_nfl_week_id({ params: {} })
    expect(id).to.match(/_POST_WEEK_2$/)
  })

  it('dynamic_type current_nfl_week under POST returns POST identifier', function () {
    set_date_for_week({ seas_type: 'POST', week: 1 })
    const id = resolve_single_nfl_week_id({
      params: { single_nfl_week_id: { dynamic_type: 'current_nfl_week' } }
    })
    expect(id).to.match(/_POST_WEEK_1$/)
  })

  it('historical year+week without seas_type defaults to REG', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id({
      params: { year: 2020, week: 3 }
    })
    expect(id).to.equal('2020_REG_WEEK_3')
  })

  it('current year+week under POST resolves to POST seas_type', function () {
    set_date_for_week({ seas_type: 'POST', week: 2 })
    const id = resolve_single_nfl_week_id({
      params: {
        year: current_season.year,
        week: current_season.nfl_seas_week
      }
    })
    expect(id).to.match(/_POST_WEEK_2$/)
  })

  it('explicit seas_type is honored', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id({
      params: { year: 2024, week: 3, seas_type: 'POST' }
    })
    expect(id).to.equal('2024_POST_WEEK_3')
  })
})
