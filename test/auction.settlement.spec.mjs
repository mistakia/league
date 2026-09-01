/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  transaction_types,
  auction_election_outcomes
} from '#constants'
import {
  submit_auction_election,
  withdraw_auction_election,
  get_team_auction_elections,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import {
  get_active_auction_nomination,
  sweep_unnominated_auction_elections
} from '#libs-server/auction-settlement.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

describe('auction settlement against postgres', function () {
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

    // The elections write path refuses outside the free agency period, and the
    // shared league fixture configures none. Set it HERE rather than in the
    // fixture: free_agency_period_start also closes veteran signing, blocks
    // active-roster releases and opens the sanctuary period, so putting it in
    // the shared fixture would silently change behavior for the waiver, poach
    // and release suites.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  // The nomination IS the opening bid, written to `transactions` exactly as the
  // live socket writes it. There is no nomination-state table: the open player,
  // the current price and the leader are the latest AUCTION_BID row.
  const nominate = async ({ pid, tid, value = 0, user_id = 1 }) => {
    await knex('transactions').insert({
      user_id,
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

  const free_agent = async (exclude_pids = []) => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      exclude_pids,
      random: false
    })
    return player.pid
  }

  const all_team_ids = async () => {
    const teams = await knex('teams').where({ lid: league_id, season_year })
    return teams.map((team) => team.team_id).sort((a, b) => a - b)
  }

  describe('completeness', function () {
    it('waits while any eligible team has not elected', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1 })

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(status.nomination.pid).to.equal(pid)
      expect(status.outstanding_election_tids.length).to.be.greaterThan(0)
      expect(status.outstanding_election_tids).to.not.include(1)

      const processed = await knex('transactions').where({
        lid: league_id,
        pid,
        type: transaction_types.AUCTION_PROCESSED
      })
      expect(processed).to.have.length(0)
    })

    it('settles the moment the last eligible team elects', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      const team_ids = await all_team_ids()
      const others = team_ids.filter((tid) => tid !== 1)

      let settlement = null
      for (const tid of others) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      expect(settlement).to.not.equal(null)
      expect(settlement.winner_tid).to.equal(1)
      expect(settlement.price).to.equal(0)

      const processed = await knex('transactions').where({
        lid: league_id,
        pid,
        type: transaction_types.AUCTION_PROCESSED
      })
      expect(processed).to.have.length(1)
      expect(processed[0].tid).to.equal(1)

      const roster_rows = await knex('rosters_players').where({
        lid: league_id,
        season_year,
        pid
      })
      expect(roster_rows).to.have.length(1)
      expect(roster_rows[0].tid).to.equal(1)
    })

    it('prices at the runner-up maximum plus one increment', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      const team_ids = await all_team_ids()
      const others = team_ids.filter((tid) => tid !== 1)
      const maximums = { [others[0]]: 20, [others[1]]: 12 }

      let settlement = null
      for (const tid of others) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: maximums[tid] ?? null
        })
        if (result.settlement) settlement = result.settlement
      }

      expect(settlement.winner_tid).to.equal(others[0])
      expect(settlement.price).to.equal(13)

      const elections = await knex('auction_elections').where({
        lid: league_id,
        season_year,
        pid
      })
      const by_tid = new Map(elections.map((row) => [row.tid, row]))
      expect(by_tid.get(others[0]).outcome).to.equal(
        auction_election_outcomes.WON
      )
      expect(by_tid.get(others[1]).outcome).to.equal(
        auction_election_outcomes.OUTBID
      )
      expect(by_tid.get(others[2]).outcome).to.equal(
        auction_election_outcomes.DECLINED
      )
      for (const row of elections) {
        expect(row.settled_at).to.not.equal(null)
      }
    })
  })

  describe('the write path', function () {
    it('accepts an election on a player nobody has nominated', async function () {
      const pid = await free_agent()
      const result = await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 15
      })

      expect(result.settlement).to.equal(null)
      const rows = await knex('auction_elections').where({
        lid: league_id,
        season_year,
        pid,
        tid: 2
      })
      expect(rows).to.have.length(1)
      expect(rows[0].maximum_bid).to.equal(15)
    })

    it('carries a pre-nomination maximum unchanged into settlement', async function () {
      const pid = await free_agent()

      const team_ids = await all_team_ids()
      const others = team_ids.filter((tid) => tid !== 1)

      // Every election lands BEFORE the player is nominated. This is the whole
      // point of the design: a manager can state every bid they intend to make
      // before the auction opens and never attend at all.
      for (const tid of others) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: tid === others[0] ? 9 : null
        })
      }

      await nominate({ pid, tid: 1, value: 0 })
      const { settlement } = await submit_auction_election({
        lid: league_id,
        tid: 1,
        pid,
        user_id: 1,
        maximum_bid: 0
      })

      expect(settlement.winner_tid).to.equal(others[0])
      expect(settlement.price).to.equal(1)
    })

    it('moves amount_set_at only when the amount moves', async function () {
      const pid = await free_agent()
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 10
      })
      const [first] = await knex('auction_elections').where({ pid, tid: 2 })

      // The suite pins the clock, so it has to be moved deliberately -- with it
      // frozen, "amount_set_at did not move" and "the clock did not move" are
      // the same observation and the assertion below proves nothing.
      const pinned = Date.now()
      MockDate.set(new Date(pinned + 60 * 1000))

      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 10
      })
      const [resubmitted] = await knex('auction_elections').where({
        pid,
        tid: 2
      })
      expect(resubmitted.amount_set_at.getTime()).to.equal(
        first.amount_set_at.getTime()
      )

      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 11
      })
      const [raised] = await knex('auction_elections').where({ pid, tid: 2 })
      expect(raised.amount_set_at.getTime()).to.be.greaterThan(
        first.amount_set_at.getTime()
      )
      expect(raised.submitted_at.getTime()).to.equal(
        first.submitted_at.getTime()
      )

      MockDate.set(new Date(pinned))
    })

    it('refuses a decline from the team that nominated the player', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 2 })

      let error = null
      try {
        await submit_auction_election({
          lid: league_id,
          tid: 1,
          pid,
          user_id: 1,
          maximum_bid: null
        })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('nominating is bidding')
    })

    it('permits withdrawing and re-electing under the partial unique index', async function () {
      const pid = await free_agent()
      await submit_auction_election({
        lid: league_id,
        tid: 3,
        pid,
        user_id: 1,
        maximum_bid: 5
      })
      await withdraw_auction_election({ lid: league_id, tid: 3, pid })
      await submit_auction_election({
        lid: league_id,
        tid: 3,
        pid,
        user_id: 1,
        maximum_bid: 8
      })

      const rows = await knex('auction_elections')
        .where({ pid, tid: 3 })
        .orderBy('election_id')
      expect(rows).to.have.length(2)
      expect(rows[0].withdrawn_at).to.not.equal(null)
      expect(rows[1].withdrawn_at).to.equal(null)
      expect(rows[1].maximum_bid).to.equal(8)
    })

    it('puts a team back in the outstanding set when it withdraws a decline', async function () {
      // The un-pass. Under slow mode a misclicked pass could only be undone by
      // another team bidding, because no un-pass existed anywhere in the tree.
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: null
      })
      const before = await get_auction_settlement_status({ lid: league_id })
      expect(before.outstanding_election_tids).to.not.include(2)

      await withdraw_auction_election({ lid: league_id, tid: 2, pid })
      const after = await get_auction_settlement_status({ lid: league_id })
      expect(after.outstanding_election_tids).to.include(2)
    })
  })

  describe('a placed bid is binding', function () {
    it('leaves a team leading at the amount it bid after its ceiling is withdrawn', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      // Team 2 holds a $30 ceiling and has already been bid to $11 on the wire.
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 30
      })
      await knex('transactions').insert({
        user_id: 1,
        tid: 2,
        pid,
        lid: league_id,
        type: transaction_types.AUCTION_BID,
        player_salary: 11,
        week: 0,
        season_year,
        occurred_at: new Date()
      })

      await withdraw_auction_election({ lid: league_id, tid: 2, pid })

      const team_ids = await all_team_ids()
      let settlement = null
      for (const tid of team_ids.filter((tid) => tid !== 1 && tid !== 2)) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      expect(settlement.winner_tid).to.equal(2)
      expect(settlement.price).to.equal(11)
    })
  })

  describe('atomicity', function () {
    it('settles exactly once when the last two elections arrive together', async function () {
      // This is the failure being retired. record_team_pass was a non-atomic
      // read-modify-write on a JSON array with no MULTI/WATCH: two simultaneous
      // passes could each observe the other missing, neither would settle, and
      // with no timer in slow mode the nomination hung indefinitely.
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      const team_ids = await all_team_ids()
      const others = team_ids.filter((tid) => tid !== 1)
      const early = others.slice(0, others.length - 2)
      const last_two = others.slice(-2)

      for (const tid of early) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
      }

      const results = await Promise.all(
        last_two.map((tid) =>
          submit_auction_election({
            lid: league_id,
            tid,
            pid,
            user_id: 1,
            maximum_bid: null
          })
        )
      )

      const settlements = results.filter((result) => result.settlement)
      expect(settlements).to.have.length(1)

      const processed = await knex('transactions').where({
        lid: league_id,
        pid,
        type: transaction_types.AUCTION_PROCESSED
      })
      expect(processed).to.have.length(1)

      const roster_rows = await knex('rosters_players').where({
        lid: league_id,
        season_year,
        pid
      })
      expect(roster_rows).to.have.length(1)
    })
  })

  describe('the auction only signs', function () {
    it('adds one active player and never raises the winner cap', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })

      const [before] = await knex('teams').where({
        team_id: 1,
        season_year
      })
      const roster_before = await knex('rosters_players').where({
        lid: league_id,
        season_year,
        tid: 1,
        week: 0
      })

      const team_ids = await all_team_ids()
      for (const tid of team_ids.filter((tid) => tid !== 1)) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
      }

      const [after] = await knex('teams').where({ team_id: 1, season_year })
      const roster_after = await knex('rosters_players').where({
        lid: league_id,
        season_year,
        tid: 1,
        week: 0
      })

      expect(roster_after.length).to.equal(roster_before.length + 1)
      expect(after.salary_cap).to.be.at.most(before.salary_cap)

      const releases = await knex('transactions')
        .where({ lid: league_id, season_year, pid })
        .where('type', transaction_types.ROSTER_RELEASE)
      expect(releases).to.have.length(0)
    })
  })

  describe('standing elections view', function () {
    it('reports the effective maximum and which ceilings are capped', async function () {
      const pid_one = await free_agent()
      const pid_two = await free_agent([pid_one])

      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid: pid_one,
        user_id: 1,
        maximum_bid: 5
      })
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid: pid_two,
        user_id: 1,
        maximum_bid: 100000
      })

      const elections = await get_team_auction_elections({
        lid: league_id,
        tid: 2
      })
      const by_pid = new Map(elections.map((row) => [row.pid, row]))

      expect(by_pid.get(pid_one).is_capped).to.equal(false)
      expect(by_pid.get(pid_one).effective_maximum).to.equal(5)
      expect(by_pid.get(pid_two).is_capped).to.equal(true)
      expect(by_pid.get(pid_two).effective_maximum).to.be.lessThan(100000)
    })
  })

  describe('auction close', function () {
    it('sweeps every election on a player nobody nominated', async function () {
      const pid = await free_agent()
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 4
      })

      await sweep_unnominated_auction_elections({ lid: league_id })

      const [row] = await knex('auction_elections').where({ pid, tid: 2 })
      expect(row.outcome).to.equal(auction_election_outcomes.NOT_NOMINATED)
      expect(row.settled_at).to.not.equal(null)
    })
  })

  describe('the active nomination', function () {
    it('is null once the open player has been processed', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0 })
      expect(
        await get_active_auction_nomination({ lid: league_id })
      ).to.not.equal(null)

      const team_ids = await all_team_ids()
      for (const tid of team_ids.filter((tid) => tid !== 1)) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
      }

      expect(await get_active_auction_nomination({ lid: league_id })).to.equal(
        null
      )
    })
  })
})
