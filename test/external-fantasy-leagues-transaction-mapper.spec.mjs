/* global describe, it, before */
import * as chai from 'chai'

import {
  load_expected_output,
  load_platform_response
} from './utils/fixture-loader.mjs'
import { TransactionMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'
import { transaction_types } from '#constants'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Transaction Mapper', function () {
  let sleeper_transactions_fixture
  let sleeper_rosters_fixture
  let sleeper_players_fixture
  let sleeper_league_fixture
  let transaction_mappings_expected
  let mapper

  before(async function () {
    sleeper_transactions_fixture = await load_platform_response(
      'sleeper',
      'transactions'
    )
    sleeper_rosters_fixture = await load_platform_response('sleeper', 'rosters')
    sleeper_players_fixture = await load_platform_response('sleeper', 'players')
    sleeper_league_fixture = await load_platform_response(
      'sleeper',
      'league-config'
    )
    transaction_mappings_expected = await load_expected_output(
      'sleeper-transaction-mappings'
    )
    mapper = new TransactionMapper()
  })

  describe('platform support', function () {
    it('returns the supported platform list (sleeper, espn, yahoo, mfl)', function () {
      const platforms = mapper.get_supported_platforms()
      platforms.should.be.an('array')
      platforms.should.include('sleeper')
      platforms.should.include('espn')
      platforms.should.include('yahoo')
      platforms.should.include('mfl')
    })

    it('reports platform support correctly', function () {
      mapper
        .is_platform_supported({ platform: 'sleeper' })
        .should.equal(true)
      mapper
        .is_platform_supported({ platform: 'unsupported-platform' })
        .should.equal(false)
    })
  })

  describe('extract_transaction_type', function () {
    it('reads the type field from a real Sleeper transaction', function () {
      const real = sleeper_transactions_fixture.data.transactions[0]
      real.should.have.property('type')

      const extracted = mapper.extract_transaction_type({
        platform: 'sleeper',
        external_transaction: real
      })
      extracted.should.equal(real.type)
    })
  })

  describe('extract_timestamp', function () {
    it('converts a millisecond timestamp from a real Sleeper transaction to seconds', function () {
      const real = sleeper_transactions_fixture.data.transactions[0]
      real.should.have.property('created').that.is.a('number')

      const ts = mapper.extract_timestamp(real)
      ts.should.be.a('number')
      ts.should.equal(Math.floor(real.created / 1000))
    })
  })

  describe('bulk_map_transactions', function () {
    it(
      'documents known gap: maps 0/296 Sleeper transactions because the legacy mapper does not unpack adds/drops dicts',
      function () {
        // KNOWN GAP — Sleeper transactions nest player IDs in `adds`/`drops`
        // dicts and use plural `roster_ids`. The current
        // TransactionMapper.map_sleeper_fields reads `player_id` and
        // `roster_id` (singular) directly off the transaction, so every
        // Sleeper transaction fails validate_transaction (missing pid, tid)
        // and is skipped. Tracked as a [bug] observation on the task entity
        // (user:task/github/mistakia/league/162-import-and-sync-external-leagues.md);
        // this assertion is a regression baseline that will need to be
        // updated once the mapper handles the real structure.
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

        const mapped = mapper.bulk_map_transactions({
          platform: 'sleeper',
          external_transactions:
            sleeper_transactions_fixture.data.transactions,
          context: {
            league_id: 'lid-fixture',
            year: 2025,
            week: 1,
            player_mappings,
            team_mappings,
            user_mappings
          }
        })

        mapped.should.have.length(0)
        mapped.should.have.length(
          transaction_mappings_expected.summary.total_mapped
        )
        transaction_mappings_expected.summary.total_external.should.equal(
          sleeper_transactions_fixture.data.transactions.length
        )
      }
    )
  })

  describe('validate_transaction', function () {
    it('returns true for a transaction with all required fields', function () {
      const valid = {
        pid: 'PLAY-1234',
        tid: 'TID-1',
        lid: 'LID-1',
        timestamp: 1700000000,
        type: transaction_types.ROSTER_ADD
      }
      mapper.validate_transaction(valid).should.equal(true)
    })

    it('returns false when a required field is missing', function () {
      const base = {
        pid: 'PLAY-1234',
        tid: 'TID-1',
        lid: 'LID-1',
        timestamp: 1700000000,
        type: transaction_types.ROSTER_ADD
      }
      mapper
        .validate_transaction({ ...base, pid: null })
        .should.equal(false)
      mapper
        .validate_transaction({ ...base, tid: undefined })
        .should.equal(false)
      mapper
        .validate_transaction({ ...base, lid: null })
        .should.equal(false)
    })

    it('returns false for a timestamp before 2001', function () {
      mapper
        .validate_transaction({
          pid: 'PLAY-1234',
          tid: 'TID-1',
          lid: 'LID-1',
          timestamp: 100,
          type: transaction_types.ROSTER_ADD
        })
        .should.equal(false)
    })

    it('returns false for an unrecognized transaction type', function () {
      mapper
        .validate_transaction({
          pid: 'PLAY-1234',
          tid: 'TID-1',
          lid: 'LID-1',
          timestamp: 1700000000,
          type: 'NOT_A_REAL_TYPE'
        })
        .should.equal(false)
    })
  })
})
