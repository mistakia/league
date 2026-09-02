/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  get_auction_nomination_order,
  AUCTION_NOMINATION_ORDER_TIERS
} from '#libs-server/auction-nomination-order.mjs'
import getLeague from '#libs-server/get-league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE ORDER MUST DEGRADE RATHER THAN FAIL. Its only consumer is live-mode
// auto-nomination on timer expiry, and a nomination timer that expires into
// nothing is exactly today's behavior -- it advances the auction not at all. A
// degenerate order that terminates the auction beats that, so the tier in force
// is part of the answer rather than a detail.
describe('auction nomination order', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    // Format-scoped rather than league-scoped, so the shared league reset does
    // not clear it and one test's seeded values would decide the next test's
    // tier.
    await knex('league_format_player_season_projection_values')
      .where({ season_year })
      .del()
  })

  it('orders on the league format season value when it is populated', async function () {
    this.timeout(60 * 1000)
    const league_row = await getLeague({ lid: league_id })
    expect(league_row.league_format_id, 'the fixture league has a format').to
      .exist

    const rostered = await knex('rosters_players')
      .where({ lid: league_id })
      .pluck('pid')

    const candidates = await knex('player')
      .whereNotIn('pid', rostered.length ? rostered : [''])
      .orderBy('pid')
      .limit(3)
    expect(candidates, 'three unrostered players').to.have.length(3)

    // Deliberately inverted against pid order, so an order that happened to fall
    // out of the primary key cannot pass this.
    const values = [5, 90, 40]
    for (let index = 0; index < candidates.length; index += 1) {
      await knex('league_format_player_season_projection_values').insert({
        pid: candidates[index].pid,
        league_format_id: league_row.league_format_id,
        season_year,
        projected_points_added_positive: values[index]
      })
    }

    const { tier, players } = await get_auction_nomination_order({
      lid: league_id
    })

    expect(tier).to.equal(AUCTION_NOMINATION_ORDER_TIERS.FORMAT_SEASON_VALUE)
    expect(players[0].pid).to.equal(candidates[1].pid)
    expect(players[1].pid).to.equal(candidates[2].pid)
    expect(players[2].pid).to.equal(candidates[0].pid)
  })

  it('excludes rostered players', async function () {
    this.timeout(60 * 1000)
    const league_row = await getLeague({ lid: league_id })
    // The shared league fixture builds roster CONTAINERS and no roster players,
    // so the excluded player is placed here rather than assumed.
    const roster = await knex('rosters')
      .where({ lid: league_id, season_year })
      .first()
    const [player] = await knex('player').orderBy('pid').limit(1)
    await knex('rosters_players').insert({
      roster_id: roster.roster_id,
      slot: 0,
      player_position: player.primary_position,
      pid: player.pid,
      extensions: 0,
      tid: roster.tid,
      lid: league_id,
      season_year,
      week: roster.week
    })
    const rostered_pid = player.pid

    await knex('league_format_player_season_projection_values').insert({
      pid: rostered_pid,
      league_format_id: league_row.league_format_id,
      season_year,
      // The highest value in the league, so only the roster filter can keep it
      // out of first place.
      projected_points_added_positive: 999
    })

    const { players } = await get_auction_nomination_order({ lid: league_id })
    expect(players.map((player) => player.pid)).to.not.include(rostered_pid)
  })

  it('degrades to alphabetical rather than returning nothing', async function () {
    this.timeout(60 * 1000)
    // The fixture populates no projection source at all, which is the state the
    // fallback chain exists for.
    const { tier, players } = await get_auction_nomination_order({
      lid: league_id
    })

    expect(tier).to.equal(AUCTION_NOMINATION_ORDER_TIERS.ALPHABETICAL)
    expect(
      players.length,
      'a degenerate order still terminates the auction'
    ).to.be.above(0)

    const names = await knex('player')
      .whereIn(
        'pid',
        players.map((player) => player.pid)
      )
      .orderBy('last_name', 'asc')
      .orderBy('first_name', 'asc')
      .pluck('pid')
    expect(players[0].pid).to.equal(names[0])
  })
})
