/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import resolve_single_nfl_week_id, {
  resolve_single_nfl_week_id_if_explicit
} from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

// Every assertion here was a SUFFIX regex (`/_REG_WEEK_3$/`) until 2026-08-27.
// The year was never pinned, and the year was the half that was wrong: the
// current week took it from the last completed season, so the whole offseason
// resolved to the prior year's week 1 and every one of these passed over it.
// Full-identifier equality only, and a preseason case alongside the REG and
// POST ones -- the offseason is the only period where the two anchors differ.
describe('LIBS-SERVER resolve_single_nfl_week_id', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('empty params returns the CURRENT season week in the offseason', function () {
    set_date_for_week({ seas_type: 'PRE', week: 0 })
    const id = resolve_single_nfl_week_id({ params: {} })
    expect(id).to.equal(`${current_season.year}_REG_WEEK_1`)
    // The defect, stated as its own assertion: this used to be the last
    // completed season's week 1.
    expect(
      id.startsWith(`${current_season.last_completed_season_year}_`)
    ).to.equal(false)
  })

  it('dynamic_type last_completed_nfl_week in the offseason returns the prior Super Bowl week', function () {
    set_date_for_week({ seas_type: 'PRE', week: 0 })
    const id = resolve_single_nfl_week_id({
      params: {
        single_nfl_week_id: { dynamic_type: 'last_completed_nfl_week' }
      }
    })
    expect(id).to.equal(`${current_season.year - 1}_POST_WEEK_4`)
  })

  it('dynamic_type current_nfl_week in the offseason returns the upcoming week 1', function () {
    set_date_for_week({ seas_type: 'PRE', week: 0 })
    const id = resolve_single_nfl_week_id({
      params: { single_nfl_week_id: { dynamic_type: 'current_nfl_week' } }
    })
    expect(id).to.equal(`${current_season.year}_REG_WEEK_1`)
  })

  it('empty params returns current identifier under REG', function () {
    set_date_for_week({ seas_type: 'REG', week: 3 })
    const id = resolve_single_nfl_week_id({ params: {} })
    expect(id).to.equal(`${current_season.year}_REG_WEEK_3`)
  })

  it('empty params returns current identifier under POST', function () {
    set_date_for_week({ seas_type: 'POST', week: 2 })
    const id = resolve_single_nfl_week_id({ params: {} })
    expect(id).to.equal(`${current_season.year}_POST_WEEK_2`)
  })

  it('dynamic_type current_nfl_week under POST returns POST identifier', function () {
    set_date_for_week({ seas_type: 'POST', week: 1 })
    const id = resolve_single_nfl_week_id({
      params: { single_nfl_week_id: { dynamic_type: 'current_nfl_week' } }
    })
    expect(id).to.equal(`${current_season.year}_POST_WEEK_1`)
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
    expect(id).to.equal(`${current_season.year}_POST_WEEK_2`)
  })

  it('year-only params for a past year returns REG era-max week', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id({ params: { year: 2020 } })
    expect(id).to.equal('2020_REG_WEEK_17')
  })

  it('year-only params for a current REG year returns current week', function () {
    set_date_for_week({ seas_type: 'REG', week: 4 })
    const id = resolve_single_nfl_week_id({
      params: { year: current_season.year }
    })
    expect(id).to.equal(`${current_season.year}_REG_WEEK_4`)
  })

  it('year-only params for a future year falls back to current identifier', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id({
      params: { year: current_season.year + 1 }
    })
    expect(id).to.equal(`${current_season.year}_REG_WEEK_5`)
  })

  it('explicit seas_type is honored', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id({
      params: { year: 2024, week: 3, seas_type: 'POST' }
    })
    expect(id).to.equal('2024_POST_WEEK_3')
  })
})

describe('LIBS-SERVER resolve_single_nfl_week_id_if_explicit', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('returns null when neither single_nfl_week_id nor nfl_week_id is set', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    expect(resolve_single_nfl_week_id_if_explicit({ params: {} })).to.equal(
      null
    )
  })

  it('returns null when nfl_week_id is an empty array', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    expect(
      resolve_single_nfl_week_id_if_explicit({ params: { nfl_week_id: [] } })
    ).to.equal(null)
  })

  it('returns null when single_nfl_week_id is an empty array', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    expect(
      resolve_single_nfl_week_id_if_explicit({
        params: { single_nfl_week_id: [] }
      })
    ).to.equal(null)
  })

  it('ignores year/week/seas_type without explicit week param', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    expect(
      resolve_single_nfl_week_id_if_explicit({
        params: { year: 2024, week: 3, seas_type: 'POST' }
      })
    ).to.equal(null)
  })

  it('resolves when single_nfl_week_id is a scalar', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id_if_explicit({
      params: { single_nfl_week_id: '2024_POST_WEEK_2' }
    })
    expect(id).to.equal('2024_POST_WEEK_2')
  })

  it('resolves when nfl_week_id is a non-empty array', function () {
    set_date_for_week({ seas_type: 'REG', week: 5 })
    const id = resolve_single_nfl_week_id_if_explicit({
      params: { nfl_week_id: ['2024_REG_WEEK_7'] }
    })
    expect(id).to.equal('2024_REG_WEEK_7')
  })

  it('resolves dynamic_type current_nfl_week when passed as single_nfl_week_id', function () {
    set_date_for_week({ seas_type: 'POST', week: 1 })
    const id = resolve_single_nfl_week_id_if_explicit({
      params: { single_nfl_week_id: { dynamic_type: 'current_nfl_week' } }
    })
    expect(id).to.equal(`${current_season.year}_POST_WEEK_1`)
  })
})
