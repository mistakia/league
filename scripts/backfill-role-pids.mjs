import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import player_cache, {
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { enrich_player_identifications } from '#libs-server/play-enrichment/player-identification-enrichment.mjs'
import { build_snap_roster_by_esbid } from '#libs-server/play-enrichment/build-snap-roster.mjs'
import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'
import {
  get_play_stats,
  get_completed_games
} from '#libs-server/play-stats-utils.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

// Surgical backfill for the psr/trg family-gate regression (Phase B, commit
// 01dece89). Re-runs ONLY player-identification enrichment and persists ONLY
// the passer/target role columns, so it corrects the wiped target_pid/passer_pid on
// 2023+ reprocessed seasons WITHOUT the broad tackle/EPA churn a full
// process-plays reprocess would introduce. See
// libs-server/play-enrichment/player-identification-enrichment.mjs.
const log = debug('backfill-role-pids')
enable_debug_namespaces('backfill-role-pids')

const ROLE_COLS = [
  'passer_gsis_player_id',
  'passer_pid',
  'target_gsis_player_id',
  'target_pid'
]

const norm = (v) => (v === undefined ? null : v)

const backfill_week = async ({ year, week, seas_type, dry_run }) => {
  const completed = await get_completed_games({ year, week, seas_type })
  if (!completed.length) return { plays: 0, updates: 0 }

  const play_stats = await get_play_stats({ year, week, seas_type })
  const filtered = play_stats.filter((s) => completed.includes(s.esbid))

  const plays = await db('nfl_plays')
    .select('*')
    .where({ season_year: year, week, season_type: seas_type })
    .whereIn('esbid', completed)

  // This script passed no snap roster until 2026-08-04, so it silently ran
  // without the source-NULL-gsisId fallback that `process-plays` gets -- an
  // opt-out by omission rather than by decision. It backfills the psr/trg
  // family, which is exactly where that fallback recovers actors.
  const snap_roster_by_esbid = await build_snap_roster_by_esbid(completed)

  const enriched = enrich_player_identifications(
    plays,
    filtered,
    player_cache,
    snap_roster_by_esbid
  )

  const by_key = new Map()
  for (const p of plays) by_key.set(`${p.esbid}-${p.play_id}`, p)

  const updates = []
  for (const ep of enriched) {
    const cur = by_key.get(`${ep.esbid}-${ep.play_id}`)
    if (!cur) continue
    const changed = {}
    for (const col of ROLE_COLS) {
      if (norm(ep[col]) !== norm(cur[col])) changed[col] = norm(ep[col])
    }
    if (Object.keys(changed).length) {
      updates.push({ esbid: ep.esbid, play_id: ep.play_id, changed })
    }
  }

  if (!dry_run && updates.length) {
    for (const part of chunk_array({ items: updates, chunk_size: 500 })) {
      await db.transaction(async (trx) => {
        for (const u of part) {
          await trx('nfl_plays')
            .where({ esbid: u.esbid, play_id: u.play_id })
            .update(u.changed)
        }
      })
    }
  }

  log(
    `${year} ${seas_type} wk ${week}: ${updates.length}/${plays.length} plays ${dry_run ? 'WOULD update' : 'updated'}`
  )
  return { plays: plays.length, updates: updates.length }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('start', { type: 'number', default: 2023 })
    .option('end', { type: 'number', default: 2025 })
    .option('dry', { type: 'boolean', default: false })
    .parse()

  const dry_run = argv.dry

  log(`preloading player cache (all players)`)
  await preload_active_players({ all_players: true })

  const rows = await db('nfl_plays')
    .select('season_year', 'season_type', 'week')
    .where('season_year', '>=', argv.start)
    .where('season_year', '<=', argv.end)
    .groupBy('season_year', 'season_type', 'week')
    .orderBy([
      { column: 'season_year', order: 'asc' },
      { column: 'season_type', order: 'asc' },
      { column: 'week', order: 'asc' }
    ])

  let total_plays = 0
  let total_updates = 0
  for (const { season_year: year, season_type: seas_type, week } of rows) {
    const { plays, updates } = await backfill_week({
      year,
      week,
      seas_type,
      dry_run
    })
    total_plays += plays
    total_updates += updates
  }

  log(
    `DONE: ${total_updates} plays ${dry_run ? 'would be' : ''} updated across ${total_plays} processed (${argv.start}-${argv.end})`
  )
  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}
