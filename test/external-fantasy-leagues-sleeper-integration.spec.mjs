/* global describe, it, before */
import * as chai from 'chai'

import {
  load_expected_output,
  load_platform_response
} from './utils/fixture-loader.mjs'
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Sleeper integration (authentic fixtures)', function () {
  let sleeper_league_fixture
  let sleeper_rosters_fixture
  let sleeper_transactions_fixture
  let sleeper_players_fixture
  let sync_results_expected

  let adapter
  let league_id

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
    sync_results_expected = await load_expected_output('sleeper-sync-results')

    league_id = sleeper_league_fixture.data.league.league_id

    adapter = new SleeperAdapter()
    adapter.api_client.get = async (url) => {
      if (url.includes('/users')) return sleeper_league_fixture.data.users
      if (url.includes('/rosters')) return sleeper_rosters_fixture.data.rosters
      if (url.includes('/transactions/'))
        return sleeper_transactions_fixture.data.transactions
      if (url.includes('/players/nfl'))
        return sleeper_players_fixture.data.players
      if (url.includes('/league/')) return sleeper_league_fixture.data.league
      throw new Error(`Unexpected URL: ${url}`)
    }
  })

  describe('SleeperAdapter.get_league()', function () {
    it('returns canonical league matching the baseline team count', async function () {
      const result = await adapter.get_league(league_id)
      const expected = sync_results_expected.canonical.league

      result.should.have.property('platform', 'SLEEPER')
      result.should.have.property('external_id', league_id)
      result.should.have.property('name', expected.name)
      result.should.have.property('year', expected.year)
      result.teams.should.have.length(expected.teams.length)
      result.settings.should.have.property(
        'num_teams',
        expected.settings.num_teams
      )
      result.should.have.property(
        'commissioner_id',
        expected.commissioner_id
      )
    })

    it('translates Sleeper scoring_settings into the canonical scoring_settings shape', async function () {
      const result = await adapter.get_league(league_id)
      const canonical_keys = Object.keys(result.scoring_settings)

      canonical_keys.should.include('passing_yards')
      canonical_keys.should.include('passing_touchdowns')
      canonical_keys.should.include('rushing_yards')
      canonical_keys.should.include('receiving_yards')
      canonical_keys.should.include('receptions')
    })
  })

  describe('SleeperAdapter.get_rosters()', function () {
    it('returns canonical rosters with player arrays from the real fixture', async function () {
      const result = await adapter.get_rosters({ league_id })
      const expected = sync_results_expected.canonical.rosters

      result.should.have.length(expected.length)

      const first = result[0]
      first.should.have.property('platform', 'SLEEPER')
      first.should.have.property('external_roster_id')
      first.players.should.be.an('array')
      first.players.length.should.equal(expected[0].players.length)
    })
  })

  describe('SleeperAdapter.get_transactions()', function () {
    it('returns canonical transactions correctly unpacking adds/drops', async function () {
      const result = await adapter.get_transactions({
        league_id,
        options: { week: 1 }
      })
      const expected = sync_results_expected.canonical.transactions

      result.should.have.length(expected.length)

      const sample = result[0]
      sample.should.have.property('platform', 'SLEEPER')
      sample.should.have.property('external_transaction_id')
      sample.should.have.property('transaction_type')
      sample.should.have.property('league_external_id', league_id)
    })

    it('produces every transaction with a recognized canonical transaction_type', async function () {
      const result = await adapter.get_transactions({
        league_id,
        options: { week: 1 }
      })
      const valid_types = new Set([
        'WAIVER_CLAIM',
        'WAIVER_ADD',
        'WAIVER_DROP',
        'FREE_AGENT_ADD',
        'FREE_AGENT_DROP',
        'FREE_AGENT_PICKUP',
        'TRADE',
        'COMMISSIONER',
        'DRAFT',
        'ROSTER_ADD',
        'ROSTER_DROP'
      ])
      for (const txn of result) {
        valid_types.has(txn.transaction_type).should.equal(
          true,
          `unexpected transaction_type: ${txn.transaction_type}`
        )
      }
    })
  })

  describe('SleeperAdapter.get_players()', function () {
    it('returns canonical players from the real Sleeper fixture', async function () {
      const result = await adapter.get_players({ filters: {} })
      const expected = sync_results_expected.canonical.players

      result.should.have.length(expected.length)

      const sample = result[0]
      sample.should.have.property('platform', 'SLEEPER')
      sample.player_ids.should.have.property('sleeper_id')
      sample.should.have.property('player_name')
    })
  })

  describe('full sync workflow against authentic fixtures', function () {
    it('produces canonical outputs that match the baseline counts end-to-end', async function () {
      const [league, rosters, transactions, players] = await Promise.all([
        adapter.get_league(league_id),
        adapter.get_rosters({ league_id }),
        adapter.get_transactions({ league_id, options: { week: 1 } }),
        adapter.get_players({ filters: {} })
      ])

      league.teams.should.have.length(
        sync_results_expected.canonical.league.teams.length
      )
      rosters.should.have.length(
        sync_results_expected.canonical.rosters.length
      )
      transactions.should.have.length(
        sync_results_expected.canonical.transactions.length
      )
      players.should.have.length(
        sync_results_expected.canonical.players.length
      )
    })
  })
})
