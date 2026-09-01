/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  waiver_types
} from '#constants'
import { selectPlayer } from './utils/index.mjs'

// Import the scripts to test
import process_waivers_free_agency_practice from '#scripts/process-waivers-free-agency-practice.mjs'
import process_waivers_free_agency_active from '#scripts/process-waivers-free-agency-active.mjs'
import process_super_priority from '#libs-server/process-super-priority.mjs'
import populate_super_priority_table from '#scripts/populate-super-priority-table.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { regular_season_start } = current_season

describe('SCRIPTS - Super Priority Processing', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await league(knex)
    // Clear super_priority table to avoid unique constraint violations
    await knex('super_priority').del()
  })

  describe('process-waivers-free-agency-practice with super priority', function () {
    let player, poach_timestamp

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago

      // Setup valid poach scenario
      await knex('transactions').insert([
        {
          pid: player.pid,
          tid: 1, // Original team
          lid: 1,
          type: transaction_types.PRACTICE_ADD,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp - 24 * 60 * 60),
          week: current_season.week - 1,
          user_id: 1
        },
        {
          pid: player.pid,
          tid: 2, // Poaching team
          lid: 1,
          type: transaction_types.POACHED,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp),
          week: current_season.week - 1,
          user_id: 2
        }
      ])

      // Add super_priority record
      await knex('super_priority').insert({
        pid: player.pid,
        original_tid: 1,
        poaching_tid: 2,
        lid: 1,
        poach_timestamp: epoch_to_timestamptz(poach_timestamp),
        eligible: 1,
        claimed: 0
      })

      // Set date to free agency period
      MockDate.set(regular_season_start.add('2', 'months').toISOString())

      // Release player from poaching team to make available for waivers
      // Must be more than 24 hours ago to be eligible for processing
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2, // Released from poaching team
        lid: 1,
        type: transaction_types.ROSTER_RELEASE,
        player_salary: 0,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(
          Math.round(Date.now() / 1000) - 25 * 60 * 60
        ), // 25 hours ago
        week: current_season.week,
        user_id: 2
      })
    })

    it('should prioritize super priority claims over regular waivers', async () => {
      const now = Math.round(Date.now() / 1000)

      // Create regular waiver by team with better waiver order
      await knex('waivers').insert({
        tid: 3, // Team 3 has better waiver order than team 1
        user_id: 3,
        lid: 1,
        pid: player.pid,
        priority_order: 1,
        submitted: epoch_to_timestamptz(now - 3600), // 1 hour ago
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE
      })

      // Create super priority waiver by original team
      await knex('waivers').insert({
        tid: 1, // Original team
        user_id: 1,
        lid: 1,
        pid: player.pid,
        priority_order: 9999,
        submitted: epoch_to_timestamptz(now - 1800), // 30 minutes ago (later than regular waiver)
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority waiver was processed successfully
      const super_priority_waiver = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(super_priority_waiver.is_successful).to.equal(true)
      expect(super_priority_waiver.processed).to.be.greaterThan(new Date(0))

      // Check that regular waiver was processed but unsuccessful
      const regular_waiver = await knex('waivers')
        .where({ tid: 3, pid: player.pid })
        .first()

      expect(regular_waiver.processed).to.be.greaterThan(new Date(0))
      expect(regular_waiver.is_successful).to.equal(false)
      expect(regular_waiver.reason).to.include('already claimed')

      // Verify player is on team 1 roster
      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.not.equal(undefined)
      expect(roster_entry.slot).to.equal(roster_slot_types.PS)

      // Verify super priority claim was marked as claimed
      const super_priority_record = await knex('super_priority')
        .where({ pid: player.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .first()

      expect(super_priority_record.claimed).to.equal(1)
      expect(super_priority_record.claimed_at).to.be.instanceof(Date)
    })

    it('should process regular waivers when no super priority claims exist', async () => {
      const now = Math.round(Date.now() / 1000)

      // Remove super_priority record to test regular waiver processing
      await knex('super_priority').where({ pid: player.pid }).del()

      // Create regular waiver
      await knex('waivers').insert({
        tid: 3,
        user_id: 3,
        lid: 1,
        pid: player.pid,
        priority_order: 1,
        submitted: epoch_to_timestamptz(now - 3600),
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE
      })

      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that regular waiver was processed
      const waiver = await knex('waivers')
        .where({ tid: 3, pid: player.pid })
        .first()

      expect(waiver.is_successful).to.equal(true)
      expect(waiver.processed).to.be.greaterThan(new Date(0))
    })

    it('should validate super priority eligibility during processing', async () => {
      const now = Math.round(Date.now() / 1000)

      // Mark super_priority record as already claimed
      await knex('super_priority')
        .where({ pid: player.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .update({ claimed: 1, claimed_at: epoch_to_timestamptz(now - 3600) })

      // Create super priority waiver (should fail validation)
      await knex('waivers').insert({
        tid: 1,
        user_id: 1,
        lid: 1,
        pid: player.pid,
        priority_order: 9999,
        submitted: epoch_to_timestamptz(now - 1800),
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority waiver failed
      const waiver = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(waiver.is_successful).to.equal(false)
      expect(waiver.reason).to.include('super priority not available')
    })

    it('should prioritize active roster waiver over super priority practice squad waiver', async () => {
      // Set up proper timing - we're in free agency period (before season regular_season_start)
      const free_agency_auction_regular_season_start =
        regular_season_start.subtract('2', 'months')
      const current_time = regular_season_start.subtract('1', 'month') // After auction regular_season_start, before season
      MockDate.set(current_time.toISOString())

      // Set up league for free agency period to allow active roster waiver processing
      await knex('seasons')
        .where({ lid: 1, season_year: current_season.year })
        .update({
          free_agency_period_start:
            free_agency_auction_regular_season_start.toDate(),
          // Draft completed before FA. The hard end has to move with the
          // start: it is a stated column now rather than a projection off the
          // cadence, so relocating the draft without it leaves the rookie
          // waiver period open and no practice-squad waiver processes.
          draft_start: free_agency_auction_regular_season_start
            .subtract('1', 'week')
            .toDate(),
          rookie_draft_end_at: free_agency_auction_regular_season_start
            .subtract('2', 'days')
            .toDate()
        })

      // Update timestamps to be relative to current mock time
      const current_timestamp = Math.round(Date.now() / 1000)
      const poach_time = current_timestamp - 7 * 24 * 60 * 60 // 1 week ago
      const release_time = current_timestamp - 25 * 60 * 60 // 25 hours ago

      // Update existing transactions with proper timestamps
      await knex('transactions')
        .where({ pid: player.pid, type: transaction_types.PRACTICE_ADD })
        .update({
          occurred_at: epoch_to_timestamptz(poach_time - 24 * 60 * 60)
        })

      await knex('transactions')
        .where({ pid: player.pid, type: transaction_types.POACHED })
        .update({ occurred_at: epoch_to_timestamptz(poach_time) })

      await knex('transactions')
        .where({ pid: player.pid, type: transaction_types.ROSTER_RELEASE })
        .update({ occurred_at: epoch_to_timestamptz(release_time) })

      await knex('super_priority')
        .where({ pid: player.pid })
        .update({ poach_timestamp: epoch_to_timestamptz(poach_time) })

      // Create active roster waiver by team with worse waiver order
      await knex('waivers').insert({
        tid: 4, // Team 4 has worse waiver order than team 1
        user_id: 4,
        lid: 1,
        pid: player.pid,
        priority_order: 10,
        submitted: epoch_to_timestamptz(current_timestamp - 3600), // 1 hour ago
        bid_amount: 50,
        type: waiver_types.FREE_AGENCY // Active roster waiver
      })

      // Create super priority practice squad waiver by original team (submitted later)
      await knex('waivers').insert({
        tid: 1, // Original team
        user_id: 1,
        lid: 1,
        pid: player.pid,
        priority_order: 9999,
        submitted: epoch_to_timestamptz(current_timestamp - 1800), // 30 minutes ago (later than active roster waiver)
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      // First, run practice squad waiver processing
      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority practice squad waiver was NOT processed (due to active roster waiver existing)
      const super_priority_waiver_after_practice = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(super_priority_waiver_after_practice.processed).to.be.null
      expect(super_priority_waiver_after_practice.is_successful).to.be.null

      // The active roster waiver should still be unprocessed (since we only ran practice squad processing)
      const active_roster_waiver_after_practice = await knex('waivers')
        .where({ tid: 4, pid: player.pid, type: waiver_types.FREE_AGENCY })
        .first()

      expect(active_roster_waiver_after_practice.processed).to.be.null

      // Now run active roster waiver processing
      try {
        await process_waivers_free_agency_active({ daily: true })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that active roster waiver was processed successfully
      const active_roster_waiver_final = await knex('waivers')
        .where({ tid: 4, pid: player.pid, type: waiver_types.FREE_AGENCY })
        .first()

      expect(active_roster_waiver_final.processed).to.be.greaterThan(
        new Date(0)
      )
      expect(active_roster_waiver_final.is_successful).to.equal(true)

      // Verify player is on team 4 active roster (bench slot)
      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 4,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.not.equal(undefined)
      expect(roster_entry.slot).to.equal(roster_slot_types.BENCH) // Should be on bench (active roster)

      // Now run practice squad processing again to see if super priority waiver gets processed
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority waiver was processed but failed (player already rostered)
      const super_priority_waiver_final = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(super_priority_waiver_final.processed).to.be.greaterThan(
        new Date(0)
      )
      expect(super_priority_waiver_final.is_successful).to.equal(false)
      expect(super_priority_waiver_final.reason).to.include('already claimed')

      // Verify super priority was NOT claimed (since player went to active roster instead)
      const super_priority_record = await knex('super_priority')
        .where({ pid: player.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .first()

      expect(super_priority_record.claimed).to.equal(0)
      expect(super_priority_record.claimed_at).to.be.null

      // Verify that NO super priority transaction was created
      const super_priority_transaction = await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.SUPER_PRIORITY
        })
        .first()
      expect(super_priority_transaction).to.equal(undefined)
    })

    it('should process super priority waiver when no active roster waiver exists', async () => {
      const now = Math.round(Date.now() / 1000)

      // Create ONLY super priority practice squad waiver (no active roster waiver)
      await knex('waivers').insert({
        tid: 1, // Original team
        user_id: 1,
        lid: 1,
        pid: player.pid,
        priority_order: 9999,
        submitted: epoch_to_timestamptz(now - 1800),
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority waiver was processed successfully
      const super_priority_waiver = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(super_priority_waiver.processed).to.be.greaterThan(new Date(0))
      expect(super_priority_waiver.is_successful).to.equal(true)

      // Verify super priority transaction was created
      const super_priority_transaction = await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.SUPER_PRIORITY
        })
        .first()
      expect(super_priority_transaction).to.not.equal(undefined)

      // Verify super priority was claimed
      const super_priority_record = await knex('super_priority')
        .where({ pid: player.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .first()

      expect(super_priority_record.claimed).to.equal(1)
      expect(super_priority_record.claimed_at).to.be.instanceof(Date)
    })

    it('should handle super priority waiver eligibility check when player was traded instead of waiver claimed', async () => {
      const now = Math.round(Date.now() / 1000)

      // Simulate player being traded to another team (making them ineligible for super priority)
      await knex('transactions').insert({
        user_id: 2,
        tid: 2, // Poaching team
        lid: 1,
        pid: player.pid,
        type: transaction_types.TRADE,
        player_salary: 0,
        week: current_season.week,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(now - 3600) // Trade happened after the poach
      })

      // Create super priority practice squad waiver by original team
      await knex('waivers').insert({
        tid: 1, // Original team
        user_id: 1,
        lid: 1,
        pid: player.pid,
        priority_order: 9999,
        submitted: epoch_to_timestamptz(now - 1800),
        bid_amount: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      let error
      try {
        await process_waivers_free_agency_practice()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that super priority waiver was processed but failed due to ineligibility
      const super_priority_waiver = await knex('waivers')
        .where({ tid: 1, pid: player.pid, super_priority: 1 })
        .first()

      expect(super_priority_waiver.processed).to.be.greaterThan(new Date(0))
      expect(super_priority_waiver.is_successful).to.equal(false)
      expect(super_priority_waiver.reason).to.include(
        'super priority not available'
      )

      // Verify super priority was NOT claimed
      const super_priority_record = await knex('super_priority')
        .where({ pid: player.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .first()

      expect(super_priority_record.claimed).to.equal(0)
      expect(super_priority_record.claimed_at).to.be.null
    })
  })

  describe('process_super_priority function', function () {
    let player, poach_timestamp, super_priority_record

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60

      // Setup valid poach scenario
      await knex('transactions').insert([
        {
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.PRACTICE_ADD,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp - 24 * 60 * 60),
          week: current_season.week - 1,
          user_id: 1
        },
        {
          pid: player.pid,
          tid: 2,
          lid: 1,
          type: transaction_types.POACHED,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp),
          week: current_season.week - 1,
          user_id: 2
        }
      ])

      // Create super_priority record
      const [record] = await knex('super_priority')
        .insert({
          pid: player.pid,
          original_tid: 1,
          poaching_tid: 2,
          lid: 1,
          poach_timestamp: epoch_to_timestamptz(poach_timestamp),
          eligible: 1,
          claimed: 0
        })
        .returning('super_priority_id')

      super_priority_record = record
    })

    it('should process manual super priority claim', async () => {
      let error
      try {
        await process_super_priority({
          pid: player.pid,
          original_tid: 1,
          lid: 1,
          super_priority_id: super_priority_record.super_priority_id,
          user_id: 1
        })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Verify super priority transaction was created
      const transaction = await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.SUPER_PRIORITY
        })
        .orderBy('occurred_at', 'desc')
        .first()

      expect(transaction).to.not.equal(undefined)
      expect(transaction.user_id).to.equal(1)

      // Verify player is on roster with protection period
      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.not.equal(undefined)
      // Verify super priority claim via transaction table
      const super_priority_transaction = await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.SUPER_PRIORITY
        })
        .first()
      expect(super_priority_transaction).to.not.be.null

      // Verify super priority record marked as claimed
      const updated_record = await knex('super_priority')
        .where({ super_priority_id: super_priority_record.super_priority_id })
        .first()

      expect(updated_record.claimed).to.equal(1)
      expect(updated_record.claimed_at).to.be.instanceof(Date)
    })

    it('should return a drafted player to the drafted practice squad slot', async () => {
      // The shared fixture adds the player to team 1 with PRACTICE_ADD, which
      // is a SIGNING. Amendment XXXIV section 16 restores the designation the
      // player actually held, so a drafted return has to be seeded as a DRAFT
      // -- this test previously observed PSD off a PRACTICE_ADD fixture, which
      // only passed because the slot was derived from the since-dropped
      // requires_waiver column instead of from the player's history.
      await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.PRACTICE_ADD
        })
        .update({ type: transaction_types.DRAFT })

      let error
      try {
        await process_super_priority({
          pid: player.pid,
          original_tid: 1,
          lid: 1,
          super_priority_id: super_priority_record.super_priority_id
        })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Verify auto-revert transaction was created
      const transaction = await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.SUPER_PRIORITY
        })
        .first()

      expect(transaction).to.not.equal(undefined)
      expect(transaction.user_id).to.equal(0) // Auto-revert uses system user

      // Verify player is on roster in PS drafted slot
      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.not.equal(undefined)
      expect(roster_entry.slot).to.equal(roster_slot_types.PSD)
    })

    it('should return a signed player to the signed slot on an automatic claim', async () => {
      // The automatic path: the original team has practice-squad space, which
      // the claim checks for itself. The player was added with PRACTICE_ADD, so
      // the constitution
      // returns them SIGNED -- the designation must not follow the claim route.
      // Returning them as PSD would move a capped player into the uncapped
      // bucket, which is the only way this flow could overfill a practice squad.
      let error
      try {
        await process_super_priority({
          pid: player.pid,
          original_tid: 1,
          lid: 1,
          super_priority_id: super_priority_record.super_priority_id
        })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.not.equal(undefined)
      expect(roster_entry.slot).to.equal(roster_slot_types.PS)
    })

    // The slot and the salary both come off the original team's last practice
    // squad add, so a player with no such add cannot be restored at all. What
    // this pins is not the refusal but WHEN it happens: the salary used to be
    // read in a second walk BELOW the roster insert, so this case wrote the
    // roster row, then threw -- leaving the roster changed, no transaction
    // recorded, and the claim still unclaimed, with no db transaction to unwind
    // it. process_super_priority still holds no transaction, so the ordering is
    // the only thing keeping the failure clean, and only the roster assertion
    // below can tell the two orderings apart. The throw alone cannot: it
    // happens either way.
    it('refuses a claim with no practice squad add without writing a roster row', async () => {
      // Remove the shared fixture's PRACTICE_ADD so the original team's log
      // carries no add of any of the three restoring types. A TRADE is a real
      // way onto a roster that is NOT a practice squad add, so this is the
      // shape the gap actually takes rather than an empty log.
      await knex('transactions')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.PRACTICE_ADD
        })
        .update({ type: transaction_types.TRADE })

      let error
      try {
        await process_super_priority({
          pid: player.pid,
          original_tid: 1,
          lid: 1,
          super_priority_id: super_priority_record.super_priority_id
        })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(undefined)
      expect(error.message).to.match(/no practice squad add/i)

      const roster_entry = await knex('rosters_players')
        .where({
          pid: player.pid,
          tid: 1,
          lid: 1,
          week: current_season.week,
          season_year: current_season.year
        })
        .first()

      expect(roster_entry).to.equal(undefined)

      const updated_record = await knex('super_priority')
        .where({ super_priority_id: super_priority_record.super_priority_id })
        .first()

      expect(updated_record.claimed).to.equal(0)
    })
  })

  describe('populate_super_priority_table script', function () {
    let player1, player2, poach_timestamp

    beforeEach(async () => {
      player1 = await selectPlayer({ rookie: false })
      player2 = await selectPlayer({
        rookie: false,
        exclude_pids: [player1.pid]
      })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60

      // Setup multiple poach scenarios
      await knex('transactions').insert([
        // Player 1: eligible poach
        {
          pid: player1.pid,
          tid: 1,
          lid: 1,
          type: transaction_types.PRACTICE_ADD,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp - 24 * 60 * 60),
          week: current_season.week - 1,
          user_id: 1
        },
        {
          pid: player1.pid,
          tid: 2,
          lid: 1,
          type: transaction_types.POACHED,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp),
          week: current_season.week - 1,
          user_id: 2
        },
        // Player 2: ineligible poach (traded)
        {
          pid: player2.pid,
          tid: 3,
          lid: 1,
          type: transaction_types.PRACTICE_ADD,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp - 24 * 60 * 60),
          week: current_season.week - 1,
          user_id: 3
        },
        {
          pid: player2.pid,
          tid: 4,
          lid: 1,
          type: transaction_types.POACHED,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp),
          week: current_season.week - 1,
          user_id: 4
        },
        {
          pid: player2.pid,
          tid: 4,
          lid: 1,
          type: transaction_types.TRADE,
          player_salary: 0,
          season_year: current_season.year,
          occurred_at: epoch_to_timestamptz(poach_timestamp + 12 * 60 * 60), // 12 hours after poach
          week: current_season.week - 1,
          user_id: 4
        }
      ])
    })

    it('should populate eligible players correctly', async () => {
      let error
      try {
        await populate_super_priority_table({
          year: current_season.year,
          lid: 1
        })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that eligible player was added
      const eligible_record = await knex('super_priority')
        .where({ pid: player1.pid, original_tid: 1, poaching_tid: 2, lid: 1 })
        .first()

      expect(eligible_record).to.not.equal(undefined)
      expect(eligible_record.eligible).to.equal(1)
      expect(eligible_record.claimed).to.equal(0)

      // Check that ineligible player was not added or marked ineligible
      const ineligible_record = await knex('super_priority')
        .where({ pid: player2.pid, lid: 1 })
        .first()

      // Should either not exist or be marked ineligible
      if (ineligible_record) {
        expect(ineligible_record.eligible).to.equal(0)
      }
    })

    it('should handle dry run mode', async () => {
      let error
      try {
        await populate_super_priority_table({
          year: current_season.year,
          lid: 1,
          dry_run: true
        })
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Check that no records were actually inserted
      const records = await knex('super_priority').where({ lid: 1 })
      expect(records.length).to.equal(0)
    })
  })
})
