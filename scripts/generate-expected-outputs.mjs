#!/usr/bin/env node
/**
 * Run external-fantasy-leagues mappers and adapters against real Sleeper
 * fixtures and write authentic expected-output JSON files used by the
 * fixture-based test specs.
 *
 * Source fixtures: test/fixtures/external-fantasy-leagues/platform-responses/sleeper/
 * Outputs:         test/fixtures/external-fantasy-leagues/expected-outputs/
 *
 * Run:   node scripts/generate-expected-outputs.mjs
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { is_main } from '#libs-server'
import {
  LeagueConfigMapper,
  TransactionMapper
} from '#libs-server/external-fantasy-leagues/mappers/index.mjs'
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fixtures_root = path.join(
  __dirname,
  '..',
  'test',
  'fixtures',
  'external-fantasy-leagues'
)

const platform_responses_dir = path.join(
  fixtures_root,
  'platform-responses',
  'sleeper'
)

const expected_outputs_dir = path.join(fixtures_root, 'expected-outputs')

async function read_fixture(filename) {
  const file_path = path.join(platform_responses_dir, filename)
  return JSON.parse(await fs.readFile(file_path, 'utf8'))
}

async function write_expected(filename, data) {
  const file_path = path.join(expected_outputs_dir, filename)
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + '\n')
  console.log(`wrote ${path.relative(process.cwd(), file_path)}`)
}

function generate_league_config_output({ league_fixture }) {
  const league = league_fixture.data.league
  const input = {
    platform: 'sleeper',
    league_config: { num_teams: league.total_rosters },
    scoring_config: league.scoring_settings,
    roster_config: league.roster_positions
  }
  const mapper = new LeagueConfigMapper()
  const output = mapper.map_league_config(input)

  return {
    mapper: 'LeagueConfigMapper.map_league_config',
    platform: 'sleeper',
    source_fixture: 'platform-responses/sleeper/league-config.json',
    generated_at: new Date().toISOString(),
    input,
    expected_output: output
  }
}

function generate_transaction_mappings_output({
  transactions_fixture,
  rosters_fixture,
  players_fixture,
  league_fixture
}) {
  const player_mappings = new Map()
  for (const external_id of Object.keys(players_fixture.data.players || {})) {
    player_mappings.set(external_id, `pid-sleeper-${external_id}`)
  }

  const team_mappings = new Map()
  for (const roster of rosters_fixture.data.rosters || []) {
    team_mappings.set(roster.roster_id, `tid-${roster.roster_id}`)
  }

  const user_mappings = new Map()
  for (const user of league_fixture.data.users || []) {
    user_mappings.set(user.user_id, `userid-${user.user_id}`)
  }

  const context = {
    league_id: 'lid-fixture',
    year: 2025,
    week: 1,
    player_mappings,
    team_mappings,
    user_mappings
  }

  const mapper = new TransactionMapper()
  const external_transactions = transactions_fixture.data.transactions || []
  const mapped = mapper.bulk_map_transactions({
    platform: 'sleeper',
    external_transactions,
    context
  })

  let skipped_external = 0
  for (const external of external_transactions) {
    const rows = mapper.map_transaction({
      platform: 'sleeper',
      external_transaction: external,
      context
    })
    if (rows.length === 0) skipped_external += 1
  }

  const type_counts = {}
  for (const txn of mapped) {
    type_counts[txn.type] = (type_counts[txn.type] || 0) + 1
  }

  const sample_input = external_transactions[0]
    ? Object.keys(external_transactions[0]).sort()
    : []

  return {
    mapper: 'TransactionMapper.bulk_map_transactions',
    platform: 'sleeper',
    source_fixture: 'platform-responses/sleeper/transactions.json',
    generated_at: new Date().toISOString(),
    context_stub: {
      league_id: context.league_id,
      year: context.year,
      week: context.week,
      player_mapping_strategy:
        'pid-sleeper-<external_player_id> for every player in the players fixture',
      team_mapping_strategy: 'tid-<roster_id> for every roster',
      user_mapping_strategy: 'userid-<user_id> for every league user'
    },
    diagnostic: {
      external_transaction_top_level_keys: sample_input,
      note: 'Sleeper transactions nest player IDs in `adds`/`drops` dicts and use `roster_ids` (plural array). TransactionMapper fans these out into one internal row per moved player, so the mapped count exceeds the external transaction count whenever transactions move multiple players (trades, waiver claims that also drop a player).'
    },
    summary: {
      total_external: external_transactions.length,
      total_mapped: mapped.length,
      skipped_external,
      type_counts
    },
    mapped_transactions: mapped
  }
}

function generate_player_mappings_output({ players_fixture }) {
  const players = players_fixture.data.players || {}
  const inputs = []
  for (const [external_id, player] of Object.entries(players)) {
    const name =
      player.full_name ||
      [player.first_name, player.last_name].filter(Boolean).join(' ') ||
      null
    inputs.push({
      external_id,
      fallback_data: {
        name,
        position: player.position || null,
        team: player.team || null
      }
    })
  }

  return {
    mapper: 'PlayerIdMapper (DB-dependent)',
    platform: 'sleeper',
    source_fixture: 'platform-responses/sleeper/players.json',
    generated_at: new Date().toISOString(),
    note: 'PlayerIdMapper resolves external_id -> internal pid via find_player_row, which queries the player table. Tests using this mapper must stub find_player_row or run with the mocha test DB. This output captures the canonical inputs the mapper would receive when iterating the fixture.',
    total_players: inputs.length,
    inputs
  }
}

async function generate_sync_results_output({
  league_fixture,
  rosters_fixture,
  transactions_fixture,
  players_fixture
}) {
  const adapter = new SleeperAdapter()

  adapter.api_client.get = async (url) => {
    if (url.includes('/users')) return league_fixture.data.users
    if (url.includes('/rosters')) return rosters_fixture.data.rosters
    if (url.includes('/transactions/'))
      return transactions_fixture.data.transactions
    if (url.includes('/players/nfl')) return players_fixture.data.players
    if (url.includes('/league/')) return league_fixture.data.league
    throw new Error(`Unexpected URL in fixture-driven generator: ${url}`)
  }

  const league_id = league_fixture.data.league.league_id
  const [
    league_canonical,
    rosters_canonical,
    transactions_canonical,
    players_canonical
  ] = await Promise.all([
    adapter.get_league(league_id),
    adapter.get_rosters({ league_id }),
    adapter.get_transactions({ league_id, options: { week: 1 } }),
    adapter.get_players({ filters: {} })
  ])

  return {
    source_fixtures:
      'platform-responses/sleeper/{league-config,rosters,transactions,players}.json',
    generated_at: new Date().toISOString(),
    note: 'Canonical-format output produced by SleeperAdapter against real fixture data with api_client.get mocked to read fixtures. Used as the expected baseline for sync-orchestrator integration tests.',
    canonical: {
      league: league_canonical,
      rosters: rosters_canonical,
      transactions: transactions_canonical,
      players: players_canonical
    }
  }
}

async function main() {
  await fs.mkdir(expected_outputs_dir, { recursive: true })

  const [
    league_fixture,
    rosters_fixture,
    transactions_fixture,
    players_fixture
  ] = await Promise.all([
    read_fixture('league-config.json'),
    read_fixture('rosters.json'),
    read_fixture('transactions.json'),
    read_fixture('players.json')
  ])

  const league_output = generate_league_config_output({ league_fixture })
  const transaction_output = generate_transaction_mappings_output({
    transactions_fixture,
    rosters_fixture,
    players_fixture,
    league_fixture
  })
  const player_output = generate_player_mappings_output({ players_fixture })
  const sync_output = await generate_sync_results_output({
    league_fixture,
    rosters_fixture,
    transactions_fixture,
    players_fixture
  })

  await write_expected('sleeper-league-config.json', league_output)
  await write_expected('sleeper-transaction-mappings.json', transaction_output)
  await write_expected('sleeper-player-mappings.json', player_output)
  await write_expected('sleeper-sync-results.json', sync_output)
}

if (is_main(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
