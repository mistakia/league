/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Roster from '#libs-shared/roster.mjs'
import getRoster from '#libs-server/get-roster.mjs'
import getLeague from '#libs-server/get-league.mjs'
import Auction from '#api/sockets/auction.mjs'
import selectPlayer from './utils/select-player.mjs'
import fillRoster from './utils/fill-roster.mjs'
import addPlayer from './utils/add-player.mjs'
import make_recording_timers from './utils/recording-timers.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// The fixture's commissioner, asserted in `build_live_auction` rather than
// trusted. `MANAGER_USER_ID` is any non-commissioner, and both have a recording
// client in every spec that drives them.
const COMMISSIONER_USER_ID = 1
const MANAGER_USER_ID = 2

// Every rejection in this file is asserted through the error the manager
// actually receives, because that string is the only thing distinguishing one
// refusal from another. `_validate_nomination` and `_validate_bid` both return
// a bare `false` for cap, position and roster-space failures alike, so a spec
// that asserted "no transaction was written" would pass identically whichever
// check fired -- and would still pass if the handler started refusing
// everything. Hence a recording client per user id.
const make_recording_wss = (user_ids) => {
  const errors = []
  const clients = new Set(
    user_ids.map((user_id) => ({
      user_id,
      league_id,
      // `ws`'s WebSocket.OPEN. Hardcoded rather than imported so the stub does
      // not depend on the transport it is standing in for.
      readyState: 1,
      send: (payload) => {
        const event = JSON.parse(payload)
        if (event.type === 'AUCTION_ERROR') {
          errors.push({ user_id, error: event.payload.error })
        }
      }
    }))
  )
  return { wss: { clients }, errors }
}

const count_auction_transactions = async () => {
  const rows = await knex('transactions')
    .where({ lid: league_id, season_year })
    .whereIn('type', [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ])
  return rows.length
}

// n distinct unrostered players at one position. `selectPlayer` returns a single
// row, so building a position-limit scenario means threading the exclusion list
// through repeated calls.
const select_players = async ({ pos, count, exclude_pids = [] }) => {
  const selected = []
  const excluded = [...exclude_pids]
  for (let index = 0; index < count; index++) {
    const player = await selectPlayer({
      pos,
      random: false,
      exclude_rostered_players: true,
      exclude_pids: excluded
    })
    expect(player, `a ${pos} was available on selection ${index + 1}`).to.exist
    selected.push(player)
    excluded.push(player.pid)
  }
  return selected
}

// $195 of the fixture's $200 cap consumed across four running backs, leaving
// exactly CAP_REMAINING_AFTER_SEED and plenty of open active spots. RB is used
// deliberately: its fixture limit is 0, which `has_position_capacity` reads as
// unlimited, so a cap spec built on this roster cannot be refused by the
// position check instead.
//
// The salaries and the remaining cap are declared together because five specs
// assert one against the other -- spelling `5` at each call site is how that
// pair silently drifts apart.
const SEED_SALARIES = [48, 48, 48, 51]
const CAP_REMAINING_AFTER_SEED = 5

const seed_cap_exhausted_roster = async ({ team_id, user_id }) => {
  const salaried = await select_players({ pos: 'RB', count: 4 })
  for (const [index, player] of salaried.entries()) {
    await addPlayer({
      leagueId: league_id,
      teamId: team_id,
      player,
      userId: user_id,
      value: SEED_SALARIES[index]
    })
  }
  return salaried
}

// Three kickers against the fixture's `max_roster_kicker` of 3, which with
// DST is one of only two positions the fixture caps at all.
const seed_position_capped_roster = async ({ team_id, user_id, count = 3 }) => {
  const kickers = await select_players({ pos: 'K', count: count + 1 })
  for (const player of kickers.slice(0, count)) {
    await addPlayer({
      leagueId: league_id,
      teamId: team_id,
      player,
      userId: user_id,
      value: 1
    })
  }
  // The spare is the one a spec tries to add on top of the limit.
  return { seeded: kickers.slice(0, count), spare: kickers[count] }
}

