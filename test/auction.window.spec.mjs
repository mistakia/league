/* global describe before beforeEach it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'

import {
  AUCTION_MINIMUM_ELECTION_WINDOW_HOURS,
  current_season
} from '#constants'
import {
  calculate_auction_window,
  describe_auction_window,
  get_auction_spots_remaining,
  validate_auction_window
} from '#libs-server/validate-auction-window.mjs'

const expect = chai.expect

// The defaults the seasons columns carry.
const defaults = {
  auction_block_notice_minutes: 60,
  auction_final_block_pace_minutes: 2,
  auction_final_block_buffer_hours: 12
}

const window_of = (hours, overrides = {}) => {
  const period_start = dayjs('2026-09-01T00:00:00Z')
  return calculate_auction_window({
    period_start,
    period_end: period_start.add(hours * 60, 'minute'),
    spots_remaining: 69,
    ...defaults,
    ...overrides
  })
}

describe('auction window inequality', function () {
  it('requires 39.3 hours at the observed 2026 shape', function () {
    // 69 spots at 2 minutes is 2.3h, plus 1h notice, 12h buffer and a 24h
    // minimum election window.
    const result = window_of(100)

    expect(result.terms.spots_remaining).to.equal(69)
    expect(Math.round(result.required_hours * 10) / 10).to.equal(39.3)
  })

  it('passes the 2026 dates as configured', function () {
    // The live row: period start 2026-09-03T03:59:59Z, end 2026-09-08T02:00:00Z.
    // 118.0 hours against 39.3 required, which is why no date has to move.
    const result = calculate_auction_window({
      period_start: dayjs('2026-09-03T03:59:59Z'),
      period_end: dayjs('2026-09-08T02:00:00Z'),
      spots_remaining: 69,
      ...defaults
    })

    expect(result.is_valid).to.equal(true)
    expect(Math.round(result.available_hours)).to.equal(118)
  })

  it('fails the pre-collapse shape and names the shortfall', function () {
    // The KNOWN-BAD case, and the one that proves the gate goes red: measured
    // from the old scheduled auction start of 2026-09-06T16:00Z rather than the
    // period start, the window was 34.0 hours against 39.3 -- short by 5.3.
    const result = calculate_auction_window({
      period_start: dayjs('2026-09-06T16:00:00Z'),
      period_end: dayjs('2026-09-08T02:00:00Z'),
      spots_remaining: 69,
      ...defaults
    })

    expect(result.is_valid).to.equal(false)
    expect(Math.round(result.available_hours * 10) / 10).to.equal(34)
    expect(Math.round(result.shortfall_hours * 10) / 10).to.equal(5.3)
    expect(describe_auction_window(result)).to.include('SHORT by 5.3h')
  })

  it('reports each term so the operator can see which one to move', function () {
    const message = describe_auction_window(window_of(10))

    expect(message).to.include('69 spots')
    expect(message).to.include('notice 1h')
    expect(message).to.include('buffer 12h')
    expect(message).to.include(
      `election window ${AUCTION_MINIMUM_ELECTION_WINDOW_HOURS}h`
    )
  })

  it('does not round a window short by minutes into a pass', function () {
    // 39.3 hours required; a window four minutes under it must fail rather than
    // rounding to 39.3 and passing.
    const required = window_of(1000).required_hours
    const just_under = window_of(required - 4 / 60)

    expect(just_under.is_valid).to.equal(false)
    expect(window_of(required).is_valid).to.equal(true)
  })

  it('grows the requirement with the board, not with the free agent pool', function () {
    // spots_remaining is unfilled ROSTER SPOTS. Sizing it against the ~395 free
    // agents carrying a projection instead would demand an extra eleven hours
    // and pull the final block absurdly early.
    const by_spots = window_of(100, { spots_remaining: 69 })
    const by_pool = window_of(100, { spots_remaining: 395 })

    expect(by_pool.required_hours - by_spots.required_hours).to.be.closeTo(
      ((395 - 69) * 2) / 60,
      0.001
    )
  })

  it('is satisfiable by moving any one term', function () {
    const short = calculate_auction_window({
      period_start: dayjs('2026-09-06T16:00:00Z'),
      period_end: dayjs('2026-09-08T02:00:00Z'),
      spots_remaining: 69,
      ...defaults
    })
    expect(short.is_valid).to.equal(false)

    // The buffer is the cheapest lever, and the one the operator holds.
    const with_smaller_buffer = calculate_auction_window({
      period_start: dayjs('2026-09-06T16:00:00Z'),
      period_end: dayjs('2026-09-08T02:00:00Z'),
      spots_remaining: 69,
      ...defaults,
      auction_final_block_buffer_hours: 6
    })
    expect(with_smaller_buffer.is_valid).to.equal(true)
  })
})

describe('auction window against a seeded league', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  it('falls by one when a roster spot is filled', async function () {
    // A BEHAVIORAL assertion rather than a bound. A literal ceiling would be a
    // bound on the fixture, not on the code, and reading the roster limit back
    // out of the season row to compute one gives NaN -- the slot counts arrive
    // through getLeague, which joins the league to the season. What actually
    // has to hold is that this tracks the board: every player signed is one
    // fewer the auction still has to place.
    const before = await get_auction_spots_remaining({ lid: 1 })
    expect(before).to.be.a('number')
    expect(before).to.be.at.least(1)

    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    await addPlayer({
      leagueId: 1,
      player,
      teamId: 1,
      userId: 1
    })

    expect(await get_auction_spots_remaining({ lid: 1 })).to.equal(before - 1)
  })

  it('refuses a league with no free agency period rather than passing it', async function () {
    // The seeded league carries no free_agency_period_start, which is now the
    // only thing that says a league HAS a free agency period. That must read as
    // invalid rather than as a zero-length window that trivially satisfies the
    // inequality.
    const result = await validate_auction_window({ lid: 1 })

    expect(result.is_valid).to.equal(false)
    expect(result.message).to.include('no free_agency_period_start')
  })

  it('validates a configured window end to end', async function () {
    // The live 2026 shape, written onto the seeded season so the DB path is
    // exercised rather than only the arithmetic.
    await knex('seasons')
      .where({ lid: 1, season_year: current_season.year })
      .update({
        free_agency_period_start: new Date('2026-09-03T03:59:59Z'),
        free_agency_period_end: new Date('2026-09-08T02:00:00Z')
      })

    const result = await validate_auction_window({ lid: 1 })

    expect(result.terms.spots_remaining).to.equal(
      await get_auction_spots_remaining({ lid: 1 })
    )
    expect(result.available_hours).to.be.closeTo(118, 0.1)
    expect(result.message).to.be.a('string')
  })
})
