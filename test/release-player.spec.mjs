/* global describe before it beforeEach */
import * as chai from 'chai'
import MockDate from 'mockdate'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { getRoster } from '#libs-server'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const script_path = path.join(__dirname, '../scripts/release-player.mjs')
const { regular_season_start } = constants.season

describe('CLI release-player script', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
    await league(knex)
  })

  const run_script = (args) => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [script_path, ...args], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })

      child.on('error', (error) => {
        reject(error)
      })
    })
  }

  describe('argument validation', function () {
    it('should require league-id', async () => {
      const result = await run_script(['--team-id', '1', '--player-id', 'test'])
      result.code.should.equal(1)
      result.stderr.should.include('Missing required argument: league-id')
    })

    it('should require team-id', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--player-id',
        'test'
      ])
      result.code.should.equal(1)
      result.stderr.should.include('Missing required argument: team-id')
    })

    it('should require either player-id or player-name', async () => {
      const result = await run_script(['--league-id', '1', '--team-id', '1'])
      result.code.should.equal(1)
      result.stderr.should.include(
        'Must specify either --player-id or --player-name'
      )
    })

    it('should not allow both player-id and player-name', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        'test1',
        '--player-name',
        'Test Player'
      ])
      result.code.should.equal(1)
      result.stderr.should.include(
        'Cannot specify both --player-id and --player-name'
      )
    })

    it('should not allow both activate-player-id and activate-player-name', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        'test1',
        '--activate-player-id',
        'test2',
        '--activate-player-name',
        'Test Player 2'
      ])
      result.code.should.equal(1)
      result.stderr.should.include(
        'Cannot specify both --activate-player-id and --activate-player-name'
      )
    })
  })

  describe('dry run functionality', function () {
    it('should show dry run information without making changes', async () => {
      // Add a player to roster for testing
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId: 1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.BENCH
      })

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        player.pid,
        '--dry-run'
      ])

      result.code.should.equal(0)
      result.stdout.should.include('DRY RUN - No changes will be made')
      result.stdout.should.include('League:')
      result.stdout.should.include('Team:')
      result.stdout.should.include('Release:')
      result.stdout.should.include('Use without --dry-run to execute')
    })
  })

  describe('player resolution', function () {
    it('should resolve player by ID', async () => {
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId: 1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.BENCH
      })

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        player.pid,
        '--dry-run'
      ])

      result.code.should.equal(0)
      result.stdout.should.include(player.pid)
    })

    it('should resolve player by name with exact match', async () => {
      // Get a player from the database
      const roster = await getRoster({ tid: 1 })
      const player_on_roster = roster.players.find((p) => p.pos !== 'DEF')

      if (!player_on_roster) {
        throw new Error('No suitable player found for testing')
      }

      // Get full player details
      const player_details = await knex('player')
        .where({ pid: player_on_roster.pid })
        .first()

      const full_name = `${player_details.fname} ${player_details.lname}`

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-name',
        full_name,
        '--dry-run'
      ])

      result.code.should.equal(0)
      result.stdout.should.include(player_details.fname)
      result.stdout.should.include(player_details.lname)
    })

    it('should handle fuzzy name matching', async () => {
      const roster = await getRoster({ tid: 1 })
      const player_on_roster = roster.players.find((p) => p.pos !== 'DEF')

      if (!player_on_roster) {
        throw new Error('No suitable player found for testing')
      }

      const player_details = await knex('player')
        .where({ pid: player_on_roster.pid })
        .first()

      // Use just first name for fuzzy matching
      const partial_name = player_details.fname

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-name',
        partial_name,
        '--dry-run'
      ])

      result.code.should.equal(0)
      result.stdout.should.include(player_details.fname)
    })

    it('should fail with invalid player ID', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        'invalid_id',
        '--dry-run'
      ])

      result.code.should.equal(1)
      result.stderr.should.include('Player not found with ID')
    })

    it('should fail with player not on roster', async () => {
      // Get a player that's not on team 1's roster
      const player_not_on_roster = await selectPlayer()

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        player_not_on_roster.pid,
        '--dry-run'
      ])

      result.code.should.equal(1)
      result.stderr.should.include('player not on roster')
    })

    it('should provide helpful error for unmatched player name', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-name',
        'Nonexistent Player',
        '--dry-run'
      ])

      result.code.should.equal(1)
      result.stderr.should.include('No matching players found')
      result.stderr.should.include('Available players:')
    })
  })

  describe('validation errors', function () {
    it('should fail with invalid league ID', async () => {
      const result = await run_script([
        '--league-id',
        '999',
        '--team-id',
        '1',
        '--player-id',
        'test_player',
        '--dry-run'
      ])

      result.code.should.equal(1)
      result.stderr.should.include('League not found with ID: 999')
    })

    it('should fail with invalid team ID', async () => {
      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '999',
        '--player-id',
        'test_player',
        '--dry-run'
      ])

      result.code.should.equal(1)
      result.stderr.should.include('Team not found with ID: 999')
    })
  })

  describe('successful release operations', function () {
    it('should successfully release a bench player', async () => {
      const roster_before = await getRoster({ tid: 1 })
      const player_to_release = roster_before.players.find(
        (p) =>
          p.pos !== 'DEF' &&
          p.slot !== constants.slots.PSP &&
          p.slot !== constants.slots.PSDP
      )

      if (!player_to_release) {
        throw new Error('No suitable player found for testing')
      }

      const player_count_before = roster_before.players.length

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        player_to_release.pid
      ])

      result.code.should.equal(0)
      result.stdout.should.include('Release Successful')
      result.stdout.should.include('Released:')
      result.stdout.should.include('Transaction ID:')

      // Verify player was actually removed from roster
      const roster_after = await getRoster({ tid: 1 })
      const player_still_on_roster = roster_after.players.find(
        (p) => p.pid === player_to_release.pid
      )
      expect(player_still_on_roster).to.be.undefined

      // Verify roster size decreased
      roster_after.players.length.should.equal(player_count_before - 1)

      // Verify transaction was logged
      const transaction = await knex('transactions')
        .where({
          pid: player_to_release.pid,
          tid: 1,
          lid: 1,
          type: constants.transactions.ROSTER_RELEASE
        })
        .orderBy('timestamp', 'desc')
        .first()

      expect(transaction).to.exist
    })

    it('should successfully release and activate players', async () => {
      const roster_before = await getRoster({ tid: 1 })

      // Find a bench player to release
      const player_to_release = roster_before.players.find(
        (p) =>
          p.pos !== 'DEF' &&
          p.slot !== constants.slots.PSP &&
          p.slot !== constants.slots.PSDP
      )

      // Find a practice squad player to activate
      const player_to_activate = roster_before.players.find(
        (p) => p.slot === constants.slots.PS && p.pos !== 'DEF'
      )

      if (!player_to_release || !player_to_activate) {
        return this.skip() // Skip if no suitable players found
      }

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        player_to_release.pid,
        '--activate-player-id',
        player_to_activate.pid
      ])

      result.code.should.equal(0)
      result.stdout.should.include('Release Successful')
      result.stdout.should.include('Released:')
      result.stdout.should.include('Activated:')

      // Verify the roster changes
      const roster_after = await getRoster({ tid: 1 })

      // Released player should be gone
      const released_player_on_roster = roster_after.players.find(
        (p) => p.pid === player_to_release.pid
      )
      expect(released_player_on_roster).to.be.undefined

      // Activated player should be on bench now
      const activated_player_on_roster = roster_after.players.find(
        (p) => p.pid === player_to_activate.pid
      )
      expect(activated_player_on_roster).to.exist
      activated_player_on_roster.slot.should.equal(constants.slots.BENCH)
    })
  })

  describe('help and usage', function () {
    it('should display help when requested', async () => {
      const result = await run_script(['--help'])

      result.code.should.equal(0)
      result.stdout.should.include('help')
      result.stdout.should.include('--league-id')
      result.stdout.should.include('--team-id')
      result.stdout.should.include('--player-id')
      result.stdout.should.include('--player-name')
      result.stdout.should.include('Examples:')
    })
  })
})
