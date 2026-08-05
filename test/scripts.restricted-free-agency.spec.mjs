/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  transaction_types,
  player_tag_types,
  restricted_free_agency_bid_outcomes
} from '#constants'
import { Roster } from '#libs-shared'
import {
  getLeague,
  getRoster,
  processRestrictedFreeAgencyBid
} from '#libs-server'
import {
  selectPlayer,
  checkLastTransaction,
  checkRoster,
  addPlayer,
  fillRoster
} from './utils/index.mjs'
import { insert_restricted_free_agency_bid } from './utils/insert-restricted-free-agency-bid.mjs'
import run from '#scripts/process-restricted-free-agency-bids.mjs'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

describe('SCRIPTS - restricted free agency bids', function () {
  const leagueId = 1

  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)

      // Set up dates relative to season start (which is in the future)
      // Season start is typically in September
      // The restricted free agency period typically occurs during the offseason (June-August)
      const tran_date = regular_season_start.subtract('3', 'month').unix()
      const ext_date = regular_season_start.subtract('4', 'month').unix()

      // 24-hour nomination windows, bids processed 3 hours before the next one
      await knex('seasons')
        .update({
          year: current_season.year,
          restricted_free_agency_period_start: tran_date,
          restricted_free_agency_period_end: regular_season_start
            .subtract('1', 'month')
            .unix(),
          ext_date,
          restricted_free_agency_first_window_at: dayjs
            .unix(tran_date)
            .toDate(),
          restricted_free_agency_window_hours: 24,
          restricted_free_agency_processing_lead_hours: 3
        })
        .where({
          lid: leagueId
        })

      // Set the mock date to be during the RFA period, specifically at noon
      // This will be in July (2 months before season start)
      const mock_date = regular_season_start
        .subtract('2', 'month')
        .hour(12)
        .minute(0)
        .second(0)
      MockDate.set(mock_date.toDate())
    })

    it('process single bid', async () => {
      const player = await selectPlayer()
      const team_id = 1
      const value = 10
      const user_id = 1

      await addPlayer({
        leagueId,
        player,
        teamId: team_id,
        userId: user_id,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      // Get the current mocked timestamp
      const current_time = Math.round(Date.now() / 1000)

      // Set announcement time to be more than 26 hours ago to meet timing requirements
      const announcement_time = current_time - 60 * 60 * 30 // 30 hours ago

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id,
        bid: value,
        tid: team_id,
        lid: leagueId,
        original_team_id: team_id,
        announced_at: announcement_time,
        nominated_at: announcement_time - 60 * 60 // 1 hour before announcement
      })

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check restricted free agency bid
      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      )
      expect(restricted_free_agency_bids.length).to.equal(1)
      expect(restricted_free_agency_bids[0].is_successful).to.equal(true)
      expect(restricted_free_agency_bids[0].processed).to.not.equal(null)
      expect(restricted_free_agency_bids[0].outcome).to.equal(
        restricted_free_agency_bid_outcomes.WON
      )

      // verify roster
      await checkRoster({
        teamId: team_id,
        pid: player.pid,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        pid: player.pid,
        teamId: team_id,
        userId: 1,
        value,
        type: transaction_types.RESTRICTED_FREE_AGENCY_TAG
      })
    })

    it('marks the winning bid successful alongside the tag transaction', async () => {
      // calculate-team-daily-ktc-value reads `transactions` and then
      // restricted_free_agency_bids, and treats a RESTRICTED_FREE_AGENCY_TAG
      // with no matching successful bid as impossible. While the bid was marked
      // by the CALLER, there was a window in which exactly that state was
      // visible to a concurrent reader — and the RFA processing deadline lands
      // on the same 04:00 ET minute as the valuation job's cron, so the two
      // collided and the job threw on HOU__2026-08-02 with both rows present
      // and correct by the time anyone looked. This asserts the helper itself
      // leaves both rows written, which is what lets them share one commit.
      const player = await selectPlayer()
      const team_id = 1
      const value = 10
      const user_id = 1

      await addPlayer({
        leagueId,
        player,
        teamId: team_id,
        userId: user_id,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      const processed = Math.round(Date.now() / 1000)
      const bid_uid = await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id,
        bid: value,
        tid: team_id,
        lid: leagueId,
        original_team_id: team_id,
        announced_at: processed
      })
      const bid_row = await knex('restricted_free_agency_bids')
        .where('uid', bid_uid)
        .first()

      await processRestrictedFreeAgencyBid({
        ...bid_row,
        original_team_id: team_id,
        processed
      })

      const bid_after = await knex('restricted_free_agency_bids')
        .where('uid', bid_row.uid)
        .first()
      expect(bid_after.is_successful).to.equal(true)
      expect(bid_after.processed).to.equal(processed)
      expect(bid_after.outcome).to.equal(
        restricted_free_agency_bid_outcomes.WON
      )

      const tag_transactions = await knex('transactions').where({
        lid: leagueId,
        pid: player.pid,
        type: transaction_types.RESTRICTED_FREE_AGENCY_TAG
      })
      expect(tag_transactions.length).to.equal(1)
    })

    it('process single bid with cutlist and conditional release', async () => {
      const exclude_pids = []
      const player1 = await selectPlayer() // 30 - rfa
      exclude_pids.push(player1.pid)
      const player2 = await selectPlayer({ exclude_pids }) // 20 - cutlist
      exclude_pids.push(player2.pid)
      const player3 = await selectPlayer({ exclude_pids }) // 20 - cutlist
      exclude_pids.push(player3.pid)
      const player4 = await selectPlayer({ exclude_pids }) // 20 - release
      exclude_pids.push(player4.pid)
      const player5 = await selectPlayer({ exclude_pids }) // 160 - high salary retained
      exclude_pids.push(player5.pid)

      const team_id = 1
      const user_id = 1
      const bid = 30

      await addPlayer({
        leagueId,
        player: player1,
        teamId: team_id,
        userId: user_id,
        value: 20,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      const players = [player2, player3, player4]
      for (const player of players) {
        await addPlayer({
          leagueId,
          player,
          teamId: team_id,
          userId: user_id,
          value: 20
        })
      }

      await addPlayer({
        leagueId,
        player: player5,
        teamId: team_id,
        userId: user_id,
        value: 160
      })

      await fillRoster({
        leagueId,
        teamId: team_id,
        exclude_reserve_short_term: true,
        exclude_pids
      })

      // Get the current mocked timestamp
      const current_time = Math.round(Date.now() / 1000)

      // Set announcement time to be more than 26 hours ago to meet timing requirements
      const announcement_time = current_time - 60 * 60 * 30 // 30 hours ago

      const bid_uid = await insert_restricted_free_agency_bid({
        pid: player1.pid,
        userid: user_id,
        bid,
        tid: team_id,
        lid: leagueId,
        original_team_id: team_id,
        announced_at: announcement_time,
        nominated_at: announcement_time - 60 * 60 // 1 hour before announcement
      })

      await knex('restricted_free_agency_releases').insert({
        restricted_free_agency_bid_id: bid_uid,
        pid: player4.pid
      })

      const cutlist = [player2, player3].map((p, idx) => ({
        pid: p.pid,
        sort_order: idx,
        tid: team_id
      }))
      await knex('league_cutlist').insert(cutlist)

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check restricted free agency bid
      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      )
      expect(restricted_free_agency_bids.length).to.equal(1)
      expect(restricted_free_agency_bids[0].is_successful).to.equal(true)
      expect(restricted_free_agency_bids[0].processed).to.not.equal(null)
      expect(restricted_free_agency_bids[0].outcome).to.equal(
        restricted_free_agency_bid_outcomes.WON
      )

      // verify roster
      await checkRoster({
        teamId: team_id,
        pid: player1.pid,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        pid: player1.pid,
        teamId: team_id,
        userId: 1,
        value: bid,
        type: transaction_types.RESTRICTED_FREE_AGENCY_TAG
      })

      // verify released players
      const league = await getLeague({ lid: leagueId })
      const rosterRow = await getRoster({ tid: team_id })
      const roster = new Roster({ roster: rosterRow, league })

      expect(roster.has(player2.pid)).to.equal(false)
      expect(roster.has(player3.pid)).to.equal(false)
      expect(roster.has(player4.pid)).to.equal(false)

      // verify cutlist
      const transactions = await knex('transactions').where({ lid: leagueId })
      const release_transactions = transactions.filter(
        (t) => t.type === transaction_types.ROSTER_RELEASE
      )
      expect(release_transactions.length).to.equal(3)
    })

    it('process multiple bids', async () => {
      // TODO
    })

    it('process tied bids among original team', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)

      // Set up dates relative to season start
      const tran_date = regular_season_start.subtract('3', 'month').unix()

      // Set the mock date to be during the RFA period, specifically at noon
      const mock_date = regular_season_start
        .subtract('2', 'month')
        .hour(12)
        .minute(0)
        .second(0)
      MockDate.set(mock_date.toDate())

      await league(knex)

      // 24-hour nomination windows, bids processed 3 hours before the next one
      await knex('seasons')
        .update({
          year: current_season.year,
          restricted_free_agency_period_start: tran_date,
          restricted_free_agency_period_end: regular_season_start
            .subtract('1', 'month')
            .unix(),
          restricted_free_agency_first_window_at: dayjs
            .unix(tran_date)
            .toDate(),
          restricted_free_agency_window_hours: 24,
          restricted_free_agency_processing_lead_hours: 3
        })
        .where({
          lid: leagueId
        })
    })

    it('no bids to process', async () => {
      const player = await selectPlayer()
      const team_id = 1
      const value = 10
      const user_id = 1

      await addPlayer({
        leagueId,
        player,
        teamId: team_id,
        userId: user_id,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id,
        bid: value,
        tid: team_id,
        lid: leagueId,
        original_team_id: team_id
        // No announcement on the nomination, so it shouldn't be processed
      })

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check restricted free agency bid
      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      )
      expect(restricted_free_agency_bids.length).to.equal(1)
      expect(restricted_free_agency_bids[0].is_successful).to.equal(null)
      expect(restricted_free_agency_bids[0].processed).to.equal(null)
      expect(restricted_free_agency_bids[0].outcome).to.equal(null)
    })

    it('bid not processed if not enough time elapsed', async () => {
      const player = await selectPlayer()
      const team_id = 1
      const value = 10
      const user_id = 1

      await addPlayer({
        leagueId,
        player,
        teamId: team_id,
        userId: user_id,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      const timestamp = Math.round(Date.now() / 1000)
      // Set announcement time to just 30 minutes ago (not enough time elapsed)
      const announcement_time = timestamp - 60 * 30

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id,
        bid: value,
        tid: team_id,
        lid: leagueId,
        original_team_id: team_id,
        announced_at: announcement_time,
        nominated_at: announcement_time - 60 * 60
      })

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check restricted free agency bid - should still be unprocessed
      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      )
      expect(restricted_free_agency_bids.length).to.equal(1)
      expect(restricted_free_agency_bids[0].is_successful).to.equal(null)
      expect(restricted_free_agency_bids[0].processed).to.equal(null)
      expect(restricted_free_agency_bids[0].outcome).to.equal(null)
    })

    it('competing bid not processed before the nomination window is due', async () => {
      const player = await selectPlayer()
      const original_team_id = 1
      const competing_team_id = 2
      const original_user_id = 1
      const competing_user_id = 2

      await addPlayer({
        leagueId,
        player,
        teamId: original_team_id,
        userId: original_user_id,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      const timestamp = Math.round(Date.now() / 1000)
      // announced 30 minutes ago, so the window's processing time is hours away
      const announcement_time = timestamp - 60 * 30

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: original_user_id,
        bid: 10,
        tid: original_team_id,
        lid: leagueId,
        original_team_id,
        announced_at: announcement_time,
        nominated_at: announcement_time - 60 * 60
      })

      // A competing bid shares the player's nomination and has no announcement
      // of its own to carry. It must still be gated on that window rather than
      // treated as due the moment it is submitted.
      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: competing_user_id,
        bid: 25,
        tid: competing_team_id,
        lid: leagueId,
        original_team_id
      })

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      ).orderBy('tid')

      expect(restricted_free_agency_bids.length).to.equal(2)

      for (const bid_row of restricted_free_agency_bids) {
        expect(bid_row.is_successful).to.equal(null)
        expect(bid_row.processed).to.equal(null)
        expect(bid_row.outcome).to.equal(null)
      }

      // the player is still on the original team's roster
      await checkRoster({
        teamId: original_team_id,
        pid: player.pid,
        leagueId
      })
    })

    it('exceeds roster size limit', async () => {
      // TODO
    })

    it('exceeds roster cap limit', async () => {
      // TODO
    })

    it('tied bids among competing team', async () => {
      const player = await selectPlayer()
      const team_id1 = 1
      const team_id2 = 2
      const team_id3 = 3
      const value1 = 10
      const value2 = 13
      const user_id1 = 1
      const user_id2 = 2
      const user_id3 = 3

      await addPlayer({
        leagueId,
        player,
        teamId: team_id1,
        userId: user_id1,
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })

      // Set waiver order for teams
      await knex('teams').where({ uid: team_id2 }).update({ waiver_order: 1 })
      await knex('teams').where({ uid: team_id3 }).update({ waiver_order: 2 })

      // Get the current mocked timestamp
      const current_time = Math.round(Date.now() / 1000)

      // Set announcement time to be more than 26 hours ago to meet timing requirements
      const announcement_time = current_time - 60 * 60 * 30 // 30 hours ago

      // Original team bid
      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id1,
        bid: value1,
        tid: team_id1,
        lid: leagueId,
        original_team_id: team_id1,
        announced_at: announcement_time,
        nominated_at: announcement_time - 60 * 60
      })

      // Competing team bids with the same value. They share the player's
      // nomination rather than carrying an announcement of their own, so they
      // exercise the resolution of the processing window through the player.
      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id2,
        bid: value2,
        tid: team_id2,
        lid: leagueId,
        original_team_id: team_id1
      })

      await insert_restricted_free_agency_bid({
        pid: player.pid,
        userid: user_id3,
        bid: value2,
        tid: team_id3,
        lid: leagueId,
        original_team_id: team_id1
      })

      let error
      try {
        await run({ dry_run: false })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check restricted free agency bids
      const restricted_free_agency_bids = await knex(
        'restricted_free_agency_bids'
      ).orderBy('tid')

      // Team 2 should win due to better waiver order
      expect(restricted_free_agency_bids.length).to.equal(3)

      // Team 1 (original team) bid should be unsuccessful
      expect(restricted_free_agency_bids[0].tid).to.equal(team_id1)
      expect(restricted_free_agency_bids[0].is_successful).to.equal(false)
      expect(restricted_free_agency_bids[0].processed).to.not.equal(null)

      // Team 2 bid should be successful
      expect(restricted_free_agency_bids[1].tid).to.equal(team_id2)
      expect(restricted_free_agency_bids[1].is_successful).to.equal(true)
      expect(restricted_free_agency_bids[1].processed).to.not.equal(null)

      // Team 3 bid should be unsuccessful
      expect(restricted_free_agency_bids[2].tid).to.equal(team_id3)
      expect(restricted_free_agency_bids[2].is_successful).to.equal(false)
      expect(restricted_free_agency_bids[2].processed).to.not.equal(null)

      // The losses are told apart, which the retired `reason` column could not
      // do: team 3 matched the winning amount and lost the waiver-order
      // tiebreak, while team 1 was simply outbid. Both used to read
      // 'player no longer a restricted free agent'.
      expect(restricted_free_agency_bids[2].outcome).to.equal(
        restricted_free_agency_bid_outcomes.LOST_TIEBREAK
      )
      expect(restricted_free_agency_bids[0].outcome).to.equal(
        restricted_free_agency_bid_outcomes.OUTBID
      )
      expect(restricted_free_agency_bids[1].outcome).to.equal(
        restricted_free_agency_bid_outcomes.WON
      )

      // Check that player is now on team 2
      await checkRoster({
        teamId: team_id2,
        pid: player.pid,
        leagueId
      })

      // Verify waiver order was reset for the winning team (team_id2)
      const final_waiver_orders = await knex('teams')
        .select('uid', 'waiver_order')
        .where({ lid: leagueId, year: current_season.year })
        .orderBy('waiver_order', 'asc')

      // The winning team (team_id2) should have the highest (worst) waiver order number
      // Find the team with the highest waiver_order value
      const max_waiver_order_team = final_waiver_orders.reduce(
        (max, team) => (team.waiver_order > max.waiver_order ? team : max),
        final_waiver_orders[0]
      )

      // Check that the winning team now has the worst waiver position
      expect(max_waiver_order_team.uid).to.equal(team_id2)

      // Check that all teams have a unique waiver order
      const waiver_orders = final_waiver_orders.map((t) => t.waiver_order)
      const unique_waiver_orders = [...new Set(waiver_orders)]
      expect(unique_waiver_orders.length).to.equal(waiver_orders.length)
    })
  })
})
