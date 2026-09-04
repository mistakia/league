/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { settle_auction_player_if_complete } from '#libs-server/auction-settlement.mjs'
import {
  get_auction_settlement_status,
  broadcast_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
import { selectPlayer } from './utils/index.mjs'
import { record_roster_reads } from './utils/count-roster-reads.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A CAPACITY NOBODY READS IS A ROSTER READ NOBODY NEEDED.
//
// Settlement used to compute every team's capacity, and only two consumers ever
// look at one. `get_outstanding_election_team_ids` skips a team that has
// elected before checking its eligibility, and `resolve_auction_player` filters
// declines out before it touches `rosters` at all -- so a team that DECLINED is
// skipped by both. That is most of the league in a real settlement, because a
// settlement happens exactly when everyone has elected, and a roster read is
// several queries against the heaviest join in the codebase.
//
// COUNTED, NOT REASONED. The saving above was argued from the source before it
// was ever measured, so these cases watch the actual `rosters` queries knex
// issues and assert WHICH TEAMS were read. A claim about work not done is
// invisible to an outcome assertion: every case here would still pass with the
// narrowing reverted, which is why the read set is the assertion and the
// settlement outcome is only the control beside it.
describe('auction settlement reads only the capacities it consumes', function () {
  let observed_roster_reads = []
  let stop_recording = () => {}

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
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
    // The draft fixture leaves teams over the league cap, which caps every
    // effective maximum to nothing and settles the player at $0 -- the same
    // vacuity that once made the sibling cap spec pass against a refund.
    await knex('transactions')
      .where({ lid: league_id })
      .update({ player_salary: 0 })

    observed_roster_reads = []
    stop_recording = record_roster_reads((tid) =>
      observed_roster_reads.push(tid)
    )
  })

  afterEach(function () {
    stop_recording()
    MockDate.reset()
  })

  const all_team_ids = async () => {
    const teams = await knex('teams').where({ lid: league_id, season_year })
    return teams.map((team) => team.team_id).sort((a, b) => a - b)
  }

  // Written straight to the table rather than through `submit_auction_election`,
  // for two reasons: that route settles the player itself the moment the set
  // completes, and it REFUSES a decline from the nominating team -- which is
  // one of the two cases below.
  const write_election = async ({ pid, tid, maximum_bid }) => {
    const now = new Date()
    await knex('auction_elections').insert({
      lid: league_id,
      season_year,
      pid,
      tid,
      user_id: 1,
      maximum_bid,
      submitted_at: now,
      amount_set_at: now
    })
  }

  const write_bid = async ({ pid, tid, value }) =>
    knex('transactions').insert({
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

  const free_agent = async () => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    return player.pid
  }

  // The capacity reads only, without the roster `persist_auction_settlement`
  // reads for the WINNER on the far side of the writes. That one is a
  // settlement write-path read rather than a capacity computation, and folding
  // it in would make every expectation below carry an unexplained extra entry.
  const capacity_reads_excluding = (winner_tid) =>
    observed_roster_reads
      .filter((tid) => tid !== winner_tid)
      .sort((a, b) => a - b)

  it('skips a team that declined and holds no bid', async function () {
    this.timeout(60 * 1000)
    const pid = await free_agent()
    const tids = await all_team_ids()
    const [nominator, contender, ...decliners] = tids

    await nominate_auction_player({
      lid: league_id,
      pid,
      tid: nominator,
      value: 0
    })
    await write_election({ pid, tid: nominator, maximum_bid: 3 })
    await write_election({ pid, tid: contender, maximum_bid: 10 })
    for (const tid of decliners) {
      await write_election({ pid, tid, maximum_bid: null })
    }

    const { settlement } = await settle_auction_player_if_complete({
      lid: league_id
    })

    // THE CONTROL BESIDE THE MEASUREMENT. A settlement that did not happen reads
    // no rosters either, so "few reads" proves nothing on its own.
    expect(settlement, 'the player settles').to.not.equal(null)
    expect(settlement.winner_tid).to.equal(contender)

    // Only the two teams with a live ceiling. Every decliner is discharged by
    // its election and filtered out of the resolver, so nothing consumes its
    // capacity.
    expect(
      capacity_reads_excluding(settlement.winner_tid),
      'a declining team’s roster must not be read'
    ).to.deep.equal([nominator])

    for (const tid of decliners) {
      expect(
        observed_roster_reads,
        `team ${tid} declined and must not have been read`
      ).to.not.include(tid)
    }
  })

  it('reads a decliner that also holds a bid, which is still a contender', async function () {
    this.timeout(60 * 1000)
    const pid = await free_agent()
    const tids = await all_team_ids()
    const [nominator, bidder, ...decliners] = tids

    await nominate_auction_player({
      lid: league_id,
      pid,
      tid: nominator,
      value: 0
    })
    await write_election({ pid, tid: nominator, maximum_bid: 1 })

    // A DECLINE PLUS A PLACED BID. `build_auction_claims` raises the null claim
    // to the bound amount, because a bid already on the wire is binding and a
    // withdrawn ceiling does not unwind it -- so this team competes at $6 and
    // the resolver WILL ask for its capacity. Deriving the read set from the
    // decline rows instead of from the claims is what would drop it here, and
    // the resolver's `!roster` branch would then disqualify it as ROSTER_FULL
    // rather than let it win.
    await write_bid({ pid, tid: bidder, value: 6 })
    await write_election({ pid, tid: bidder, maximum_bid: null })

    for (const tid of decliners) {
      await write_election({ pid, tid, maximum_bid: null })
    }

    const { settlement } = await settle_auction_player_if_complete({
      lid: league_id
    })

    expect(settlement, 'the player settles').to.not.equal(null)
    expect(
      settlement.winner_tid,
      'the bidder wins on its binding bid rather than being disqualified'
    ).to.equal(bidder)

    expect(
      observed_roster_reads,
      'a decliner holding a bid is a contender and must be read'
    ).to.include(bidder)
  })

  it('reads the nominating team even when its own election is a decline', async function () {
    this.timeout(60 * 1000)
    const pid = await free_agent()
    const tids = await all_team_ids()
    const [nominator, ...others] = tids

    await nominate_auction_player({
      lid: league_id,
      pid,
      tid: nominator,
      value: 2
    })

    // A STATE THE WRITE PATH REFUSES, held here on purpose. A nominator cannot
    // decline the player it nominated, so this is written directly -- but
    // `build_auction_claims` raises the nominator to its opening bid
    // unconditionally, so the claim set says it competes whatever the election
    // row says. The two disagree, and the capacity scope has to follow the
    // claims.
    await write_election({ pid, tid: nominator, maximum_bid: null })
    for (const tid of others) {
      await write_election({ pid, tid, maximum_bid: null })
    }

    const { settlement } = await settle_auction_player_if_complete({
      lid: league_id
    })

    expect(settlement, 'the player settles to its nominator').to.not.equal(null)
    expect(settlement.winner_tid).to.equal(nominator)
    expect(settlement.price).to.equal(2)

    expect(
      observed_roster_reads,
      'the nominator always holds a claim and must be read'
    ).to.include(nominator)
  })

  it('reads every team that has not elected, because eligibility decides them', async function () {
    this.timeout(60 * 1000)
    const pid = await free_agent()
    const tids = await all_team_ids()
    const [nominator, silent, ...decliners] = tids

    await nominate_auction_player({
      lid: league_id,
      pid,
      tid: nominator,
      value: 0
    })
    await write_election({ pid, tid: nominator, maximum_bid: 3 })
    for (const tid of decliners) {
      await write_election({ pid, tid, maximum_bid: null })
    }

    const { settlement } = await settle_auction_player_if_complete({
      lid: league_id
    })

    // NOT SETTLED, and that is the point: one team has elected nothing, so the
    // set is incomplete. Its capacity is exactly what decides whether the
    // auction waits on it, so it cannot be skipped.
    expect(
      settlement,
      'the auction waits on the team that has not elected'
    ).to.equal(null)
    expect(
      observed_roster_reads,
      'a team holding no election must be read, or it can never be found eligible'
    ).to.include(silent)
  })

  // THE SECOND SWEEP, which is the one a caller performs after the settle call
  // has already answered the question.
  //
  // These are the cases most likely to pass while proving nothing, because the
  // threading FAILS SOFT by design: `broadcast_auction_settlement_status`
  // recomputes when it is handed no set, so a route that forgot to pass one
  // still broadcasts the right answer and the only symptom is the work nobody
  // sees. Every assertion here is therefore about reads not performed, and the
  // agreement case is what stops "no reads" being satisfied by a wrong answer.
  describe('the outstanding set the settle call already computed', function () {
    const stage_incomplete_nomination = async () => {
      const pid = await free_agent()
      const tids = await all_team_ids()
      const [nominator, silent, ...decliners] = tids

      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: nominator,
        value: 0
      })
      await write_election({ pid, tid: nominator, maximum_bid: 3 })
      for (const tid of decliners) {
        await write_election({ pid, tid, maximum_bid: null })
      }
      return { pid, nominator, silent }
    }

    it('comes back from the settle call and agrees with a fresh recompute', async function () {
      this.timeout(60 * 1000)
      const { silent } = await stage_incomplete_nomination()

      const { settlement, outstanding } =
        await settle_auction_player_if_complete({ lid: league_id })

      expect(settlement, 'the set is incomplete').to.equal(null)

      // THE AGREEMENT, without which "it did no reads" is satisfied by any
      // wrong answer at all, including an empty list.
      const status = await get_auction_settlement_status({ lid: league_id })
      expect(
        outstanding,
        'the threaded set must be the set a recompute would produce'
      ).to.deep.equal(status.outstanding_election_tids)
      expect(outstanding).to.deep.equal([silent])
    })

    it('broadcasts without reading a single roster when it is handed the set', async function () {
      this.timeout(60 * 1000)
      await stage_incomplete_nomination()

      const { outstanding } = await settle_auction_player_if_complete({
        lid: league_id
      })

      const sent = []
      observed_roster_reads = []
      await broadcast_auction_settlement_status({
        broadcast: (lid, message) => sent.push(message),
        lid: league_id,
        outstanding
      })

      expect(
        observed_roster_reads,
        'a broadcast handed the outstanding set must read no rosters at all'
      ).to.deep.equal([])
      expect(sent).to.have.length(1)
      expect(sent[0].payload.outstanding_election_tids).to.deep.equal(
        outstanding
      )
    })

    it('still recomputes for a caller that has no set to give it', async function () {
      this.timeout(60 * 1000)
      const { silent } = await stage_incomplete_nomination()

      const sent = []
      observed_roster_reads = []
      await broadcast_auction_settlement_status({
        broadcast: (lid, message) => sent.push(message),
        lid: league_id
      })

      // THE CONTROL FOR THE CASE ABOVE. Without it, "no roster reads" could be
      // reporting a broadcast helper that never reads rosters under any
      // argument, which would make the measurement blind to the thing it is
      // supposed to be detecting.
      expect(
        observed_roster_reads,
        'omitting the set must fall back to a recompute, which does read rosters'
      ).to.not.deep.equal([])
      expect(sent[0].payload.outstanding_election_tids).to.deep.equal([silent])
    })
  })
})
