/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  get_outstanding_election_team_ids,
  settle_auction_player_if_complete
} from '#libs-server/auction-settlement.mjs'
import { get_auction_settlement_status } from '#libs-server/auction-elections.mjs'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'
import getLeague from '#libs-server/get-league.mjs'
import getRoster from '#libs-server/get-roster.mjs'
import { Roster } from '#libs-shared'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
import { addPlayer, selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE AUCTION WAITS ON THE PRICE IT WILL SETTLE AT, NOT ON THE LAST BID PLACED.
//
// Eligibility is tested at `current_price`, the last PLACED bid, while the
// settlement prices at `runner_up.effective_maximum + 1`. On the live board
// those diverged by an order of magnitude -- Jared Goff's last placed bid was
// $2 and he settled at $25 -- so every team with a cap in between was held
// outstanding while provably unable to win. About 361 minutes across five
// players were spent open after the clearing price was already determined.
//
// AND THE GATING SET IS NOT THE BROADCAST SET. That is the leak-free half of the
// design and the property most likely to be tidied away by someone who reads the
// two computations as duplication, so it has cases of its own below.
describe('the auction stops waiting on teams the price has already passed', function () {
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

  // PURE, and every case states the caps and the ranked field explicitly, so
  // nothing turns on a fixture happening to produce the numbers the rule needs.
  describe('the rule itself', function () {
    const capacities_with_cap = (entries) =>
      new Map(
        entries.map(([tid, available_cap]) => [
          tid,
          { is_eligible: true, available_cap }
        ])
      )

    const ranked = (entries) =>
      entries.map(([tid, effective_maximum]) => ({ tid, effective_maximum }))

    // THE MEASURED CASE. Team 3 holds $20 against a field whose runner-up ceiling
    // is $24, so the player clears at $25 whatever team 3 elects.
    //
    // ITS PAIR IS THE SAME CALL WITHOUT `ranked_contenders`, which is the whole
    // decoupling: identical inputs, and the set the league is shown does not move.
    // Without this pair "it settled" is equally consistent with a rule that also
    // changed the broadcast.
    it('discharges a team whose cap the runner-up ceiling already covers', function () {
      const capacities = capacities_with_cap([
        [1, 200],
        [2, 200],
        [3, 20]
      ])
      const contenders = ranked([
        [1, 40],
        [2, 24]
      ])

      expect(
        get_outstanding_election_team_ids({
          capacities,
          elections: [{ tid: 1 }, { tid: 2 }],
          bids: [],
          ranked_contenders: contenders
        }),
        'team 3 cannot reach $25 and so cannot move the winner or the price'
      ).to.deep.equal([])

      expect(
        get_outstanding_election_team_ids({
          capacities,
          elections: [{ tid: 1 }, { tid: 2 }],
          bids: []
        }),
        'and the set the league SEES is unchanged, because it reads nothing sealed'
      ).to.deep.equal([3])
    })

    // THE BOUNDARY, one dollar the other way. $25 beats the $24 runner-up and
    // moves the price to $26, so this team is still being waited on.
    it('keeps a team one dollar above the runner-up ceiling', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 200],
          [2, 200],
          [3, 25]
        ]),
        elections: [{ tid: 1 }, { tid: 2 }],
        bids: [],
        ranked_contenders: ranked([
          [1, 40],
          [2, 24]
        ])
      })

      expect(outstanding).to.deep.equal([3])
    })

    // WHY THE BOUND IS THE PAIR AND NOT THE PRICE. At `first === second` the
    // player prices at `first`, so a rule written as `available_cap < price`
    // would discharge team 3 here -- and team 3 can match the lead and take the
    // player on the tiebreak. `available_cap < first` is the term that stops it.
    it('keeps a team whose cap ties the LEAD, which the tiebreak can still win', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 200],
          [2, 200],
          [3, 24]
        ]),
        elections: [{ tid: 1 }, { tid: 2 }],
        bids: [],
        ranked_contenders: ranked([
          [1, 24],
          [2, 24]
        ])
      })

      expect(
        outstanding,
        'matching the highest claim is a way to win, not a way to be priced out'
      ).to.deep.equal([3])
    })

    // NO RUNNER-UP MEANS NO BOUND. One contender prices at the opening bid, so
    // any eligible claim raises it. Not discharging is the conservative
    // direction and the rule takes it.
    it('discharges nobody when fewer than two teams contend', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: capacities_with_cap([
          [1, 200],
          [3, 1]
        ]),
        elections: [{ tid: 1 }],
        bids: [],
        ranked_contenders: ranked([[1, 40]])
      })

      expect(outstanding).to.deep.equal([3])
    })

    // THE EARLIER DISCHARGES STILL RUN FIRST, and the third does not widen them.
    // Team 3 is out on ELIGIBILITY here, not on the price, which is what the
    // capacity fixture says.
    it('leaves an ineligible team to the eligibility gate', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities: new Map([[3, { is_eligible: false, available_cap: 40 }]]),
        elections: [],
        bids: [],
        ranked_contenders: ranked([
          [1, 40],
          [2, 24]
        ])
      })

      expect(outstanding).to.deep.equal([])
    })
  })

  // THE RANKED FIELD IS THE RESOLVER'S TO PUBLISH, because the effective maximum
  // is `min(stated, available_cap)` and only the resolver holds the caps. A
  // gating rule that ranked claims for itself would be a second copy of the
  // clamp and the disqualifications.
  describe('the ranked field comes back with the resolution', function () {
    it('ranks on the EFFECTIVE maximum, so a clamped ceiling bounds nothing it cannot pay', function () {
      const { ranked_contenders, price } = resolve_auction_player({
        claims: [
          { tid: 1, maximum_bid: 40, commitments: [{ amount: 40, at: 1 }] },
          { tid: 2, maximum_bid: 90, commitments: [{ amount: 90, at: 2 }] }
        ],
        rosters: new Map([
          [
            1,
            {
              available_space: 5,
              available_cap: 200,
              is_eligible_for_slot: true
            }
          ],
          // Team 2 stated $90 and can fund $10. The bound other teams have to
          // beat is $10, not $90 -- publishing the stated amount would hold
          // every team between them outstanding for a claim that cannot be paid.
          [
            2,
            {
              available_space: 5,
              available_cap: 10,
              is_eligible_for_slot: true
            }
          ]
        ]),
        nominating_team_id: 1,
        opening_bid: 0
      })

      expect(ranked_contenders).to.deep.equal([
        { tid: 1, effective_maximum: 40 },
        { tid: 2, effective_maximum: 10 }
      ])
      expect(price, 'and the price agrees with the bound').to.equal(11)
    })

    it('publishes an empty field when nothing contends', function () {
      const { ranked_contenders } = resolve_auction_player({
        claims: [{ tid: 1, maximum_bid: null, commitments: [] }],
        rosters: new Map(),
        nominating_team_id: 1,
        opening_bid: 0
      })

      expect(ranked_contenders).to.deep.equal([])
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

    const read_available_cap = async (tid) => {
      const league_row = await getLeague({ lid: league_id })
      return new Roster({
        roster: await getRoster({ tid }),
        league: league_row
      }).availableCap
    }

    // A SMALLER BUDGET FOR ONE TEAM, which is the only asymmetry these cases
    // need. `availableCap` is the league cap minus the ACTIVE roster's salaries
    // and the fixture zeroes every salary, so every team starts on the full cap;
    // signing one bench player at the difference is what separates the holdout
    // from its rivals.
    //
    // A TIGHT END, never a running back. The nominated player is an RB, and a
    // charge that also consumed the holdout's RB capacity would take it out of
    // the eligible set entirely -- which settles the player for a reason that
    // has nothing to do with the rule under test.
    //
    // The read-back is not ceremony. It is the difference between a fixture that
    // produces the cap the case turns on and one that silently produces the
    // league cap, under which every case here passes vacuously.
    const set_available_cap = async ({ tid, available_cap }) => {
      const league_row = await getLeague({ lid: league_id })
      const player = await selectPlayer({
        pos: 'TE',
        exclude_rostered_players: true,
        random: false
      })

      await addPlayer({
        leagueId: league_id,
        player,
        teamId: tid,
        userId: 1,
        value: league_row.salary_cap - available_cap
      })

      expect(
        await read_available_cap(tid),
        'the fixture must actually produce the cap the case turns on'
      ).to.equal(available_cap)
    }

    // THE LIVE SHAPE. The clearing price is fixed by two elections the moment
    // they land; the last holdout can never reach it; the auction settles rather
    // than holding the board open for an answer that cannot matter.
    const build_priced_out_board = async ({ holdout_caps }) => {
      const player = await selectPlayer({
        exclude_rostered_players: true,
        random: false
      })
      const pid = player.pid
      const tids = await all_team_ids()
      const [nominator, leader, runner_up, ...remainder] = tids
      const holdouts = remainder.slice(0, holdout_caps.length)
      const rest = remainder.slice(holdout_caps.length)

      for (const [index, holdout] of holdouts.entries()) {
        await set_available_cap({
          tid: holdout,
          available_cap: holdout_caps[index]
        })
      }

      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: nominator,
        value: 0,
        maximum_bid: 0
      })

      await write_election({ pid, tid: leader, maximum_bid: 40 })
      await write_election({ pid, tid: runner_up, maximum_bid: 24 })
      for (const tid of rest) {
        await write_election({ pid, tid, maximum_bid: null })
      }

      return { pid, leader, holdouts }
    }

    const ascending = (tids) => [...tids].sort((a, b) => a - b)

    it('settles on the implied price while still showing the holdout', async function () {
      this.timeout(60 * 1000)
      const {
        pid,
        leader,
        holdouts: [holdout]
      } = await build_priced_out_board({ holdout_caps: [20] })

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(
        status.outstanding_election_tids,
        'the DISPLAYED set reads nothing sealed, so the holdout is still on it'
      ).to.deep.equal([holdout])

      const { settlement } = await settle_auction_player_if_complete({
        lid: league_id
      })

      expect(
        settlement,
        'and the auction settles anyway, because $20 cannot reach $25'
      ).to.not.equal(null)
      expect(settlement.pid).to.equal(pid)
      expect(settlement.winner_tid).to.equal(leader)
      expect(
        settlement.price,
        'second price: the runner-up ceiling plus one increment'
      ).to.equal(25)
    })

    // THE PAIR. Identical board, one number changed: the holdout can fund $30,
    // which beats the $24 runner-up and would move the price to $31. So the
    // auction must keep waiting, and the two readings differ.
    //
    // Without this, the case above is equally consistent with a gate that
    // discharges every team that has not elected.
    it('keeps waiting when that same holdout can outbid the runner-up', async function () {
      this.timeout(60 * 1000)
      const {
        holdouts: [holdout]
      } = await build_priced_out_board({ holdout_caps: [30] })

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(status.outstanding_election_tids).to.deep.equal([holdout])

      const { settlement, outstanding } =
        await settle_auction_player_if_complete({ lid: league_id })

      expect(settlement, 'the holdout can still decide this player').to.equal(
        null
      )
      expect(
        outstanding,
        'and the set handed back for broadcast is the displayed one'
      ).to.deep.equal([holdout])
    })

    // THE CONTROL FOR THE DECOUPLING, and the two cases above do not provide it.
    //
    // Neither of them can see the leak. Where the player settles the returned set
    // is empty under either rule, and where it does not the single holdout is
    // outstanding under both. Wiring the sealed rule into the BROADCAST set left
    // this file green until this case existed, which is a control that certifies
    // nothing.
    //
    // TWO HOLDOUTS, ONE OF EACH KIND, is what discriminates. The $20 team is
    // priced out and the $30 team is not, so the auction still waits -- and the
    // set it hands back for broadcast must name BOTH. Naming only the live one
    // would tell anyone watching that the runner-up's sealed ceiling sits between
    // $20 and $30, which is the leak the decoupling exists to prevent.
    it('broadcasts the priced-out holdout too, because dropping it leaks the ceiling', async function () {
      this.timeout(60 * 1000)
      const {
        holdouts: [priced_out, live]
      } = await build_priced_out_board({ holdout_caps: [20, 30] })

      const { settlement, outstanding } =
        await settle_auction_player_if_complete({ lid: league_id })

      expect(
        settlement,
        'the $30 team can still outbid the $24 runner-up, so nothing settles'
      ).to.equal(null)

      expect(
        ascending(outstanding),
        'both holdouts are displayed; only one of them is being waited on'
      ).to.deep.equal(ascending([priced_out, live]))
    })
  })
})
