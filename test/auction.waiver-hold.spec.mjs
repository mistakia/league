/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  is_auction_complete,
  may_process_free_agency_waivers,
  get_auction_spots_remaining
} from '#libs-server/auction-completion.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

describe('waivers hold until the auction completes', function () {
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

  const open_period = async () =>
    knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })

  const close_period = async () =>
    knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(6, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start
          .subtract(3, 'months')
          .toDate()
      })

  it('holds waivers mid-period while roster spots remain', async function () {
    // THE RED CASE, and it is the behavior that shipped: clock inside the free
    // agency period, rotation unexhausted, and the runner processed anyway.
    // Under the old shape the period start meant "the auction is imminent" and
    // waivers began the day after a point-in-time auction; now the period start
    // IS the auction start, so the same condition ran waivers at 3pm every day
    // OF the auction.
    await open_period()

    expect(await get_auction_spots_remaining({ lid: league_id })).to.be.above(0)
    expect(await is_auction_complete({ lid: league_id })).to.equal(false)
    expect(await may_process_free_agency_waivers({ lid: league_id })).to.equal(
      false
    )
  })

  it('is complete once no active spot remains', async function () {
    // The "spots exhausted" leg, reached without filling 204 roster spots --
    // an earlier version tried to and exhausted selectPlayer's position pool,
    // which tested the fixture's depth rather than the derivation.
    //
    // A league with a season but no teams has zero unfilled spots, which is
    // exactly the state an exhausted nomination rotation produces: the socket's
    // rotation walk returns null when no team has active roster space.
    const empty_lid = 97
    await knex('leagues').insert({
      league_id: empty_lid,
      name: 'spots exhausted',
      commissioner_user_id: 1
    })

    // Copied from league 1 rather than hand-built: `seasons` carries a wide set
    // of NOT NULL configuration columns, and enumerating them here would make
    // this spec fail the next time one is added.
    const [source_season] = await knex('seasons').where({
      lid: league_id,
      season_year
    })
    await knex('seasons').insert({
      ...source_season,
      lid: empty_lid,
      free_agency_period_start: current_season.regular_season_start
        .subtract(2, 'months')
        .toDate(),
      free_agency_period_end: current_season.regular_season_start.toDate()
    })

    expect(await get_auction_spots_remaining({ lid: empty_lid })).to.equal(0)
    expect(await is_auction_complete({ lid: empty_lid })).to.equal(true)
    expect(await may_process_free_agency_waivers({ lid: empty_lid })).to.equal(
      true
    )
  })

  it('opens waivers at the period end even with spots unfilled', async function () {
    // THE BACKSTOP. If one team never fills its last spot the rotation never
    // exhausts, so completion cannot be the only condition or waivers would
    // never open at all.
    await close_period()

    expect(await get_auction_spots_remaining({ lid: league_id })).to.be.above(0)
    expect(await is_auction_complete({ lid: league_id })).to.equal(true)
  })

  it('does not open waivers before the period starts', async function () {
    // The control on the other side. Without it, "holds during the auction"
    // would be satisfied by a gate that simply never opens.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(1, 'week')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })

    expect(await may_process_free_agency_waivers({ lid: league_id })).to.equal(
      false
    )
  })

  it('treats a league with no free agency period as having no auction to wait on', async function () {
    await knex('seasons').where({ lid: league_id, season_year }).update({
      free_agency_period_start: null,
      free_agency_period_end: null
    })

    expect(await is_auction_complete({ lid: league_id })).to.equal(true)
    // ...but there is no free agency, so its waivers still do not run.
    expect(await may_process_free_agency_waivers({ lid: league_id })).to.equal(
      false
    )
  })
})
