/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import {
  get_outstanding_election_team_ids,
  settle_auction_player_if_complete
} from '#libs-server/auction-settlement.mjs'
import { get_auction_settlement_status } from '#libs-server/auction-elections.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// AN ELECTION THAT CANNOT IMPROVE ITS OWN CLAIM DOES NOT HAVE TO BE WAITED FOR.
//
// A team's whole influence on a settlement is its claim.
// `build_auction_claims` makes that `max(election_maximum, highest_bid)` and
// `resolve_auction_player` takes `min(claim, available_cap)`. So for a team
// holding a bid B against a cap C, choosing whether to state a maximum M:
//
//   not electing  ->  min(B, C)
//   electing M    ->  min(max(M, B), C)
//
// When B >= C those are the same number for EVERY M, because max(M, B) >= B >= C
// and both clamp to C. Such a team cannot move the winner or the price, and
// League 1 held a player open two hours waiting on exactly one: a team leading
// at $1 against a $1 cap.
//
// THE COMPARISON IS AGAINST THE CAP, AND THE TWO REJECTED ALTERNATIVES BELOW ARE
// WHY THAT MATTERS. Both settle the observed case and both are wrong, so each
// has a case here that a wrong rule would fail.
describe('an election that cannot improve its own claim discharges', function () {
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
    await knex('transactions')
      .where({ lid: league_id })
      .update({ player_salary: 0 })
  })

  // PURE, and the cheapest place to pin the rule. Every case states the cap and
  // the bid explicitly, so nothing here depends on a fixture's roster happening
  // to produce the numbers the rule turns on.
  describe('the rule itself', function () {
    const capacities_with_cap = (entries) =>
      new Map(
        entries.map(([tid, available_cap]) => [
          tid,
          { is_eligible: true, available_cap }
        ])
      )

    const bid = (tid, player_salary) => ({ tid, player_salary })

    it('discharges a bidder whose bid already reaches its cap', function () {
      // Team 1 bid exactly its cap. No maximum it could state raises
      // min(max(M, 1), 1) above 1, so it is waiting on nothing.
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 1],
          [2, 50]
        ]),
        elections: [],
        bids: [bid(1, 1)]
      })

      expect(outstanding).to.deep.equal([2])
    })

    it('discharges a bidder whose bid EXCEEDS its cap', function () {
      // A cap can fall below a standing bid when the team wins an earlier
      // player. The clamp still makes the election inert, and `>=` covers it.
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([[1, 3]]),
        elections: [],
        bids: [bid(1, 8)]
      })

      expect(outstanding).to.deep.equal([])
    })

    it('keeps a bidder with headroom, whose election still decides the player', function () {
      // THE CONTROL FOR THE FIRST CASE. Same shape, one number changed: team 1
      // bid $5 against a $50 cap, so electing $30 would genuinely raise its
      // claim from 5 to 30. Discharging here is the defect 25f26a564 fixed.
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 50],
          [2, 50]
        ]),
        elections: [],
        bids: [bid(1, 5)]
      })

      expect(outstanding).to.deep.equal([1, 2])
    })

    // REJECTED ALTERNATIVE ONE: discharge on `bid >= current_price`, which is
    // discharging the LEADER. It settles the live case too, and it is unsafe.
    // A leader at $5 holding $50 would be discharged, a rival would then elect
    // $30, and the leader would settle away at $6 never having been asked
    // whether it would go above $5. This case fails under that rule and passes
    // under the cap comparison, which is the only thing separating them.
    it('keeps the LEADER when its cap is above its own leading bid', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([[7, 50]]),
        elections: [],
        // The highest bid on the board, so team 7 leads at 5.
        bids: [bid(7, 5)]
      })

      expect(
        outstanding,
        'leading is not the same as being unable to bid higher'
      ).to.deep.equal([7])
    })

    // REJECTED ALTERNATIVE TWO: tighten has_cap_space from >= to >, so a team
    // whose cap equals the price falls out of the eligible set. That also
    // settles the live case and it silently removes a team whose election is
    // the only thing that could put it in contention.
    it('keeps a team at exactly the price that has NOT bid', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([[4, 1]]),
        elections: [],
        // No bid from team 4 at all, so it holds no claim and electing is the
        // only way it can win.
        bids: [bid(9, 1)]
      })

      expect(
        outstanding,
        'a team holding no claim still has an election that decides the player'
      ).to.deep.equal([4])
    })

    it('still discharges on a live election, whatever the bids say', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 50],
          [2, 50]
        ]),
        elections: [{ tid: 1, maximum_bid: 30 }],
        bids: [bid(1, 5)]
      })

      expect(outstanding).to.deep.equal([2])
    })

    it('takes the HIGHEST of several bids from one team', function () {
      // Anchored on the max rather than the last, because the bid rows arrive
      // in occurrence order and a team can be outbid and re-bid.
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([[1, 4]]),
        elections: [],
        bids: [bid(1, 4), bid(1, 2)]
      })

      expect(outstanding).to.deep.equal([])
    })
  })

  describe('against a real settlement', function () {
    const all_team_ids = async () => {
      const teams = await knex('teams').where({ lid: league_id, season_year })
      return teams.map((team) => team.team_id).sort((a, b) => a - b)
    }

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

    // THE LIVE SHAPE, reproduced: every team has elected except one, and that
    // one leads the board on a bid it cannot raise because the bid already
    // reaches its cap. Before this rule the player sat open indefinitely.
    it('settles a player whose only holdout cannot raise its own claim', async function () {
      this.timeout(60 * 1000)
      const player = await selectPlayer({
        exclude_rostered_players: true,
        random: false
      })
      const pid = player.pid
      const tids = await all_team_ids()
      const [nominator, holdout, ...rest] = tids

      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: nominator,
        value: 0,
        maximum_bid: 0
      })

      // The holdout takes the lead at its ENTIRE remaining budget. The rule
      // compares the bid against available_cap, and the fixture zeroes every
      // salary above, so available_cap is the league cap -- the bid is raised to
      // meet it rather than the cap lowered to meet the bid.
      const { salary_cap: cap } = await getLeague({ lid: league_id })
      expect(cap, 'the fixture must configure a cap above zero').to.be.above(0)
      await write_bid({ pid, tid: holdout, value: cap })

      for (const tid of rest) {
        await write_election({ pid, tid, maximum_bid: null })
      }

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(
        status.outstanding_election_tids,
        'the holdout bid its whole cap, so nothing it elects can raise its claim'
      ).to.deep.equal([])

      const { settlement } = await settle_auction_player_if_complete({
        lid: league_id
      })

      expect(
        settlement,
        'the player settles with no election from the holdout'
      ).to.not.equal(null)
      expect(settlement.pid).to.equal(pid)
      expect(
        settlement.winner_tid,
        'and it wins on the binding bid it already placed'
      ).to.equal(holdout)
    })

    // THE PAIR FOR THE CASE ABOVE. Same fixture, same holdout, one number
    // different: it bids well below its cap, so its election still matters and
    // the auction must keep waiting. Without this, "it settled" is equally
    // consistent with a rule that discharges every bidder.
    it('keeps waiting when that same holdout has cap left to bid with', async function () {
      this.timeout(60 * 1000)
      const player = await selectPlayer({
        exclude_rostered_players: true,
        random: false
      })
      const pid = player.pid
      const tids = await all_team_ids()
      const [nominator, holdout, ...rest] = tids

      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: nominator,
        value: 0,
        maximum_bid: 0
      })

      await write_bid({ pid, tid: holdout, value: 1 })

      for (const tid of rest) {
        await write_election({ pid, tid, maximum_bid: null })
      }

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(
        status.outstanding_election_tids,
        'a $1 bid against a full cap leaves the holdout able to raise its claim'
      ).to.deep.equal([holdout])

      const { settlement } = await settle_auction_player_if_complete({
        lid: league_id
      })
      expect(settlement, 'so the player must not settle').to.equal(null)
    })
  })
})