const build_live_auction = async ({ user_ids }) => {
  const { wss, errors } = make_recording_wss(user_ids)
  const auction = new Auction({
    wss,
    lid: league_id,
    timers: make_recording_timers()
  })
  await auction.setup()

  // LIVE mode explicitly. The $0 nomination clamp and the cached-capacity
  // refresh are both gated on `_election_mode` being false, and the fixture's
  // mode is derived from the free agency period rather than stated -- so a spec
  // that let it default would silently change meaning when the period moves.
  auction._election_mode = false
  auction.start()
  expect(auction._paused, 'the auction is running').to.equal(false)

  // THE COMMISSIONER IDENTITY IS LOAD-BEARING TWICE OVER, so it is pinned here
  // rather than read where it is used. The $0 nomination clamp keys on it, and
  // every recording client in this file is created for a hardcoded user id --
  // so a fixture that moved the commissioner would both change which
  // nominations get clamped AND leave replies going to a user with no client,
  // where an `expect(errors).to.deep.equal([])` passes without the handler
  // being consulted at all.
  expect(
    auction._league.commissioner_user_id,
    'the fixture commissioner is user 1; if it moves, the $0 clamp cases and ' +
      'every empty-errors assertion in this file stop testing what they name'
  ).to.equal(COMMISSIONER_USER_ID)

  return { auction, errors }
}

const roster_for = async (team_id) => {
  const league_row = await getLeague({ lid: league_id })
  return new Roster({
    roster: await getRoster({ tid: team_id }),
    league: league_row
  })
}

