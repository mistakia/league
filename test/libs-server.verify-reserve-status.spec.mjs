/* global describe, before, beforeEach, afterEach, it */

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import verify_reserve_status from '#libs-server/verify-reserve-status.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_nfl_status
} from '#constants'
import { selectPlayer } from './utils/index.mjs'
import addPlayer from './utils/add-player.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

const league_id = 1
const team_id = 1
const user_id = 1

// A Wednesday in the regular season: past week 0, so the offseason allowance in
// isReserveEligible cannot make a player with no game_designation eligible, and
// before any final practice report exists.
const in_season_practice_day = () =>
  regular_season_start.clone().add('1', 'week').toISOString()

const place_player_on_reserve = async ({ practice_row }) => {
  const player = await selectPlayer()

  await addPlayer({
    leagueId: league_id,
    teamId: team_id,
    userId: user_id,
    player,
    slot: roster_slot_types.RESERVE_SHORT_TERM,
    transaction: transaction_types.RESERVE_IR,
    value: 2
  })

  // the only reserve signal is the practice report
  await knex('player')
    .update({
      roster_status: player_nfl_status.ACTIVE,
      game_designation: null
    })
    .where({ pid: player.pid })

  await knex('practice').where({ pid: player.pid }).del()
  await knex('practice').insert({
    pid: player.pid,
    week: current_season.week,
    season_year: current_season.year,
    season_type: 'REG',
    source_status: null,
    game_designation: null,
    ...practice_row
  })

  return player
}

describe('LIBS-SERVER verify_reserve_status - practice path', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(in_season_practice_day())
    await league(knex)
  })

  afterEach(function () {
    MockDate.reset()
  })

  it('clears a reserve player whose only signal is a DNP practice status', async function () {
    this.timeout(60 * 1000)
    await place_player_on_reserve({
      practice_row: { wednesday_practice_status: 'DNP' }
    })

    await verify_reserve_status({ team_id, league_id })
  })

  it('clears a reserve player whose only signal is an LP practice status', async function () {
    this.timeout(60 * 1000)
    await place_player_on_reserve({
      practice_row: { wednesday_practice_status: 'LP' }
    })

    await verify_reserve_status({ team_id, league_id })
  })

  it('rejects a reserve player practicing in full with no injury designation', async function () {
    this.timeout(60 * 1000)
    await place_player_on_reserve({
      practice_row: { wednesday_practice_status: 'FULL' }
    })

    let thrown = null
    try {
      await verify_reserve_status({ team_id, league_id })
    } catch (err) {
      thrown = err
    }

    expect(thrown).to.be.an('error')
    thrown.message.should.equal('Reserve player violation')
  })
})
