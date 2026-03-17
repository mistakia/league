import debug from 'debug'
import db from '#db'
import { is_main } from '#libs-server'

const log = debug('backfill-play-stats-gsisid')
debug.enable('backfill-play-stats-gsisid')

const backfill_play_stats_gsisid = async ({ year, dry_run = false } = {}) => {
  log(`Backfilling gsisId on nfl_play_stats for year ${year}`)

  // Find play_stats rows with null gsisId but valid playerName
  // Join to player table via pname + current_nfl_team
  const rows_to_fix = await db('nfl_play_stats as ps')
    .join('nfl_games as g', 'ps.esbid', 'g.esbid')
    .join('player as p', function () {
      this.on('ps.playerName', '=', 'p.pname').andOn(
        'ps.clubCode',
        '=',
        'p.current_nfl_team'
      )
    })
    .where('g.year', year)
    .whereNull('ps.gsisId')
    .whereNotNull('ps.playerName')
    .where('ps.playerName', '!=', '')
    .whereNotNull('p.gsisid')
    .select(
      'ps.esbid',
      'ps.playId',
      'ps.playerName',
      'ps.clubCode',
      'ps.statId',
      'p.pid',
      'p.gsisid',
      'p.pname'
    )

  log(`Found ${rows_to_fix.length} rows to backfill`)

  if (rows_to_fix.length === 0) {
    log('Nothing to backfill')
    return { updated: 0 }
  }

  // Group by player for summary
  const by_player = {}
  for (const row of rows_to_fix) {
    const key = `${row.playerName} (${row.clubCode})`
    if (!by_player[key]) {
      by_player[key] = { gsisid: row.gsisid, pid: row.pid, count: 0 }
    }
    by_player[key].count++
  }

  log('Players to backfill:')
  for (const [name, info] of Object.entries(by_player).sort(
    (a, b) => b[1].count - a[1].count
  )) {
    log(`  ${name}: ${info.count} rows -> gsisId ${info.gsisid} (${info.pid})`)
  }

  if (dry_run) {
    log('[DRY RUN] No updates applied')
    return { updated: 0, would_update: rows_to_fix.length }
  }

  // Batch update by player (gsisid + clubCode + playerName combo)
  let total_updated = 0
  for (const [, info] of Object.entries(by_player)) {
    const player_rows = rows_to_fix.filter((r) => r.gsisid === info.gsisid)

    for (const row of player_rows) {
      await db('nfl_play_stats')
        .where({
          esbid: row.esbid,
          playId: row.playId,
          playerName: row.playerName,
          clubCode: row.clubCode,
          statId: row.statId
        })
        .update({ gsisId: info.gsisid })
      total_updated++
    }
  }

  log(`Updated ${total_updated} rows`)
  return { updated: total_updated }
}

const main = async () => {
  const args = process.argv.slice(2)
  const year_idx = args.indexOf('--year')
  const year = year_idx >= 0 ? parseInt(args[year_idx + 1]) : null
  const dry_run = args.includes('--dry')

  if (!year) {
    console.error('Usage: node scripts/backfill-play-stats-gsisid.mjs --year 2025 [--dry]')
    process.exit(1)
  }

  try {
    await backfill_play_stats_gsisid({ year, dry_run })
  } catch (err) {
    console.error(err)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_play_stats_gsisid
