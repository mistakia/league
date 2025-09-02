/* global describe before it beforeEach */
import * as chai from 'chai'
import MockDate from 'mockdate'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import draft from '#db/seeds/draft.mjs'
import { constants } from '#libs-shared'
import { getRoster } from '#libs-server'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const script_path = path.join(__dirname, '../scripts/release-player.mjs')
const { regular_season_start } = constants.season

// Track players used in tests to avoid duplicates
const used_pids = new Set()

describe('CLI release-player script', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
    await league(knex)
    await draft(knex)
    used_pids.clear() // Clear tracked players for each test
  })

  const run_script = (args) => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [script_path, ...args], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MOCK_DATE: regular_season_start.subtract('2', 'month').toISOString()
        }
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
      const player = await selectPlayer({
        random: false,
        exclude_rostered_players: true,
        exclude_pids: Array.from(used_pids)
      })
      used_pids.add(player.pid)
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
      // Use a deterministic player for ID resolution test
      const player = await selectPlayer({
        random: false,
        exclude_rostered_players: true,
        exclude_pids: Array.from(used_pids)
      })
      used_pids.add(player.pid)
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
      // Use a deterministic player for name matching
      const player = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true,
        exclude_pids: Array.from(used_pids)
      })
      used_pids.add(player.pid)
      await addPlayer({
        player,
        leagueId: 1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.BENCH
      })

      const full_name = `${player.fname} ${player.lname}`

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
      result.stdout.should.include(player.fname)
      result.stdout.should.include(player.lname)
    })

    it('should handle fuzzy name matching', async () => {
      // First, clear any existing players with common first names from the roster
      // to ensure a clean test environment
      await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          'rosters.tid': 1,
          'rosters.lid': 1,
          'rosters.year': constants.season.year,
          'rosters.week': constants.season.week
        })
        .del()

      // Use a specific player to ensure deterministic behavior
      // Find a player with a unique first name to avoid ambiguity
      let test_player = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .where('pos1', 'WR')
        .whereNotIn('pid', Array.from(used_pids))
        .whereRaw(
          `fname NOT IN (
          SELECT fname FROM player 
          WHERE pos1 = 'WR' AND current_nfl_team != 'INA'
          GROUP BY fname 
          HAVING COUNT(*) > 1
        )`
        )
        .orderBy('pid')
        .first()

      if (!test_player) {
        // Fallback: use any WR player but ensure no duplicates with same first name
        test_player = await knex('player')
          .whereNot('current_nfl_team', 'INA')
          .where('pos1', 'WR')
          .whereNotIn('pid', Array.from(used_pids))
          .orderBy('pid')
          .first()

        if (!test_player) {
          throw new Error('No suitable player found for fuzzy matching test')
        }
      }

      used_pids.add(test_player.pid)
      await addPlayer({
        player: test_player,
        leagueId: 1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.BENCH
      })

      // Use just first name for matching
      const partial_name = test_player.fname

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
      result.stdout.should.include(test_player.fname)
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
      const player_not_on_roster = await selectPlayer({
        random: false,
        exclude_rostered_players: true,
        exclude_pids: Array.from(used_pids)
      })
      used_pids.add(player_not_on_roster.pid)

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
      // Add a practice squad player to activate
      const practice_player = await selectPlayer({
        random: false,
        exclude_rostered_players: true,
        exclude_pids: Array.from(used_pids)
      })
      used_pids.add(practice_player.pid)

      await addPlayer({
        player: practice_player,
        leagueId: 1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS
      })

      const roster_before = await getRoster({ tid: 1 })

      // Find an existing bench player to release
      const bench_player = roster_before.players.find(
        (p) =>
          p.pos !== 'DEF' &&
          p.slot === constants.slots.BENCH &&
          p.slot !== constants.slots.PSP &&
          p.slot !== constants.slots.PSDP
      )

      const result = await run_script([
        '--league-id',
        '1',
        '--team-id',
        '1',
        '--player-id',
        bench_player.pid,
        '--activate-player-id',
        practice_player.pid
      ])

      result.code.should.equal(0)
      result.stdout.should.include('Release Successful')
      result.stdout.should.include('Released:')
      result.stdout.should.include('Activated:')

      // Verify the roster changes
      const roster_after = await getRoster({ tid: 1 })

      // Released player should be gone
      const released_player_on_roster = roster_after.players.find(
        (p) => p.pid === bench_player.pid
      )
      expect(released_player_on_roster).to.be.undefined

      // Activated player should be on bench now
      const activated_player_on_roster = roster_after.players.find(
        (p) => p.pid === practice_player.pid
      )
      expect(activated_player_on_roster).to.exist
      activated_player_on_roster.slot.should.equal(constants.slots.BENCH)
    })
  })

  describe('help and usage', function () {
    it('should display help when requested', async () => {
      const result = await run_script(['-h'])

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
