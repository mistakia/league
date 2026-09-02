/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { getRoster, get_laegue_rosters_from_database } from '#libs-server'
import { current_season } from '#constants'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1

// THE SALARY IN FORCE, resolved the same way by every reader.
//
// `rosters_players` carries no value column, so a rostered player's salary is
// whichever `transactions` row is in force at the roster's snapshot. That rule
// was implemented three times and repaired once: get-roster.mjs was fixed and
// gated, while get-league-rosters-from-database.mjs (which serves the SPA's
// whole roster payload) and scripts/calculate-franchise-tag.mjs kept an even
// weaker form -- a bare `max(transaction_id)` with no as-of bound and no
// `occurred_at` ordering.
//
// WHY IT SURVIVED: transaction ids are insertion order, which normally agrees
// with chronology, so the two rules return the same row on ordinary data and the
// weaker one looks correct indefinitely. It stops agreeing the moment rows are
// inserted out of order -- a backfill, an import, a league clone -- and then the
// SPA renders one budget while the auction settles against another. Measured on
// a cloned league: the board offered a team $64 of cap while the auction capped
// its ceiling to $25, and $664 against $242 league-wide.
//
// So the input here is the one league 1 cannot produce: a transaction that
// occurred EARLIER carrying a HIGHER transaction id. Everything else about the
// fixture is ordinary, which is the point -- nothing but the ordering rule can
// decide this case.
describe('roster salary in force', function () {
  this.timeout(60 * 1000)

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(current_season.now.toISOString())
    await league(knex)
  })

  let player_row
  const current_salary = 55
  const superseded_salary = 40

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)

    player_row = await selectPlayer({ random: false })

    // The salary actually in force: newest by occurred_at.
    await addPlayer({
      leagueId: league_id,
      teamId: 1,
      player: player_row,
      userId: 1,
      value: current_salary
    })

    // A SUPERSEDED salary that occurred a year earlier but lands with a higher
    // transaction id, because it is inserted second. This is exactly the shape a
    // clone or a backfill produces, and it is what separates the two rules: by
    // id this row wins, by occurred_at it loses.
    await knex('transactions').insert({
      user_id: 1,
      tid: 1,
      lid: league_id,
      pid: player_row.pid,
      type: (await knex('transactions').where({ pid: player_row.pid }).first())
        .type,
      player_salary: superseded_salary,
      week: 0,
      season_year: current_season.year - 1,
      occurred_at: current_season.now.subtract(1, 'year').toDate()
    })
  })

  const salary_from_get_roster = async () => {
    const roster = await getRoster({ tid: 1, week: current_season.week })
    return roster.players.find((p) => p.pid === player_row.pid).player_salary
  }

  const salary_from_league_rosters = async () => {
    const rosters = await get_laegue_rosters_from_database({
      lid: league_id,
      year: current_season.year
    })
    const roster = rosters.find(
      (r) => r.tid === 1 && r.week === current_season.week
    )
    return roster.players.find((p) => p.pid === player_row.pid).player_salary
  }

  it('getRoster reads the salary newest by occurred_at', async () => {
    expect(await salary_from_get_roster()).to.equal(current_salary)
  })

  it('the league rosters payload reads the same salary', async () => {
    // The one that was wrong. Under `max(transaction_id)` this returns the
    // superseded salary, because the superseded row was inserted second.
    expect(await salary_from_league_rosters()).to.equal(current_salary)
  })

  it('both readers agree, which is the invariant that was broken', async () => {
    expect(await salary_from_league_rosters()).to.equal(
      await salary_from_get_roster()
    )
  })
})
