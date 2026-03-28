import debug from 'debug'
import db from '#db'
import { is_main } from '#libs-server'

const log = debug('backfill-play-stats-gsisid')
debug.enable('backfill-play-stats-gsisid')

const apply_updates = async ({ rows_to_fix, dry_run }) => {
  if (dry_run) {
    log('[DRY RUN] No updates applied')
    return 0
  }

  let total_updated = 0
  for (const row of rows_to_fix) {
    await db('nfl_play_stats')
      .where({
        esbid: row.esbid,
        playId: row.playId,
        playerName: row.playerName,
        clubCode: row.clubCode,
        statId: row.statId
      })
      .update({ gsisId: row.gsisid })
    total_updated++
  }

  return total_updated
}

const group_and_log = (rows, label) => {
  const by_player = {}
  for (const row of rows) {
    const key = `${row.playerName} (${row.clubCode})`
    if (!by_player[key]) {
      by_player[key] = { gsisid: row.gsisid, pid: row.pid, count: 0 }
    }
    by_player[key].count++
  }

  if (Object.keys(by_player).length > 0) {
    log(`${label}:`)
    for (const [name, info] of Object.entries(by_player).sort(
      (a, b) => b[1].count - a[1].count
    )) {
      log(
        `  ${name}: ${info.count} rows -> gsisId ${info.gsisid} (${info.pid})`
      )
    }
  }

  return by_player
}

const backfill_play_stats_gsisid = async ({ year, dry_run = false } = {}) => {
  log(`Backfilling gsisId on nfl_play_stats for year ${year}`)

  let total_updated = 0

  // Pass 1: Match by pname + current_nfl_team (exact team match)
  const pass1_rows = await db('nfl_play_stats as ps')
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

  // Filter out ambiguous matches (multiple players with same pname+team)
  const pass1_by_key = {}
  for (const row of pass1_rows) {
    const key = `${row.esbid}:${row.playId}:${row.statId}`
    if (!pass1_by_key[key]) {
      pass1_by_key[key] = []
    }
    pass1_by_key[key].push(row)
  }
  const pass1_unique = []
  let pass1_ambiguous = 0
  for (const [, rows] of Object.entries(pass1_by_key)) {
    if (rows.length === 1) {
      pass1_unique.push(rows[0])
    } else {
      pass1_ambiguous += rows.length
    }
  }

  log(
    `Pass 1 (pname + current_nfl_team): found ${pass1_rows.length} rows, ${pass1_unique.length} unique, ${pass1_ambiguous} ambiguous (skipped)`
  )

  if (pass1_unique.length > 0) {
    group_and_log(pass1_unique, 'Pass 1 players')
    const updated = await apply_updates({
      rows_to_fix: pass1_unique,
      dry_run
    })
    total_updated += updated
    log(`Pass 1: updated ${updated} rows`)
  }

  // Pass 2: Match remaining null gsisId rows by pname only (for team-change cases)
  // Only accept unique pname matches to avoid ambiguity
  const pass2_candidates = await db('nfl_play_stats as ps')
    .join('nfl_games as g', 'ps.esbid', 'g.esbid')
    .where('g.year', year)
    .whereNull('ps.gsisId')
    .whereNotNull('ps.playerName')
    .where('ps.playerName', '!=', '')
    .select(
      'ps.esbid',
      'ps.playId',
      'ps.playerName',
      'ps.clubCode',
      'ps.statId'
    )

  if (pass2_candidates.length > 0) {
    log(
      `Pass 2 (pname-only fallback): ${pass2_candidates.length} remaining rows`
    )

    // Get unique playerNames from candidates
    const player_names = [...new Set(pass2_candidates.map((r) => r.playerName))]

    // Find players matching by pname with exactly one match
    const player_matches = await db('player')
      .whereIn('pname', player_names)
      .whereNotNull('gsisid')
      .select('pname', 'pid', 'gsisid')

    // Group by pname to find unique matches
    const by_pname = {}
    for (const p of player_matches) {
      if (!by_pname[p.pname]) {
        by_pname[p.pname] = []
      }
      by_pname[p.pname].push(p)
    }

    // Only use unique matches (exactly one player with that pname)
    const unique_matches = {}
    for (const [pname, players] of Object.entries(by_pname)) {
      if (players.length === 1) {
        unique_matches[pname] = players[0]
      }
    }

    // Build rows to fix with resolved player info
    const pass2_rows = []
    const skipped_ambiguous = new Set()
    for (const row of pass2_candidates) {
      const match = unique_matches[row.playerName]
      if (match) {
        pass2_rows.push({
          ...row,
          pid: match.pid,
          gsisid: match.gsisid,
          pname: match.pname
        })
      } else if (by_pname[row.playerName]?.length > 1) {
        skipped_ambiguous.add(row.playerName)
      }
    }

    if (skipped_ambiguous.size > 0) {
      log(
        `Pass 2: skipped ${skipped_ambiguous.size} ambiguous names: ${[...skipped_ambiguous].join(', ')}`
      )
    }

    if (pass2_rows.length > 0) {
      group_and_log(pass2_rows, 'Pass 2 players (team-change)')
      const updated = await apply_updates({
        rows_to_fix: pass2_rows,
        dry_run
      })
      total_updated += updated
      log(`Pass 2: updated ${updated} rows`)
    } else {
      log('Pass 2: no unique matches found')
    }
  }

  // Check remaining unresolved
  const remaining = await db('nfl_play_stats as ps')
    .join('nfl_games as g', 'ps.esbid', 'g.esbid')
    .where('g.year', year)
    .whereNull('ps.gsisId')
    .whereNotNull('ps.playerName')
    .where('ps.playerName', '!=', '')
    .count('* as count')
    .first()

  log(
    `Total updated: ${total_updated}, remaining unresolved: ${remaining.count}`
  )
  return { updated: total_updated, remaining: parseInt(remaining.count) }
}

const main = async () => {
  const args = process.argv.slice(2)
  const year_idx = args.indexOf('--year')
  const year = year_idx >= 0 ? parseInt(args[year_idx + 1]) : null
  const dry_run = args.includes('--dry')

  if (!year) {
    console.error(
      'Usage: node scripts/backfill-play-stats-gsisid.mjs --year 2025 [--dry]'
    )
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
