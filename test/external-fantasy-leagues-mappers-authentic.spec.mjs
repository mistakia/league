/* global describe, it, before */
import * as chai from 'chai'

import {
  load_expected_output,
  load_platform_response
} from './utils/fixture-loader.mjs'
import {
  LeagueConfigMapper,
  TransactionMapper,
  PlayerIdMapper
} from '#libs-server/external-fantasy-leagues/mappers/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Mappers (authentic Sleeper fixtures)', function () {
  let sleeper_league_fixture
  let sleeper_rosters_fixture
  let sleeper_transactions_fixture
  let sleeper_players_fixture

  let league_config_expected
  let transaction_mappings_expected
  let player_mappings_expected

  before(async function () {
    sleeper_league_fixture = await load_platform_response(
      'sleeper',
      'league-config'
    )
    sleeper_rosters_fixture = await load_platform_response('sleeper', 'rosters')
    sleeper_transactions_fixture = await load_platform_response(
      'sleeper',
      'transactions'
    )
    sleeper_players_fixture = await load_platform_response('sleeper', 'players')

    league_config_expected = await load_expected_output('sleeper-league-config')
    transaction_mappings_expected = await load_expected_output(
      'sleeper-transaction-mappings'
    )
    player_mappings_expected = await load_expected_output(
      'sleeper-player-mappings'
    )
  })

  describe('LeagueConfigMapper.map_league_config', function () {
    it('reproduces baseline format hashes for the real Sleeper fixture', function () {
      const mapper = new LeagueConfigMapper()
      const result = mapper.map_league_config(league_config_expected.input)

      const expected = league_config_expected.expected_output
      result.league_format_hash.should.equal(expected.league_format_hash)
      result.scoring_format_hash.should.equal(expected.scoring_format_hash)

      Object.entries(expected.league_format).forEach(([key, value]) => {
        result.league_format.should.have.property(key, value)
      })
      Object.entries(expected.scoring_format).forEach(([key, value]) => {
        result.scoring_format.should.have.property(key, value)
      })
    })

    it('matches the real superflex league shape (1QB/2RB/3WR/1TE/2FLEX/15BN)', function () {
      const mapper = new LeagueConfigMapper()
      const league = sleeper_league_fixture.data.league
      const result = mapper.map_league_config({
        platform: 'sleeper',
        league_config: { num_teams: league.total_rosters },
        scoring_config: league.scoring_settings,
        roster_config: league.roster_positions
      })

      result.league_format.should.have.property(
        'num_teams',
        league_config_expected.expected_output.league_format.num_teams
      )
      result.league_format.should.have.property('sqb', 1)
      result.league_format.should.have.property('srb', 2)
      result.league_format.should.have.property('swr', 3)
      result.league_format.should.have.property('ste', 1)
      result.league_format.should.have.property('srbwr', 2)
      result.league_format.should.have.property('sqbrbwrte', 1)
      result.league_format.should.have.property('sdst', 0)
      result.league_format.should.have.property('sk', 0)
      result.league_format.should.have.property('bench', 15)
    })
  })

  describe('TransactionMapper.bulk_map_transactions', function () {
    it('fans out Sleeper add/drop dicts into one internal row per moved player', function () {
      const mapper = new TransactionMapper()
      const player_mappings = new Map()
      for (const id of Object.keys(
        sleeper_players_fixture.data.players || {}
      )) {
        player_mappings.set(id, `pid-sleeper-${id}`)
      }
      const team_mappings = new Map()
      for (const roster of sleeper_rosters_fixture.data.rosters || []) {
        team_mappings.set(roster.roster_id, `tid-${roster.roster_id}`)
      }
      const user_mappings = new Map()
      for (const user of sleeper_league_fixture.data.users || []) {
        user_mappings.set(user.user_id, `userid-${user.user_id}`)
      }

      const external_transactions =
        sleeper_transactions_fixture.data.transactions
      const mapped = mapper.bulk_map_transactions({
        platform: 'sleeper',
        external_transactions,
        context: {
          league_id: 'lid-fixture',
          year: 2025,
          week: 1,
          player_mappings,
          team_mappings,
          user_mappings
        }
      })

      let expected_rows = 0
      for (const txn of external_transactions) {
        expected_rows += Object.keys(txn.adds || {}).length
        expected_rows += Object.keys(txn.drops || {}).length
      }

      mapped.should.have.length(expected_rows)
      mapped.length.should.be.above(0)
      mapped.should.have.length(
        transaction_mappings_expected.summary.total_mapped
      )
      transaction_mappings_expected.summary.total_external.should.equal(
        external_transactions.length
      )
    })

    it('extracts Sleeper transaction type and timestamp from real data', function () {
      const mapper = new TransactionMapper()
      const real_transaction = sleeper_transactions_fixture.data.transactions[0]

      real_transaction.should.have.property('type')
      real_transaction.should.have.property('created')

      const extracted_type = mapper.extract_transaction_type({
        platform: 'sleeper',
        external_transaction: real_transaction
      })
      extracted_type.should.equal(real_transaction.type)

      const timestamp = mapper.extract_timestamp(real_transaction)
      timestamp.should.be.a('number')
      // `created` is a JS millisecond timestamp; mapper converts to seconds
      timestamp.should.equal(Math.floor(real_transaction.created / 1000))
    })
  })

  describe('PlayerIdMapper (DB-dependent — input shape only)', function () {
    it('exposes the canonical column for every supported platform', function () {
      const mapper = new PlayerIdMapper()
      const platforms = mapper.get_supported_platforms()
      platforms.should.include('sleeper')
      platforms.should.include('espn')
      platforms.should.include('yahoo')
      platforms.should.include('mfl')
    })

    it('captures fallback inputs for every player in the real Sleeper fixture', function () {
      const players = sleeper_players_fixture.data.players || {}
      const inputs = player_mappings_expected.inputs

      inputs.should.have.length(Object.keys(players).length)
      inputs.should.have.length.above(0)

      const sample = inputs[0]
      sample.should.have.property('external_id')
      sample.should.have.property('fallback_data')
      sample.fallback_data.should.have.property('name')
      sample.fallback_data.should.have.property('position')
      sample.fallback_data.should.have.property('team')
    })
  })
})
