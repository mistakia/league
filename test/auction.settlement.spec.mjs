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
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
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

  // Delegates to the shared helper: a nomination binds its nominator without
  // discharging it, so `maximum_bid` is what lets the player settle at all, and
  // that rule belongs in one place rather than re-hand-rolled per spec.
  const nominate = ({ pid, tid, value = 0, user_id = 1, maximum_bid = null }) =>
    nominate_auction_player({
      lid: league_id,
      pid,
      tid,
      value,
      user_id,
      maximum_bid
    })

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

      const processed = await knex('transactions').where({
        lid: league_id,
        pid,
        type: transaction_types.AUCTION_PROCESSED
      })
      expect(processed).to.have.length(0)
    })

    // A NOMINATION IS NOT AN ELECTION. The nominating team is bound to its
    // opening bid and can still be outbid off its own nomination, so until it
    // names a ceiling the auction does not know its position at any price above
    // the opening -- and waits.
    //
    // Run as a PAIR against the same fixture, because "the nominator is
    // outstanding" passes trivially against a status call that never resolved
    // the nominator at all. The two readings have to differ.
    it('leaves the nominating team outstanding until it elects', async function () {
      const pid_without_ceiling = await free_agent()
      await nominate({ pid: pid_without_ceiling, tid: 1, value: 2 })

      const without_ceiling = await get_auction_settlement_status({
        lid: league_id
      })
      expect(without_ceiling.outstanding_election_tids).to.include(1)

      // Settle it out of the way so the second nomination is the open one.
      const team_ids = await all_team_ids()
      for (const tid of team_ids) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid: pid_without_ceiling,
          user_id: 1,
          maximum_bid: tid === 1 ? 2 : null
        })
      }

      const pid_with_ceiling = await free_agent([pid_without_ceiling])
      await nominate({
        pid: pid_with_ceiling,
        tid: 1,
        value: 2,
        maximum_bid: 9
      })

      const with_ceiling = await get_auction_settlement_status({
        lid: league_id
      })
      expect(with_ceiling.nomination.pid).to.equal(pid_with_ceiling)
      expect(with_ceiling.outstanding_election_tids).to.not.include(1)
    })

    it('settles the moment the last eligible team elects', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

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
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

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

  // THE PURE SPECS CANNOT REACH THIS. `auction.claim-commitments.spec.mjs`
  // drives the builder with hand-written ISO strings; here the instants arrive
  // as whatever the driver hands back for a `timestamptz` column, and the two
  // commitments being compared come from DIFFERENT tables --
  // `transactions.occurred_at` and `auction_elections.amount_set_at`. A
  // commitment shape that worked on strings and silently failed to order two
  // Dates would pass every pure case and lose a real player.
  //
  // The clock is MOVED between the three writes rather than left frozen. Under a
  // fixed MockDate all three instants are the same value, every ordering is a
  // tie, and the assertion below passes on whichever team the sort happens to
  // emit first -- which looks exactly like the rule working.
  describe('the tiebreak instant against real rows', function () {
    const decline_remaining = async ({ pid, except }) => {
      const team_ids = await all_team_ids()
      let settlement = null
      for (const tid of team_ids) {
        if (except.includes(tid)) continue
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }
      return settlement
    }

    const base = () =>
      current_season.regular_season_start.subtract('1', 'month')

    it('awards a tie to the team that bid before its rival elected', async function () {
      // Team 2 bids $5 at 10:00. Team 3 elects $5 at 10:05. Team 2 elects $5 at
      // 10:10, confirming money it already had on the wire -- and wins, because
      // its earliest commitment AT $5 is the bid.
      MockDate.set(base().hour(9).minute(0).second(0).toISOString())
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

      MockDate.set(base().hour(10).minute(0).second(0).toISOString())
      await knex('transactions').insert({
        user_id: 1,
        tid: 2,
        pid,
        lid: league_id,
        type: transaction_types.AUCTION_BID,
        player_salary: 5,
        week: 0,
        season_year,
        occurred_at: new Date()
      })

      MockDate.set(base().hour(10).minute(5).second(0).toISOString())
      await submit_auction_election({
        lid: league_id,
        tid: 3,
        pid,
        user_id: 1,
        maximum_bid: 5
      })

      MockDate.set(base().hour(10).minute(10).second(0).toISOString())
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 5
      })

      // THE INSTANTS ARE ASSERTED, not just their consequence. Without this the
      // pair proves only that a bid inserted earlier beats an election inserted
      // later, which stays true if `amount_set_at` were stamped from the
      // DATABASE clock instead of the mocked one -- the bid sits a month in the
      // simulated past, so it precedes any real-clock election no matter what.
      // These three readings are what tie the ordering to the clock the test
      // moves.
      const [bid_row] = await knex('transactions').where({
        lid: league_id,
        pid,
        tid: 2,
        type: transaction_types.AUCTION_BID
      })
      const elections = await knex('auction_elections').where({
        lid: league_id,
        season_year,
        pid
      })
      const election_at = (tid) =>
        new Date(
          elections.find((row) => row.tid === tid).amount_set_at
        ).toISOString()

      expect(new Date(bid_row.occurred_at).toISOString()).to.equal(
        base().hour(10).minute(0).second(0).millisecond(0).toISOString()
      )
      expect(election_at(3)).to.equal(
        base().hour(10).minute(5).second(0).millisecond(0).toISOString()
      )
      expect(election_at(2)).to.equal(
        base().hour(10).minute(10).second(0).millisecond(0).toISOString()
      )

      const settlement = await decline_remaining({ pid, except: [1, 2, 3] })

      expect(settlement).to.not.equal(null)
      expect(settlement.winner_tid).to.equal(2)
      expect(settlement.price).to.equal(5)

      MockDate.set(base().toISOString())
    })

    it('awards the same tie to the earlier ELECTION when no bid stands behind it', async function () {
      // The control, and the only thing that makes the case above evidence:
      // identical shape, identical election instants, team 2's bid removed. Team
      // 3 elected first, so team 3 wins. Without this pair, "team 2 wins" is
      // consistent with a resolver that simply favours the lower team id.
      MockDate.set(base().hour(9).minute(0).second(0).toISOString())
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

      MockDate.set(base().hour(10).minute(5).second(0).toISOString())
      await submit_auction_election({
        lid: league_id,
        tid: 3,
        pid,
        user_id: 1,
        maximum_bid: 5
      })

      MockDate.set(base().hour(10).minute(10).second(0).toISOString())
      await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 5
      })

      const settlement = await decline_remaining({ pid, except: [1, 2, 3] })

      expect(settlement).to.not.equal(null)
      expect(settlement.winner_tid).to.equal(3)

      MockDate.set(base().toISOString())
    })
  })

  describe('a placed bid is binding', function () {
    it('leaves a team leading at the amount it bid after its ceiling is withdrawn', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

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

      // Withdrawing put team 2 back in the outstanding set -- a bid does not
      // discharge -- so it has to state a position before anything can settle.
      // It DECLINES, which makes this the sharper case: a decline is a
      // revocation going forward and cannot unwind the $11 already on the wire,
      // so team 2 still holds a binding claim at $11 and still wins there.
      const team_ids = await all_team_ids()
      let settlement = null
      for (const tid of team_ids.filter((tid) => tid !== 1)) {
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
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

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
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })

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

  describe('the socket after a settlement it did not perform', function () {
    it('advances the nomination turn when a REST election settles the player', async function () {
      // THE MAINLINE, not an edge. In election mode managers nominate over the
      // socket and elect over REST, so every settlement happens somewhere the
      // socket instance never hears about. Its `_transactions` cache then still
      // shows the sold player's AUCTION_BID on top, and `nominating_team_id`
      // reads that cache -- so the turn never advances and the next nomination
      // is validated against the wrong team.
      const Auction = (await import('#api/sockets/auction.mjs')).default
      const auction = new Auction({
        wss: { clients: new Set() },
        lid: league_id
      })
      await auction.setup()

      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })
      await auction._load_transactions()
      expect(auction.nominating_team_id).to.equal(1)

      // Settle it entirely over the REST path.
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

      // The socket has been told nothing. Reading the turn must still be right.
      await auction._send_auction_init(1)
      expect(auction.nominating_team_id).to.not.equal(1)
    })
  })

  describe('the active nomination', function () {
    it('is null once the open player has been processed', async function () {
      const pid = await free_agent()
      await nominate({ pid, tid: 1, value: 0, maximum_bid: 0 })
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
