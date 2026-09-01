/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import {
  submit_auction_election,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { user1, user2 } from './fixtures/token.mjs'
import { addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A TRADE IS THE ONLY THING THAT CHANGES AUCTION ELIGIBILITY MID-NOMINATION.
// Rosters are fixed for the whole free agency period, so open spots only fall,
// spent budget only rises, and a team that leaves an eligible set never
// re-enters it -- except through a trade, which stays legal throughout the
// period because trade_deadline_at sits months later.
//
// Without the re-evaluation call in the accept handler, a trade that pushes the
// last outstanding team out of the eligible set leaves the outstanding set
// stale. The player then waits on a team that can no longer sign anyone and
// stalls to the final block. Degraded rather than corrupt, which is exactly the
// kind of defect that reaches an auction unreported.
//
// This drives the real route rather than the library function, because the
// defect being closed is a MISSING CALL. A spec against the library alone stays
// green with the handler unwired.
//
// It also builds its own two rosters instead of taking the draft fixture. That
// fixture leaves teams OVER the cap -- team 2 sits at -29 of headroom -- so
// every team fails the budget term before the trade does anything, the
// nominating team included, and the settlement resolves no winner at all. A
// budget test has to own the budget.
describe('auction re-evaluation on trade', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)

    // The elections write path refuses outside the free agency period. The
    // shared league fixture configures none, so open one here rather than in the
    // fixture, which the waiver, poach and release suites also read.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  const get_league_row = () => getLeague({ lid: league_id })

  const available_cap = async (tid) => {
    const league_row = await get_league_row()
    const roster_row = await getRoster({ tid })
    return new Roster({ roster: roster_row, league: league_row }).availableCap
  }

  // Running backs whose primary and secondary position agree. addPlayer writes
  // rosters_players.player_position from secondary_position while trade slot
  // validation reads primary_position, so a player whose two disagree is
  // accepted onto a roster and then refused by the trade.
  const running_backs = async (count) => {
    const rows = await knex('player')
      .whereNot('current_nfl_team', 'INA')
      .where('secondary_position', 'RB')
      .where('primary_position', 'RB')
      .orderBy('pid')
      .limit(count)
    expect(rows).to.have.length(count)
    return rows
  }

  const nominate = async ({ pid, tid, value }) => {
    await knex('transactions').insert({
      user_id: 1,
      tid,
      pid,
      lid: league_id,
      type: transaction_types.AUCTION_BID,
      player_salary: value,
      week: 0,
      season_year,
      occurred_at: new Date()
    })
  }

  const processed_rows = (pid) =>
    knex('transactions').where({
      lid: league_id,
      pid,
      type: transaction_types.AUCTION_PROCESSED
    })

  const decline_for = async ({ pid, except_tids }) => {
    const teams = await knex('teams').where({ lid: league_id, season_year })
    const tids = teams
      .map((team) => team.team_id)
      .filter((tid) => !except_tids.includes(tid))

    for (const tid of tids) {
      await submit_auction_election({
        lid: league_id,
        tid,
        pid,
        user_id: 1,
        maximum_bid: null
      })
    }
  }

  const execute_trade = async ({ proposing_pid, accepting_pid }) => {
    const propose_res = await chai_request
      .execute(server)
      .post(`/api/leagues/${league_id}/trades`)
      .set('Authorization', `Bearer ${user1}`)
      .send({
        proposingTeamPlayers: [proposing_pid],
        acceptingTeamPlayers: [accepting_pid],
        proposing_team_slots: { [accepting_pid]: roster_slot_types.BENCH },
        accepting_team_slots: { [proposing_pid]: roster_slot_types.BENCH },
        propose_tid: 1,
        accept_tid: 2,
        leagueId: league_id
      })
    expect(propose_res.status).to.equal(200)

    const accept_res = await chai_request
      .execute(server)
      .post(
        `/api/leagues/${league_id}/trades/${propose_res.body.trade_id}/accept`
      )
      .set('Authorization', `Bearer ${user2}`)
    expect(accept_res.status).to.equal(200)
  }

  it('settles the open player when a trade drops the last outstanding team out of the eligible set', async function () {
    this.timeout(60 * 1000)

    const [expensive, free, nominated] = await running_backs(3)
    const league_row = await get_league_row()

    // The price the open player sits at, and the headroom team 2 is left with
    // after the trade. Team 2 clears the budget term before the trade and fails
    // it after, which is the term a trade can actually move.
    const nomination_price = 40
    const headroom_after_trade = nomination_price - 10
    const expensive_salary = league_row.salary_cap - headroom_after_trade

    // Team 1 holds the expensive player, team 2 holds a free one, so the swap
    // moves salary in one direction only.
    await addPlayer({
      leagueId: league_id,
      teamId: 1,
      player: expensive,
      userId: 1,
      value: expensive_salary
    })
    await addPlayer({
      leagueId: league_id,
      teamId: 2,
      player: free,
      userId: 2,
      value: 0
    })

    expect(await available_cap(2)).to.be.at.least(nomination_price)

    await nominate({ pid: nominated.pid, tid: 1, value: nomination_price })

    // Every eligible team except team 2 declines. Team 2 is left outstanding,
    // and ASSERTED outstanding below, so the trade is the only thing that can
    // complete the set. Without that assertion this test would pass against an
    // unwired handler for the unrelated reason that the set was already
    // complete -- the false-green shape this repo has been bitten by before.
    await decline_for({ pid: nominated.pid, except_tids: [1, 2] })

    const before = await get_auction_settlement_status({ lid: league_id })
    expect(before.nomination.pid).to.equal(nominated.pid)
    expect(
      before.outstanding_election_tids,
      'team 2 must be the only team the auction is still waiting on, or the trade is not what settles this player'
    ).to.eql([2])
    expect(await processed_rows(nominated.pid)).to.have.length(0)

    await execute_trade({
      proposing_pid: expensive.pid,
      accepting_pid: free.pid
    })

    // Team 2 can no longer afford the open price, so nothing is outstanding and
    // the player settles with no further manager action.
    expect(await available_cap(2)).to.be.below(nomination_price)

    const processed = await processed_rows(nominated.pid)
    expect(
      processed,
      'the trade completed the eligible set and the player did not settle'
    ).to.have.length(1)
    expect(processed[0].tid).to.equal(1)
    expect(processed[0].player_salary).to.equal(nomination_price)

    const roster_rows = await knex('rosters_players').where({
      lid: league_id,
      season_year,
      pid: nominated.pid
    })
    expect(roster_rows).to.have.length(1)
    expect(roster_rows[0].tid).to.equal(1)
  })

  it('leaves a genuinely incomplete eligible set alone after a trade', async function () {
    this.timeout(60 * 1000)

    // The mirror case, and what keeps the assertion above honest: a trade must
    // re-evaluate, not settle unconditionally. Teams 2 and 3 are both left
    // outstanding and the trade touches only team 2, so the player must still be
    // waiting on team 3 afterwards.
    const [team_1_player, team_2_player, nominated] = await running_backs(3)

    await addPlayer({
      leagueId: league_id,
      teamId: 1,
      player: team_1_player,
      userId: 1,
      value: 0
    })
    await addPlayer({
      leagueId: league_id,
      teamId: 2,
      player: team_2_player,
      userId: 2,
      value: 0
    })

    await nominate({ pid: nominated.pid, tid: 1, value: 0 })
    await decline_for({ pid: nominated.pid, except_tids: [1, 2, 3] })

    await execute_trade({
      proposing_pid: team_1_player.pid,
      accepting_pid: team_2_player.pid
    })

    const status = await get_auction_settlement_status({ lid: league_id })
    expect(status.nomination.pid).to.equal(nominated.pid)
    expect(status.outstanding_election_tids).to.include(3)
    expect(await processed_rows(nominated.pid)).to.have.length(0)
  })
})
