/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { settle_auction_player_if_complete } from '#libs-server/auction-settlement.mjs'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE AUCTION ONLY SIGNS, AND THAT IS AN INVARIANT RATHER THAN A HABIT.
//
// Eligibility is monotone -- a team that leaves an eligible set never re-enters
// it -- and completeness once reached stays reached only because of that. Two
// things would break it, and a roster count can only see one:
//
// - A settlement that removed a roster row, or added more than one.
// - A settlement that RAISED the winner's remaining cap, which puts them back
//   into eligible sets they had dropped out of with no roster row moving at all.
//
// Both are asserted inside the settling transaction, so a violation rolls the
// settlement back rather than committing a corrupt board. This spec drives a
// real settlement and holds it to both.
describe('auction settlement keeps rosters and budgets monotone', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
    await league(knex)
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })

    // Give every team its full cap as headroom. The draft fixture leaves teams
    // OVER the league cap, and an effective maximum is `min(stated,
    // availableCap)`, so every ceiling below would cap down to nothing and the
    // player would settle at $0 -- which is what made the cap assertion VACUOUS
    // when this spec was first written: at a price of zero, a settlement that
    // REFUNDS and one that charges are the same arithmetic, and the mutation
    // that should have reddened it changed nothing.
    await knex('transactions')
      .where({ lid: league_id })
      .update({ player_salary: 0 })
  })

  const all_team_ids = async () => {
    const teams = await knex('teams').where({ lid: league_id, season_year })
    return teams.map((team) => team.team_id).sort((a, b) => a - b)
  }

  const roster_row_count = async (tid) => {
    const [row] = await knex('rosters_players')
      .where({ lid: league_id, tid, season_year })
      .count('pid as count')
    return Number(row.count)
  }

  const team_cap = async (tid) => {
    const [team] = await knex('teams')
      .where({ team_id: tid, season_year })
      .select('salary_cap')
    return team.salary_cap
  }

  // A nomination at $0 so every team with an open spot is eligible, and two
  // real maximums so the player settles at a price ABOVE zero -- the cap
  // assertion can only see a violation when money actually moves.
  const settle_one_player = async () => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    const nominating_team_id = (await all_team_ids())[0]

    await knex('transactions').insert({
      user_id: 1,
      tid: nominating_team_id,
      pid: player.pid,
      lid: league_id,
      type: transaction_types.AUCTION_BID,
      player_salary: 0,
      week: 0,
      season_year,
      occurred_at: new Date()
    })

    // The election write path settles the player ITSELF the moment it completes
    // the eligible set, so the settlement comes back from the last election
    // rather than from a separate call. Asking again afterwards returns null --
    // nothing is open by then -- which is the auction working rather than a
    // failure to settle, and mistaking the two is what made this spec red first.
    const tids = await all_team_ids()
    const contenders = new Map([
      [tids[1], 10],
      [tids[2], 4]
    ])

    let settlement = null
    for (const tid of tids) {
      if (tid === nominating_team_id) continue
      const result = await submit_auction_election({
        lid: league_id,
        tid,
        pid: player.pid,
        user_id: 1,
        maximum_bid: contenders.has(tid) ? contenders.get(tid) : null
      })
      if (result.settlement) settlement = result.settlement
    }

    if (!settlement) {
      settlement = await settle_auction_player_if_complete({ lid: league_id })
    }
    expect(settlement, 'the player settles').to.exist
    // The whole point of the two maximums. A $0 settlement cannot distinguish a
    // charge from a refund, so an assertion made against one proves nothing.
    expect(settlement.price, 'the price must be above zero').to.be.above(0)
    return settlement
  }

  it('adds exactly one roster row to the winner and removes none', async function () {
    this.timeout(60 * 1000)
    const tids = await all_team_ids()
    const before = {}
    for (const tid of tids) before[tid] = await roster_row_count(tid)

    const settlement = await settle_one_player()

    for (const tid of tids) {
      const after = await roster_row_count(tid)
      const expected = before[tid] + (tid === settlement.winner_tid ? 1 : 0)
      expect(after, `team ${tid} roster rows`).to.equal(expected)
    }
  })

  it('never raises a team’s remaining cap', async function () {
    this.timeout(60 * 1000)
    const tids = await all_team_ids()
    const before = {}
    for (const tid of tids) before[tid] = await team_cap(tid)

    const settlement = await settle_one_player()

    for (const tid of tids) {
      const after = await team_cap(tid)
      expect(after, `team ${tid} cap must not rise`).to.be.at.most(before[tid])
    }
    expect(await team_cap(settlement.winner_tid)).to.equal(
      before[settlement.winner_tid] - settlement.price
    )
  })

  it('writes no release transaction', async function () {
    this.timeout(60 * 1000)
    await settle_one_player()

    // The auction path has no release branch at all, so this is a standing
    // assertion about the SHAPE of what a settlement writes rather than a guard
    // against a branch that exists. It is what would catch one being added.
    //
    // The type is asserted to EXIST first. Written against a constant this
    // module does not export, the predicate binds undefined and matches
    // nothing -- a confident zero that certifies the invariant while testing
    // nothing at all. That is how this assertion was first written.
    expect(transaction_types.ROSTER_RELEASE, 'the release type').to.be.a(
      'number'
    )
    const releases = await knex('transactions')
      .where({ lid: league_id, season_year })
      .where('type', transaction_types.ROSTER_RELEASE)
    expect(releases, 'a settlement releases nobody').to.have.length(0)
  })
})
