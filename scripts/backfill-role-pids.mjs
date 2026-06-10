import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import player_cache, {
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { enrich_player_identifications } from '#libs-server/play-enrichment/player-identification-enrichment.mjs'
import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'
import {
  get_play_stats,
  get_completed_games
} from '#libs-server/play-stats-utils.mjs'

// Surgical backfill for the psr/trg family-gate regression (Phase B, commit
// 01dece89). Re-runs ONLY player-identification enrichment and persists ONLY
// the passer/target role columns, so it corrects the wiped trg_pid/psr_pid on
// 2023+ reprocessed seasons WITHOUT the broad tackle/EPA churn a full
// process-plays reprocess would introduce. See
// libs-server/play-enrichment/player-identification-enrichment.mjs.
const log = debug('backfill-role-pids')
debug.enable('backfill-role-pids')

const ROLE_COLS = ['psr_gsis', 'psr_pid', 'trg_gsis', 'trg_pid']

const norm = (v) => (v === undefined ? null : v)

const backfill_week = async ({ year, week, seas_type, dry_run }) => {
  const completed = await get_completed_games({ year, week, seas_type })
  if (!completed.length) return { plays: 0, updates: 0 }

  const play_stats = await get_play_stats({ year, week, seas_type })
  const filtered = play_stats.filter((s) => completed.includes(s.esbid))

  const plays = await db('nfl_plays')
    .select('*')
    .where({ year, week, seas_type })
    .whereIn('esbid', completed)

  const enriched = enrich_player_identifications(plays, filtered, player_cache)

  const by_key = new Map()
  for (const p of plays) by_key.set(`${p.esbid}-${p.playId}`, p)

  const updates = []
  for (const ep of enriched) {
    const cur = by_key.get(`${ep.esbid}-${ep.playId}`)
    if (!cur) continue
    const changed = {}
    for (const col of ROLE_COLS) {
      if (norm(ep[col]) !== norm(cur[col])) changed[col] = norm(ep[col])
    }
    if (Object.keys(changed).length) {
      updates.push({ esbid: ep.esbid, playId: ep.playId, changed })
    }
  }

  if (!dry_run && updates.length) {
    for (const part of chunk_array({ items: updates, chunk_size: 500 })) {
      await db.transaction(async (trx) => {
        for (const u of part) {
          await trx('nfl_plays')
            .where({ esbid: u.esbid, playId: u.playId })
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
    .select('year', 'seas_type', 'week')
    .where('year', '>=', argv.start)
    .where('year', '<=', argv.end)
    .groupBy('year', 'seas_type', 'week')
    .orderBy([
      { column: 'year', order: 'asc' },
      { column: 'seas_type', order: 'asc' },
      { column: 'week', order: 'asc' }
    ])

  let total_plays = 0
  let total_updates = 0
  for (const { year, seas_type, week } of rows) {
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
