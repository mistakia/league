/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { settle_auction_player_if_complete } from '#libs-server/auction-settlement.mjs'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
import { selectPlayer } from './utils/index.mjs'

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

  const record_query = (query) => {
    // `getRoster` opens with `rosters` keyed on tid; the bindings carry it
    // first. Anchored on the table in the SQL rather than on a call count, so a
    // second read of the same team is visible rather than collapsed.
    // `select * from "rosters" where "tid" = $1 ...`, so the tid is the first
    // binding. Matched on the FROM clause and the tid predicate together: a
    // bare `rosters` substring also matches every `rosters_players` query,
    // whose first binding is not a tid at all.
    if (/from "rosters" where "tid" = /.test(query.sql)) {
      observed_roster_reads.push(Number(query.bindings[0]))
    }
  }

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
    knex.on('query', record_query)
  })

  afterEach(function () {
    knex.removeListener('query', record_query)
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

    const settlement = await settle_auction_player_if_complete({
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

    const settlement = await settle_auction_player_if_complete({
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

    const settlement = await settle_auction_player_if_complete({
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

    const settlement = await settle_auction_player_if_complete({
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
})