describe('auction eligibility validation', function () {
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
  })

  describe('nomination eligibility', function () {
    // The nominating team is the head of the rotation whenever the transaction
    // log is empty -- `resolve_nominating_team_id` returns `tids[0]` without
    // consulting capacity -- which is what lets a cap-exhausted or roster-full
    // team be put on the clock at all.
    //
    // EVERY NOMINATION HERE IS DRIVEN AS A MANAGER, NOT AS THE COMMISSIONER,
    // and that is the point rather than an incidental choice.
    // `_validate_nomination` returns true immediately -- skipping the cap,
    // position and roster-space guards entirely -- when the caller is the
    // commissioner and the nomination timer has expired. An earlier version of
    // this block used the commissioner throughout, which meant the guards were
    // reached only because one unrelated flag happened to be false: removing
    // the `_nomination_timer_expired` conjunct from that bypass left all three
    // rejection specs green while no nomination was validated at all.
    //
    // So the ordinary path is the one under test, and the bypass is asserted
    // inactive rather than assumed so.
    const expect_guards_are_reachable = (auction) => {
      expect(
        auction._nomination_timer_expired,
        'the commissioner bypass in _validate_nomination is inactive, so ' +
          'these specs exercise the guards rather than skipping them'
      ).to.equal(false)
      expect(
        MANAGER_USER_ID,
        'nominations here are driven as a non-commissioner'
      ).to.not.equal(auction._league.commissioner_user_id)
    }
    it('rejects a nomination whose value exceeds the team cap', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      await seed_cap_exhausted_roster({
        team_id,
        user_id: MANAGER_USER_ID
      })

      const roster = await roster_for(team_id)
      expect(roster.availableCap, 'the seeded cap boundary').to.equal(
        CAP_REMAINING_AFTER_SEED
      )
      expect(roster.availableSpace, 'active spots remain').to.be.above(0)

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        {
          pid: target.pid,
          value: CAP_REMAINING_AFTER_SEED + 1,
          user_id: MANAGER_USER_ID
        },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds salary limit' }
      ])
    })

    it('accepts a nomination at exactly the remaining cap', async function () {
      // The negative control for the cap rejection. Same roster, one dollar
      // less asked for. Without this the assertion above passes on a handler
      // that refuses every nomination for an unrelated reason.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      await seed_cap_exhausted_roster({
        team_id,
        user_id: MANAGER_USER_ID
      })

      const roster = await roster_for(team_id)
      expect(roster.availableCap, 'the seeded cap boundary').to.equal(
        CAP_REMAINING_AFTER_SEED
      )

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        {
          pid: target.pid,
          value: CAP_REMAINING_AFTER_SEED,
          user_id: MANAGER_USER_ID
        },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'no rejection at the cap boundary').to.deep.equal([])

      // The recorded amount is pinned too, because acceptance alone cannot
      // tell the cap check passing from the cap check never running. A manager
      // nomination opens at $0 whatever it asked for -- so $0 here is the
      // clamp having fired on a nomination the cap check ALREADY cleared at
      // the full $5, and the commissioner block pins the un-clamped side.
      const [nomination] = await knex('transactions')
        .where({
          lid: league_id,
          season_year,
          pid: target.pid,
          type: transaction_types.AUCTION_BID
        })
        .orderBy('transaction_id', 'desc')
        .limit(1)
      expect(
        nomination.player_salary,
        'a manager nomination opens at $0 once the cap check has cleared it'
      ).to.equal(0)
    })

    it('rejects a nomination that would exceed the position limit', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      // Kicker is one of the two positions the fixture actually caps
      // (`max_roster_kicker` = 3); QB/RB/WR/TE all sit at 0, which
      // `has_position_capacity` reads as unlimited. A position-limit spec
      // written against RB would assert nothing.
      const league_row = await getLeague({ lid: league_id })
      const kicker_limit = league_row.max_roster_kicker
      expect(kicker_limit, 'the fixture caps kickers').to.equal(3)

      const { spare } = await seed_position_capped_roster({
        team_id,
        user_id: MANAGER_USER_ID,
        count: kicker_limit
      })

      // The isolating preconditions are COUNTED FROM THE DATABASE rather than
      // read back through `has_bench_space_for_position`. Asserting the
      // predicate the handler is about to call makes a roster-layer regression
      // fail here in the setup, so a real defect reads as a broken fixture
      // rather than as the eligibility rule it belongs to.
      const kicker_count = await knex('rosters_players')
        .where({ tid: team_id, lid: league_id, season_year })
        .where('player_position', 'K')
        .then((rows) => rows.length)
      expect(
        kicker_count,
        'the team sits exactly at the kicker limit'
      ).to.equal(kicker_limit)

      const roster = await roster_for(team_id)
      expect(roster.availableSpace, 'active spots remain').to.be.above(0)
      expect(roster.availableCap, 'cap remains').to.be.above(0)

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: spare.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds roster limits' }
      ])
    })

    it('accepts a nomination at an uncapped position on the same roster', async function () {
      // The negative control for the position limit: the identical
      // three-kicker roster takes a running back without complaint, so the
      // refusal above is the kicker cap and not the roster generally.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      await seed_position_capped_roster({
        team_id,
        user_id: MANAGER_USER_ID
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'an uncapped position is nominable').to.deep.equal([])
    })

    it('rejects a nomination from a team with no roster space', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      // `fillRoster` signs at $0, so the cap is untouched and roster fullness
      // is the only condition present. `has_bench_space_for_position`
      // short-circuits on `isFull` before consulting the position limit, so
      // this exercises a different branch than the kicker spec above.
      await fillRoster({ leagueId: league_id, teamId: team_id, userId: 1 })

      const roster = await roster_for(team_id)
      expect(roster.availableSpace, 'the active roster is full').to.equal(0)
      expect(roster.availableCap, 'cap is not the reason').to.be.above(0)

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds roster limits' }
      ])
    })

    it('accepts a nomination from a team with one spot left', async function () {
      // The negative control for roster space. One release from the full
      // roster above and the same nomination goes through, so the refusal
      // tracks the last open spot rather than anything about a heavily
      // populated roster.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const team_id = auction._tids[0]

      await fillRoster({ leagueId: league_id, teamId: team_id, userId: 1 })

      const roster_row = await getRoster({ tid: team_id })
      const league_row = await getLeague({ lid: league_id })
      const filled = new Roster({ roster: roster_row, league: league_row })
      const [released] = filled.active
      await knex('rosters_players')
        .where({ pid: released.pid, tid: team_id, season_year })
        .del()

      const roster = await roster_for(team_id)
      expect(roster.availableSpace, 'exactly one spot is open').to.equal(1)

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'one open spot is enough').to.deep.equal([])
    })

    // THE TURN CHECK IS THE ONLY NOMINATION GUARD WITH A DISTINCT ERROR
    // STRING -- 'invalid nomination' rather than the shared 'exceeds ...'
    // pair -- so these are the one place in this file where the reply
    // distinguishes the guard on its own. The rosters are deliberately left
    // untouched: both teams can afford and hold the player, so the only thing
    // separating the refusal from the acceptance below is which `tid` asked.
    //
    // `nominating_team_id` is `_tids[0]` while the transaction log is empty,
    // which is what makes `_tids[1]` an out-of-turn nominator without any
    // setup.
    it('rejects a nomination from a team that is not on the clock', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const [on_the_clock, out_of_turn] = auction._tids
      expect(
        auction.nominating_team_id,
        'the first team holds the clock on an empty log'
      ).to.equal(on_the_clock)
      expect(
        out_of_turn,
        'a second team exists to nominate out of turn'
      ).to.not.equal(on_the_clock)

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: out_of_turn }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'invalid nomination' }
      ])
    })

    it('accepts the same nomination from the team on the clock', async function () {
      // The negative control for the turn check. Identical player, identical
      // socket identity, identical untouched rosters -- only the `tid` moves
      // to the team the rotation actually put on the clock. Without this the
      // refusal above passes on a handler that refuses every nomination.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      expect_guards_are_reachable(auction)
      const on_the_clock = auction.nominating_team_id

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: on_the_clock }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'the team on the clock may nominate').to.deep.equal([])
    })

    it('lets the commissioner nominate past the turn check, and opens the player for the team on the clock', async function () {
      // TWO RULES MEET HERE, and reading either one alone gets the outcome
      // wrong.
      //
      // The turn check sits BELOW the commissioner early return, so the
      // commissioner bypass covers it: the same out-of-turn `tid` the spec
      // above is refused for goes through. That much is the bypass.
      //
      // But the request `tid` is ONLY an input to the turn check.
      // `_create_nomination_bid` writes `tid: nominating_team_id`, so the
      // nomination is recorded for whichever team the ROTATION has on the
      // clock, never for the team named in the request. The commissioner
      // therefore nominates ON BEHALF OF the team whose clock ran out -- they
      // cannot hand a player to a team out of turn, which is what a reader who
      // stopped at the bypass would expect.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [on_the_clock, out_of_turn] = auction._tids
      expect(auction.nominating_team_id).to.equal(on_the_clock)

      auction._nomination_timer_expired = true

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: COMMISSIONER_USER_ID },
        { user_id: COMMISSIONER_USER_ID, tid: out_of_turn }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(
        errors,
        'the commissioner bypass covers the turn check'
      ).to.deep.equal([])

      // WHICH TEAM the nomination was recorded for, not merely that one
      // appeared. Asserting only the count would leave this spec unable to
      // tell the shipped rule from the one a reader assumes, and would keep
      // passing if the request `tid` ever started reaching the bid.
      const [nomination] = await knex('transactions')
        .where({
          lid: league_id,
          season_year,
          pid: target.pid,
          type: transaction_types.AUCTION_BID
        })
        .orderBy('transaction_id', 'desc')
        .limit(1)
      expect(
        nomination.tid,
        'opened for the team on the clock, not the requested tid'
      ).to.equal(on_the_clock)
      expect(
        nomination.tid,
        'the requested tid did not reach the bid'
      ).to.not.equal(out_of_turn)
    })
  })

  describe('bid eligibility', function () {
    // A bid is validated against the CACHED team capacity (`_teams`), not
    // against a fresh roster read -- so these drive `nominate` first, which is
    // what refreshes that cache in live mode.
    const open_a_nomination = async ({ auction, nominating_team_id }) => {
      const player = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })
      await auction.nominate(
        { pid: player.pid, value: 0, user_id: 1 },
        { user_id: 1, tid: nominating_team_id }
      )
      const current = auction._transactions[0]
      expect(current, 'a nomination is open').to.exist
      expect(current.type).to.equal(transaction_types.AUCTION_BID)
      return player
    }

    it('rejects a bid that exceeds the bidding team cap', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await seed_cap_exhausted_roster({
        team_id: bidding_team_id,
        user_id: MANAGER_USER_ID
      })

      const player = await open_a_nomination({ auction, nominating_team_id })

      const bidding_team = auction._teams.find(
        (team) => team.team_id === bidding_team_id
      )
      expect(bidding_team.cap, 'the cached cap boundary').to.equal(
        CAP_REMAINING_AFTER_SEED
      )
      expect(
        bidding_team.availableSpace,
        'space is not the reason'
      ).to.be.above(0)

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: MANAGER_USER_ID,
        tid: bidding_team_id,
        pid: player.pid,
        value: CAP_REMAINING_AFTER_SEED + 1
      })

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds salary limit' }
      ])
    })

    it('accepts a bid at exactly the bidding team cap', async function () {
      // The negative control for the bid cap check, which is `cap - value < 0`
      // rather than `<= 0` -- spending the last dollar is legal and the
      // rejection must not extend to it.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await seed_cap_exhausted_roster({
        team_id: bidding_team_id,
        user_id: MANAGER_USER_ID
      })

      const player = await open_a_nomination({ auction, nominating_team_id })

      const bidding_team = auction._teams.find(
        (team) => team.team_id === bidding_team_id
      )
      expect(bidding_team.cap, 'the cached cap boundary').to.equal(
        CAP_REMAINING_AFTER_SEED
      )

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: MANAGER_USER_ID,
        tid: bidding_team_id,
        pid: player.pid,
        value: CAP_REMAINING_AFTER_SEED
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'the last dollar is spendable').to.deep.equal([])

      const [bid] = await knex('transactions')
        .where({
          lid: league_id,
          season_year,
          pid: player.pid,
          type: transaction_types.AUCTION_BID
        })
        .orderBy('transaction_id', 'desc')
        .limit(1)
      expect(bid.player_salary, 'the whole remaining cap was bid').to.equal(
        CAP_REMAINING_AFTER_SEED
      )
      expect(bid.tid, 'by the cap-exhausted team').to.equal(bidding_team_id)
    })

    it('rejects a bid from a team with no roster space', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await fillRoster({
        leagueId: league_id,
        teamId: bidding_team_id,
        userId: 2
      })

      const player = await open_a_nomination({ auction, nominating_team_id })

      const bidding_team = auction._teams.find(
        (team) => team.team_id === bidding_team_id
      )
      expect(bidding_team.availableSpace, 'the roster is full').to.equal(0)
      expect(bidding_team.cap, 'cap is not the reason').to.be.above(0)

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: 2,
        tid: bidding_team_id,
        pid: player.pid,
        value: 5
      })

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: 2, error: 'exceeds roster limits' }
      ])
    })

    it('accepts a bid from a team with one spot left', async function () {
      // The negative control for the bid roster-space check.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await fillRoster({
        leagueId: league_id,
        teamId: bidding_team_id,
        userId: 2
      })

      const league_row = await getLeague({ lid: league_id })
      const filled = new Roster({
        roster: await getRoster({ tid: bidding_team_id }),
        league: league_row
      })
      const [released] = filled.active
      await knex('rosters_players')
        .where({ pid: released.pid, tid: bidding_team_id, season_year })
        .del()

      const player = await open_a_nomination({ auction, nominating_team_id })

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: 2,
        tid: bidding_team_id,
        pid: player.pid,
        value: 5
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'one open spot is enough to bid').to.deep.equal([])
    })

    // POSITION LIMITS ARE NOT A BID-TIME CHECK, and the auction is not wrong to
    // work that way -- but it means the rule lives at the AWARD, so these drive
    // a real `sold()` rather than calling the validator. Calling
    // `_validate_team_can_acquire_player` directly tests the method and says
    // nothing about whether `sold()` still calls it: deleting the invocation
    // from `sold()` left an earlier version of this whole file green while a
    // team over the kicker limit would have been awarded a fourth kicker.
    //
    // The first spec below also documents the gap it depends on -- the bid IS
    // accepted -- so if a bid-time position check is ever added, this spec
    // fails and says so rather than quietly testing nothing.
    const settled_rows_for = async (pid) =>
      knex('rosters_players').where({ pid, lid: league_id, season_year })

    it('refuses to award a player that would exceed the position limit', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      const league_row = await getLeague({ lid: league_id })
      const { spare } = await seed_position_capped_roster({
        team_id: bidding_team_id,
        user_id: MANAGER_USER_ID,
        count: league_row.max_roster_kicker
      })

      // The nominating team has no kickers, so it can legally open one; the
      // limit belongs to the team that will win it.
      await auction.nominate(
        { pid: spare.pid, value: 0, user_id: COMMISSIONER_USER_ID },
        { user_id: COMMISSIONER_USER_ID, tid: nominating_team_id }
      )

      await auction.bid({
        user_id: MANAGER_USER_ID,
        tid: bidding_team_id,
        pid: spare.pid,
        value: 1
      })
      expect(
        errors,
        'the bid is ACCEPTED -- there is no bid-time position check, and this ' +
          'spec depends on that. If a bid-time check is added, assert it here.'
      ).to.deep.equal([])
      expect(
        auction._transactions[0].tid,
        'the over-limit team holds the top bid'
      ).to.equal(bidding_team_id)

      await auction.sold()

      expect(
        await settled_rows_for(spare.pid),
        'a fourth kicker was not rostered'
      ).to.have.length(0)
      const processed = await knex('transactions').where({
        lid: league_id,
        season_year,
        pid: spare.pid,
        type: transaction_types.AUCTION_PROCESSED
      })
      expect(processed, 'the award was not recorded').to.have.length(0)
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds roster limits' }
      ])
    })

    it('awards an uncapped position through the same settlement path', async function () {
      // The negative control for the spec above, and the thing that makes it
      // meaningful: the identical flow on a running back DOES roster the
      // player, so the refusal above is the kicker limit rather than `sold()`
      // declining for any of the several other reasons it can.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await seed_position_capped_roster({
        team_id: bidding_team_id,
        user_id: MANAGER_USER_ID
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      await auction.nominate(
        { pid: target.pid, value: 0, user_id: COMMISSIONER_USER_ID },
        { user_id: COMMISSIONER_USER_ID, tid: nominating_team_id }
      )
      await auction.bid({
        user_id: MANAGER_USER_ID,
        tid: bidding_team_id,
        pid: target.pid,
        value: 1
      })

      await auction.sold()

      const rostered = await settled_rows_for(target.pid)
      expect(rostered, 'the running back was rostered').to.have.length(1)
      expect(rostered[0].tid, 'to the winning team').to.equal(bidding_team_id)
      expect(errors, 'no refusal on the control path').to.deep.equal([])
    })

    // THE AWARD CAP CHECK IS ONLY REACHABLE THROUGH A STALE CACHE, which is
    // why this spec goes to the trouble of producing one rather than simply
    // bidding over the cap. `_validate_bid` enforces the same bound against
    // `_teams` at bid time, so on a cache that agrees with the database the two
    // checks can never disagree and the award branch is dead code.
    //
    // It comes alive exactly where `nominate`'s own comment says it does: a
    // trade or a commissioner-override release moves a team's real cap during a
    // live block, the socket's cached capacity does not follow, and `sold()`
    // re-reads the roster from the database under the settlement lock. Signing
    // a player a team can no longer afford is the failure this prevents.
    it('refuses to award a player the team can no longer afford', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      await seed_cap_exhausted_roster({
        team_id: bidding_team_id,
        user_id: MANAGER_USER_ID
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      await auction.nominate(
        { pid: target.pid, value: 0, user_id: COMMISSIONER_USER_ID },
        { user_id: COMMISSIONER_USER_ID, tid: nominating_team_id }
      )

      // Legal on the board as the auction sees it: the whole remaining cap.
      await auction.bid({
        user_id: MANAGER_USER_ID,
        tid: bidding_team_id,
        pid: target.pid,
        value: CAP_REMAINING_AFTER_SEED
      })
      expect(errors, 'the bid stands at the cached cap').to.deep.equal([])

      // The cap moves underneath the open bid, and nothing tells the socket.
      // This is the trade-or-release case; `_teams` still carries the old
      // figure, which is precisely why the award has to re-read.
      //
      // `target` must be excluded explicitly: it is not rostered yet, and
      // `select_players` walks unrostered players in pid order, so without this
      // it hands back the very player under auction -- which rosters the target
      // in setup and makes the assertion below pass for the wrong reason.
      const [extra] = await select_players({
        pos: 'RB',
        count: 1,
        exclude_pids: [target.pid]
      })
      await addPlayer({
        leagueId: league_id,
        teamId: bidding_team_id,
        player: extra,
        userId: MANAGER_USER_ID,
        value: CAP_REMAINING_AFTER_SEED - 2
      })

      const stale = auction._teams.find(
        (team) => team.team_id === bidding_team_id
      )
      expect(stale.cap, 'the cache is stale by construction').to.equal(
        CAP_REMAINING_AFTER_SEED
      )
      const fresh = await roster_for(bidding_team_id)
      expect(fresh.availableCap, 'the database disagrees').to.equal(2)

      await auction.sold()

      expect(
        await settled_rows_for(target.pid),
        'the unaffordable player was not rostered'
      ).to.have.length(0)
      // Addressed to the bidder. `_validate_team_can_acquire_player` replies to
      // `_transactions[0].user_id` on this branch rather than to the `bid` it
      // was handed -- on the live path those coincide, because the top
      // transaction IS the winning bid, so the misaddressing is latent rather
      // than observable. Pinned as the full object so that if the two ever
      // diverge, this fails instead of silently changing who gets told.
      expect(errors).to.deep.equal([
        { user_id: MANAGER_USER_ID, error: 'exceeds salary limit' }
      ])
    })
  })

  describe('commissioner nomination value', function () {
    // THE CURRENT RULE IS THE INVERSE OF THE 2020 BRAINSTORM. That note asked
    // for the commissioner's nomination to be forced to $0; the handler forces
    // every OTHER nomination to $0 and preserves the commissioner's stated
    // amount, which is what lets a commissioner open a player at a price when
    // acting for an absent manager. These two specs pin the behaviour that
    // ships, and the divergence is recorded on the task entity.
    it('preserves the stated amount when the commissioner nominates', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
      const team_id = auction._tids[0]
      const commissioner_user_id = auction._league.commissioner_user_id
      expect(commissioner_user_id, 'the fixture has a commissioner').to.exist

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      await auction.nominate(
        { pid: target.pid, value: 25, user_id: commissioner_user_id },
        { user_id: commissioner_user_id, tid: team_id }
      )

      const [nomination] = await knex('transactions')
        .where({
          lid: league_id,
          season_year,
          pid: target.pid,
          type: transaction_types.AUCTION_BID
        })
        .orderBy('transaction_id', 'desc')
        .limit(1)

      expect(nomination, 'the nomination was recorded').to.exist
      expect(
        nomination.player_salary,
        'the commissioner amount stands'
      ).to.equal(25)
      expect(errors).to.deep.equal([])
    })

    it('forces a non-commissioner nomination to $0', async function () {
      // The negative control for the spec above: the same $25 nomination from
      // a non-commissioner socket identity lands at $0. Without this pair
      // either assertion alone is consistent with the clamp being applied to
      // everyone or to no one.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const team_id = auction._tids[0]

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      await auction.nominate(
        { pid: target.pid, value: 25, user_id: MANAGER_USER_ID },
        { user_id: MANAGER_USER_ID, tid: team_id }
      )

      const [nomination] = await knex('transactions')
        .where({
          lid: league_id,
          season_year,
          pid: target.pid,
          type: transaction_types.AUCTION_BID
        })
        .orderBy('transaction_id', 'desc')
        .limit(1)

      expect(nomination, 'the nomination was recorded').to.exist
      expect(nomination.player_salary, 'a manager opens at $0').to.equal(0)
      expect(errors).to.deep.equal([])
    })
  })

  // The rotation skip lives in test/auction.nomination-rotation.spec.mjs:
  // `resolve_nominating_team_id` is pure, and those cases need neither the
  // league fixture nor a socket that this file's hooks build.
})
