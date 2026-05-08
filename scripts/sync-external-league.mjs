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
  --week <week>                Week number (default: 1)
  --dry-run                    Validate connection + read access only;
                               do not write to the database
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
    credentials_key: null
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
