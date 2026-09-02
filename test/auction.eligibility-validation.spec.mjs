/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import { Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'
import { resolve_nominating_team_id } from '#libs-server/auction-completion.mjs'
import Auction from '#api/sockets/auction.mjs'
import { selectPlayer, fillRoster, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

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

const make_recording_timers = () => {
  const scheduled = []
  return {
    scheduled,
    set_timeout: (fn, ms) => {
      scheduled.push({ fn, ms })
      return scheduled.length
    },
    clear_timeout: () => {}
  }
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

const build_live_auction = async ({ user_ids }) => {
  const { wss, errors } = make_recording_wss(user_ids)
  const timers = make_recording_timers()
  const auction = new Auction({ wss, lid: league_id, timers })
  await auction.setup()

  // LIVE mode explicitly. The $0 nomination clamp and the cached-capacity
  // refresh are both gated on `_election_mode` being false, and the fixture's
  // mode is derived from the free agency period rather than stated -- so a spec
  // that let it default would silently change meaning when the period moves.
  auction._election_mode = false
  auction.start()
  expect(auction._paused, 'the auction is running').to.equal(false)

  return { auction, errors, timers }
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
    it('rejects a nomination whose value exceeds the team cap', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
      const team_id = auction._tids[0]

      // $195 of the $200 cap consumed, leaving exactly $5 and 13 open active
      // spots. Position is RB, whose fixture limit is 0 (unlimited), so neither
      // the roster-space nor the position check can be what fires below.
      const salaried = await select_players({ pos: 'RB', count: 4 })
      const salaries = [48, 48, 48, 51]
      for (const [index, player] of salaried.entries()) {
        await addPlayer({
          leagueId: league_id,
          teamId: team_id,
          player,
          userId: 1,
          value: salaries[index]
        })
      }

      const roster = await roster_for(team_id)
      expect(roster.availableCap, 'exactly $5 of cap remains').to.equal(5)
      expect(roster.availableSpace, 'active spots remain').to.be.above(0)

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 6, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: 1, error: 'exceeds salary limit' }
      ])
    })

    it('accepts a nomination at exactly the remaining cap', async function () {
      // The negative control for the cap rejection. Same roster, one dollar
      // less asked for. Without this the assertion above passes on a handler
      // that refuses every nomination for an unrelated reason.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
      const team_id = auction._tids[0]

      const salaried = await select_players({ pos: 'RB', count: 4 })
      const salaries = [48, 48, 48, 51]
      for (const [index, player] of salaried.entries()) {
        await addPlayer({
          leagueId: league_id,
          teamId: team_id,
          player,
          userId: 1,
          value: salaries[index]
        })
      }

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 5, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'no rejection at the cap boundary').to.deep.equal([])
    })

    it('rejects a nomination that would exceed the position limit', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
      const team_id = auction._tids[0]

      // Kicker is one of the two positions the fixture actually caps
      // (`max_roster_kicker` = 3); QB/RB/WR/TE all sit at 0, which
      // `has_position_capacity` reads as unlimited. A position-limit spec
      // written against RB would assert nothing.
      const league_row = await getLeague({ lid: league_id })
      expect(league_row.max_roster_kicker, 'the fixture caps kickers').to.equal(
        3
      )

      const kickers = await select_players({ pos: 'K', count: 4 })
      for (const player of kickers.slice(0, 3)) {
        await addPlayer({
          leagueId: league_id,
          teamId: team_id,
          player,
          userId: 1,
          value: 1
        })
      }

      const roster = await roster_for(team_id)
      // The isolating assertion: the team is at the KICKER limit while the
      // active roster still has room and the cap is nearly untouched, so
      // neither of the other two rejections can fire.
      expect(roster.availableSpace, 'active spots remain').to.be.above(0)
      expect(roster.availableCap, 'cap remains').to.be.above(0)
      expect(
        roster.has_bench_space_for_position('K'),
        'no kicker capacity remains'
      ).to.equal(false)
      expect(
        roster.has_bench_space_for_position('RB'),
        'other positions are unaffected'
      ).to.equal(true)

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: kickers[3].pid, value: 0, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: 1, error: 'exceeds roster limits' }
      ])
    })

    it('accepts a nomination at an uncapped position on the same roster', async function () {
      // The negative control for the position limit: the identical
      // three-kicker roster takes a running back without complaint, so the
      // refusal above is the kicker cap and not the roster generally.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
      const team_id = auction._tids[0]

      const kickers = await select_players({ pos: 'K', count: 3 })
      for (const player of kickers) {
        await addPlayer({
          leagueId: league_id,
          teamId: team_id,
          player,
          userId: 1,
          value: 1
        })
      }

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'an uncapped position is nominable').to.deep.equal([])
    })

    it('rejects a nomination from a team with no roster space', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
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
        { pid: target.pid, value: 0, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: 1, error: 'exceeds roster limits' }
      ])
    })

    it('accepts a nomination from a team with one spot left', async function () {
      // The negative control for roster space. One release from the full
      // roster above and the same nomination goes through, so the refusal
      // tracks the last open spot rather than anything about a heavily
      // populated roster.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1] })
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
        { pid: target.pid, value: 0, user_id: 1 },
        { user_id: 1, tid: team_id }
      )

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'one open spot is enough').to.deep.equal([])
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

      const salaried = await select_players({ pos: 'RB', count: 4 })
      const salaries = [48, 48, 48, 51]
      for (const [index, player] of salaried.entries()) {
        await addPlayer({
          leagueId: league_id,
          teamId: bidding_team_id,
          player,
          userId: 2,
          value: salaries[index]
        })
      }

      const player = await open_a_nomination({ auction, nominating_team_id })

      const bidding_team = auction._teams.find(
        (team) => team.team_id === bidding_team_id
      )
      expect(bidding_team.cap, 'the cached cap is $5').to.equal(5)
      expect(
        bidding_team.availableSpace,
        'space is not the reason'
      ).to.be.above(0)

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: 2,
        tid: bidding_team_id,
        pid: player.pid,
        value: 6
      })

      expect(await count_auction_transactions()).to.equal(before)
      expect(errors).to.deep.equal([
        { user_id: 2, error: 'exceeds salary limit' }
      ])
    })

    it('accepts a bid at exactly the bidding team cap', async function () {
      // The negative control for the bid cap check, which is `cap - value < 0`
      // rather than `<= 0` -- spending the last dollar is legal and the
      // rejection must not extend to it.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const [nominating_team_id, bidding_team_id] = auction._tids

      const salaried = await select_players({ pos: 'RB', count: 4 })
      const salaries = [48, 48, 48, 51]
      for (const [index, player] of salaried.entries()) {
        await addPlayer({
          leagueId: league_id,
          teamId: bidding_team_id,
          player,
          userId: 2,
          value: salaries[index]
        })
      }

      const player = await open_a_nomination({ auction, nominating_team_id })

      const before = await count_auction_transactions()
      await auction.bid({
        user_id: 2,
        tid: bidding_team_id,
        pid: player.pid,
        value: 5
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'the last dollar is spendable').to.deep.equal([])
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

    // POSITION LIMITS ARE NOT A BID-TIME CHECK. `_validate_bid` tests cap,
    // roster space, player identity and bid magnitude, and nothing else -- a
    // team already at `max_roster_kicker` can bid on a fourth kicker and the
    // bid is recorded. The limit is enforced when the player is awarded, by
    // `_validate_team_can_acquire_player`, so that is where the rule is
    // asserted. See the task entity for the reporting of that gap.
    it('refuses to award a player that would exceed the position limit', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const bidding_team_id = auction._tids[1]

      const kickers = await select_players({ pos: 'K', count: 4 })
      for (const player of kickers.slice(0, 3)) {
        await addPlayer({
          leagueId: league_id,
          teamId: bidding_team_id,
          player,
          userId: 2,
          value: 1
        })
      }

      const roster = await roster_for(bidding_team_id)
      expect(roster.availableSpace, 'active spots remain').to.be.above(0)
      expect(roster.availableCap, 'cap remains').to.be.above(0)

      const [player_info] = await knex('player').where('pid', kickers[3].pid)
      const acquirable = auction._validate_team_can_acquire_player(
        roster,
        player_info,
        1,
        { tid: bidding_team_id, user_id: 2, pid: player_info.pid }
      )

      expect(acquirable, 'a fourth kicker is not awardable').to.equal(false)
      expect(errors).to.deep.equal([
        { user_id: 2, error: 'exceeds roster limits' }
      ])
    })

    it('awards an uncapped position to the same roster', async function () {
      // The negative control for the settlement position check.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const bidding_team_id = auction._tids[1]

      const kickers = await select_players({ pos: 'K', count: 3 })
      for (const player of kickers) {
        await addPlayer({
          leagueId: league_id,
          teamId: bidding_team_id,
          player,
          userId: 2,
          value: 1
        })
      }

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })
      const [player_info] = await knex('player').where('pid', target.pid)
      const roster = await roster_for(bidding_team_id)

      const acquirable = auction._validate_team_can_acquire_player(
        roster,
        player_info,
        1,
        { tid: bidding_team_id, user_id: 2, pid: player_info.pid }
      )

      expect(acquirable, 'a running back is awardable').to.equal(true)
      expect(errors).to.deep.equal([])
    })

    it('refuses to award a player the team cannot afford', async function () {
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({ user_ids: [1, 2] })
      const bidding_team_id = auction._tids[1]

      const salaried = await select_players({ pos: 'RB', count: 4 })
      const salaries = [48, 48, 48, 51]
      for (const [index, player] of salaried.entries()) {
        await addPlayer({
          leagueId: league_id,
          teamId: bidding_team_id,
          player,
          userId: 2,
          value: salaries[index]
        })
      }

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })
      const [player_info] = await knex('player').where('pid', target.pid)
      const roster = await roster_for(bidding_team_id)
      expect(roster.availableCap, 'exactly $5 of cap remains').to.equal(5)

      // `_validate_team_can_acquire_player` replies to
      // `_transactions[0].user_id` on the cap branch rather than to the bid it
      // was handed, so a nomination has to be open for that read to resolve.
      await auction.nominate(
        { pid: target.pid, value: 0, user_id: 1 },
        { user_id: 1, tid: auction._tids[0] }
      )

      const acquirable = auction._validate_team_can_acquire_player(
        roster,
        player_info,
        6,
        { tid: bidding_team_id, user_id: 2, pid: player_info.pid }
      )

      expect(acquirable, '$6 against $5 of cap is not awardable').to.equal(
        false
      )
      expect(errors.map((entry) => entry.error)).to.deep.equal([
        'exceeds salary limit'
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
      const commissioner_user_id = auction._league.commissioner_user_id
      const manager_user_id = commissioner_user_id === 2 ? 3 : 2

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      await auction.nominate(
        { pid: target.pid, value: 25, user_id: manager_user_id },
        { user_id: manager_user_id, tid: team_id }
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

  describe('nomination rotation skips ineligible teams', function () {
    // `resolve_nominating_team_id` is pure and is the ONE implementation of the
    // rotation rule, so the skip is asserted against it directly rather than
    // through a socket. The rotation only advances past a team when the newest
    // transaction is an AUCTION_PROCESSED -- while a player is open its
    // nominator holds the clock -- so every case here ends in one.
    const tids = [1, 2, 3, 4]
    const settled_log = [
      { type: transaction_types.AUCTION_PROCESSED, tid: 1 },
      { type: transaction_types.AUCTION_BID, tid: 1 }
    ]
    const teams_with_space = (space_by_tid) =>
      tids.map((team_id) => ({
        team_id,
        availableSpace: space_by_tid[team_id]
      }))

    it('hands the clock to the next team when it has roster space', function () {
      // The negative control for the two skips below.
      const nominating_team_id = resolve_nominating_team_id({
        transactions: settled_log,
        tids,
        teams: teams_with_space({ 1: 1, 2: 1, 3: 1, 4: 1 })
      })
      expect(nominating_team_id).to.equal(2)
    })

    it('skips a team with no roster space', function () {
      const nominating_team_id = resolve_nominating_team_id({
        transactions: settled_log,
        tids,
        teams: teams_with_space({ 1: 1, 2: 0, 3: 1, 4: 1 })
      })
      expect(nominating_team_id, 'team 2 is skipped').to.equal(3)
    })

    it('skips a run of full teams and wraps the rotation', function () {
      const nominating_team_id = resolve_nominating_team_id({
        transactions: settled_log,
        tids,
        teams: teams_with_space({ 1: 1, 2: 0, 3: 0, 4: 0 })
      })
      // The walk starts after the last nominator and wraps, so team 1 -- the
      // team that just nominated -- takes the clock again rather than the
      // rotation stalling on team 2.
      expect(nominating_team_id, 'the rotation wraps to team 1').to.equal(1)
    })

    it('returns null when every team is full, which is auction-complete', function () {
      const nominating_team_id = resolve_nominating_team_id({
        transactions: settled_log,
        tids,
        teams: teams_with_space({ 1: 0, 2: 0, 3: 0, 4: 0 })
      })
      expect(nominating_team_id).to.equal(null)
    })

    it('holds the clock with the nominator while a player is open', function () {
      // The other negative control: capacity is not consulted at all on this
      // branch, so a full team still holds the clock on the player it opened.
      const open_log = [
        { type: transaction_types.AUCTION_BID, tid: 2 },
        { type: transaction_types.AUCTION_PROCESSED, tid: 1 }
      ]
      const nominating_team_id = resolve_nominating_team_id({
        transactions: open_log,
        tids,
        teams: teams_with_space({ 1: 1, 2: 0, 3: 1, 4: 1 })
      })
      expect(nominating_team_id, 'the nominator holds its own player').to.equal(
        2
      )
    })
  })
})
