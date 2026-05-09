#!/usr/bin/env node
/**
 * Command-line interface for external-fantasy-leagues sync operations.
 *
 * Wraps SyncOrchestrator.sync() — the unified entry point that dispatches to
 * either a full sync_league() or _perform_validation_sync() (dry run).
 *
 * Usage:
 *   node scripts/sync-external-league.mjs \
 *     --platform sleeper \
 *     --external-league-id 1234567890 \
 *     --internal-league-id abc-123 \
 *     [--year 2025] [--week 1] [--dry-run]
 *
 *   node scripts/sync-external-league.mjs --help
 *
 * For platforms that require credentials (e.g., ESPN private leagues), pass a
 * --credentials-key naming a top-level key in #config that holds the
 * authentication payload, e.g. `--credentials-key external_fantasy_leagues.espn`.
 */

import { is_main } from '#libs-server'
import config from '#config'
import SyncOrchestrator from '#libs-server/external-fantasy-leagues/sync/sync-orchestrator.mjs'

function print_help() {
  console.log(`
Usage: node scripts/sync-external-league.mjs [options]

Required:
  --platform <name>            Platform identifier (sleeper, espn, ...)
  --external-league-id <id>    External platform's league ID
  --internal-league-id <id>    Internal league ID to sync into

Optional:
  --year <year>                Season year (defaults to current_season.year)
  --week <week>                Single week to scope transaction fetches.
                               When omitted, transactions iterate the full
                               season (weeks 1-18) and concatenate.
  --dry-run                    Read-only run: fetches league config,
                               rosters, transactions, and players, reports
                               counts, but does not write to the database.
  --include-players <mode>     'rostered' (default), 'all', or 'none'.
                               'rostered' intersects the platform's global
                               player catalog with players appearing on a
                               roster; 'all' returns the global catalog;
                               'none' skips the player fetch entirely.
  --credentials-key <path>     Dot-separated key path into #config that holds
                               the credentials object (e.g.
                               external_fantasy_leagues.espn)
  --help                       Show this help

Exit codes:
  0  Sync completed successfully
  1  Validation failed, sync errored, or invalid arguments
`)
}

function resolve_credentials(credentials_key) {
  if (!credentials_key) return {}
  const parts = credentials_key.split('.')
  let cursor = config
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      throw new Error(
        `Credentials key not found in config: ${credentials_key}`
      )
    }
    cursor = cursor[part]
  }
  if (cursor == null || typeof cursor !== 'object') {
    throw new Error(
      `Credentials key did not resolve to an object: ${credentials_key}`
    )
  }
  return cursor
}

function format_summary(result) {
  const lines = [
    `Platform:           ${result.platform || 'n/a'}`,
    `Success:            ${result.success}`
  ]
  if (typeof result.duration_ms === 'number') {
    lines.push(`Duration:           ${result.duration_ms} ms`)
  }
  if (result.validation && Object.keys(result.validation).length > 0) {
    const v = result.validation
    if (typeof v.team_count === 'number') {
      lines.push(`Teams:              ${v.team_count}`)
    }
    if (typeof v.roster_count === 'number') {
      lines.push(`Rosters:            ${v.roster_count}`)
    }
    if (typeof v.transaction_count === 'number') {
      lines.push(`Transactions:       ${v.transaction_count}`)
    }
    if (typeof v.player_count === 'number') {
      const mode_label = v.players_mode ? ` (${v.players_mode})` : ''
      lines.push(`Players:            ${v.player_count}${mode_label}`)
    }
  }
  if (result.sync_stats) {
    const s = result.sync_stats
    lines.push(`Players mapped:     ${s.players_mapped ?? 0}`)
    lines.push(`Transactions:       ${s.transactions_imported ?? 0}`)
    lines.push(`Rosters updated:    ${s.rosters_updated ?? 0}`)
    lines.push(`Errors logged:      ${(s.errors || []).length}`)
  }
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    lines.push('Errors:')
    for (const err of result.errors) {
      lines.push(
        `  - [${err.type || 'error'}] ${err.message || JSON.stringify(err)}`
      )
    }
  }
  return lines.join('\n')
}

async function main() {
  const argv = process.argv.slice(2)
  const options = {
    platform_name: null,
    external_league_id: null,
    internal_league_id: null,
    year: null,
    week: null,
    dry_run: false,
    credentials_key: null,
    include_players: null
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    let arg = token
    let inline_value = null
    if (token.startsWith('--') && token.includes('=')) {
      const eq = token.indexOf('=')
      arg = token.slice(0, eq)
      inline_value = token.slice(eq + 1)
    }
    const take_value = () => (inline_value !== null ? inline_value : argv[++i])
    switch (arg) {
      case '--platform':
        options.platform_name = take_value()
        break
      case '--external-league-id':
        options.external_league_id = take_value()
        break
      case '--internal-league-id':
        options.internal_league_id = take_value()
        break
      case '--year':
        options.year = parseInt(take_value(), 10)
        break
      case '--week':
        options.week = parseInt(take_value(), 10)
        break
      case '--dry-run':
        options.dry_run = true
        break
      case '--include-players': {
        const raw = take_value()
        const valid = ['rostered', 'all', 'none']
        if (!valid.includes(raw)) {
          console.error(
            `Invalid --include-players value: ${raw} (must be one of ${valid.join(', ')})`
          )
          process.exit(1)
        }
        options.include_players = raw === 'none' ? false : raw
        break
      }
      case '--credentials-key':
        options.credentials_key = take_value()
        break
      case '--help':
        print_help()
        process.exit(0)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        print_help()
        process.exit(1)
    }
  }

  const missing = ['platform_name', 'external_league_id', 'internal_league_id']
    .filter((key) => !options[key])
    .map((key) => `--${key.replace(/_/g, '-')}`)
  if (missing.length > 0) {
    console.error(`Missing required argument(s): ${missing.join(', ')}`)
    print_help()
    process.exit(1)
  }

  const credentials = resolve_credentials(options.credentials_key)

  const sync_options = {}
  if (options.year != null) sync_options.year = options.year
  if (options.week != null) sync_options.week = options.week
  if (options.include_players != null) {
    sync_options.include_players = options.include_players
  }

  const orchestrator = new SyncOrchestrator()
  const mode = options.dry_run ? 'dry-run' : 'full'
  console.log(
    `Starting ${mode} sync: platform=${options.platform_name} external=${options.external_league_id} internal=${options.internal_league_id}`
  )

  const result = await orchestrator.sync({
    platform_name: options.platform_name,
    external_league_id: options.external_league_id,
    internal_league_id: options.internal_league_id,
    credentials,
    dry_run: options.dry_run,
    sync_options
  })

  console.log(format_summary(result))

  if (!result.success) {
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main().catch((err) => {
    console.error('sync-external-league failed:', err.message)
    if (process.env.DEBUG) console.error(err.stack)
    process.exit(1)
  })
}
