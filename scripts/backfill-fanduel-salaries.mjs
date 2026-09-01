import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import { is_main, report_job, rotowire, wait } from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('backfill-fanduel-salaries')
enable_debug_namespaces('backfill-fanduel-salaries,rotowire')

const out = (line) => console.log(line)

// FanDuel salaries for weeks our own importer missed, recovered from RotoWire.
//
// This exists because the DraftKings and FanDuel situations are NOT symmetric.
// A missed DraftKings week is recoverable from DraftKings itself forever, so
// backfill-draftkings-salaries.mjs replays the vendor. FanDuel expires its
// fixture lists, so a missed FanDuel week is gone from the vendor the moment the
// slate closes, and the only remaining route is a third party that archived it.
//
// Slates are matched to FanDuel by the operator's OWN fixture-list id, which
// RotoWire exposes as `SiteSlateID` and we already store as
// `source_contest_id` — so a backfilled row is keyed identically to a
// live-imported one and the two merge cleanly on the insert conflict key.
//
// Known coverage limit: RotoWire lists roughly the playable subset of a slate
// where our live importer captured everything. Measured on 2024 REG week 5
// fixture 107594 — 120 RotoWire players against 284 stored. Backfilled weeks are
// therefore THINNER than imported ones, and correctly so; the alternative is no
// data at all.
const ROTOWIRE_SLATES_PER_WEEK = 27
const DEFAULT_SCAN_RADIUS = 80

const REQUEST_DELAY_MS = 400

const paced_wait = async (base_ms, pace) => {
  const target = base_ms * pace
  await wait(target + Math.random() * target * 0.4)
}

const parse_week_window = (games) => {
  const dates = games
    .map((game) => game.date)
    .filter(Boolean)
    .sort()
  if (!dates.length) return null
  return {
    start: dayjs(dates[0]).subtract(1, 'day'),
    end: dayjs(dates[dates.length - 1]).add(1, 'day')
  }
}

// RotoWire slate ids increase with time like DraftKings draft group ids, but we
// have no stored RotoWire ids to bracket with. So the anchor comes from a
// CALIBRATION pair the operator supplies (or the built-in default), and the
// estimate is refined by probing.
//
// Anchors verified 2026-08-31 by reading each slate's own game datetime.
const CALIBRATION = [
  { slate_id: 7000, date: dayjs('2024-09-22') },
  { slate_id: 7150, date: dayjs('2024-10-06') },
  { slate_id: 8000, date: dayjs('2024-12-21') },
  { slate_id: 8301, date: dayjs('2025-01-26') },
  { slate_id: 9300, date: dayjs('2025-12-07') },
  { slate_id: 9640, date: dayjs('2026-01-17') }
]

// Linear interpolation between the two nearest calibration points, which is
// sound because slate ids advance at a roughly constant rate per week within a
// season. Used only to CENTRE a scan; every candidate is still confirmed against
// its own game datetime before anything is written.
const estimate_slate_id = (target_date) => {
  const sorted = [...CALIBRATION].sort((a, b) => a.date.diff(b.date))
  const before = sorted.filter((c) => c.date.isBefore(target_date))
  const after = sorted.filter((c) => c.date.isAfter(target_date))

  if (!before.length) return sorted[0].slate_id
  if (!after.length) return sorted[sorted.length - 1].slate_id

  const lo = before[before.length - 1]
  const hi = after[0]
  const total_days = hi.date.diff(lo.date, 'day')
  if (total_days <= 0) return lo.slate_id
  const elapsed = target_date.diff(lo.date, 'day')
  const fraction = elapsed / total_days
  return Math.round(lo.slate_id + fraction * (hi.slate_id - lo.slate_id))
}

const slate_covers_window = ({ players, window }) => {
  const times = players
    .map((player) => player?.game?.dateTime)
    .filter(Boolean)
    .map((value) => dayjs(value))
  if (!times.length) return false
  const earliest = times.reduce((a, b) => (a.isBefore(b) ? a : b))
  return !earliest.isBefore(window.start) && !earliest.isAfter(window.end)
}

const discover_fanduel_slates = async ({
  window,
  scan_radius,
  pace,
  seed_slate_ids
}) => {
  if (seed_slate_ids.length) {
    const seeded = []
    for (const slate_id of seed_slate_ids) {
      const slate = await rotowire.get_rotowire_slate({
        slate_id,
        operator: 'FANDUEL'
      })
      await paced_wait(REQUEST_DELAY_MS, pace)
      if (slate && slate_covers_window({ players: slate.players, window })) {
        seeded.push(slate)
      }
    }
    return seeded
  }

  const centre = estimate_slate_id(window.start)
  const lo = centre - scan_radius
  const hi = centre + scan_radius

  out(
    `  discovery: probing rotowire slates ${lo}-${hi} (estimated from ${centre}) ` +
      `for FanDuel slates in ${window.start.format('YYYY-MM-DD')}..${window.end.format('YYYY-MM-DD')}`
  )

  const found = []
  let probed = 0
  let probe_errors = 0
  let fanduel_seen = 0

  for (let slate_id = lo; slate_id <= hi; slate_id++) {
    let slate
    let failed = false
    try {
      slate = await rotowire.get_rotowire_slate({
        slate_id,
        operator: 'FANDUEL'
      })
    } catch (err) {
      probe_errors++
      failed = true
      log(err)
    } finally {
      probed++
      await paced_wait(REQUEST_DELAY_MS, pace)
    }
    if (failed || !slate) continue

    fanduel_seen++
    if (slate_covers_window({ players: slate.players, window })) {
      found.push(slate)
    }
  }

  // A scan that errors on most of its range is a blocked scan, not an empty one.
  const error_rate = probed ? probe_errors / probed : 0
  if (error_rate > 0.2) {
    throw new Error(
      `rotowire scan failed ${probe_errors}/${probed} probes ` +
        `(${(error_rate * 100).toFixed(0)}%) — treating as blocked, not empty`
    )
  }

  out(
    `  discovery: probed ${probed} slates, ${probe_errors} errors, ` +
      `${fanduel_seen} FanDuel, ${found.length} in window`
  )

  // Separately: finding FanDuel slates but none in the window means the id
  // estimate is off, which is a different failure from finding nothing at all
  // and should not be reported as an empty week.
  if (fanduel_seen > 0 && !found.length) {
    out(
      `  discovery: ${fanduel_seen} FanDuel slate(s) probed but none in window — ` +
        'calibration is likely off; widen --scan_radius or pass --slate_id'
    )
  }

  return found
}

const build_salary_rows = async ({ slate, games }) => {
  const rows = []
  let unmatched_players = 0
  let unmatched_games = 0

  for (const player of slate.players) {
    if (!player.salary) continue

    const name = `${player.firstName} ${player.lastName}`.trim()
    const team = player.team?.abbr

    let player_row
    try {
      player_row = find_player({
        name,
        teams: team ? [fixTeam(team)] : [],
        ignore_free_agent: false,
        ignore_retired: false
      })
    } catch (err) {
      log(err)
    }

    if (!player_row) {
      unmatched_players++
      continue
    }

    // Resolve the game from the player's own team and kickoff, since RotoWire
    // gives no matchup string.
    const kickoff = player.game?.dateTime
    if (!kickoff || !team) {
      unmatched_games++
      continue
    }
    const game_date = dayjs(kickoff).format('YYYY/MM/DD')
    const fixed_team = fixTeam(team)
    const game = games.find(
      (candidate) =>
        candidate.date === game_date &&
        (candidate.home_nfl_team === fixed_team ||
          candidate.away_nfl_team === fixed_team)
    )

    if (!game) {
      unmatched_games++
      continue
    }

    rows.push({
      pid: player_row.pid,
      esbid: game.esbid,
      source_competition_name: `${game.away_nfl_team} @ ${game.home_nfl_team}`,
      source_player_display_name: name,
      source_contest_id: String(slate.site_slate_id),
      salary: player.salary,
      source_id: 'FANDUEL'
    })
  }

  return {
    rows,
    listed: slate.players.length,
    unmatched_players,
    unmatched_games
  }
}

const backfill_week = async ({
  season_year,
  season_type,
  week,
  scan_radius,
  pace,
  seed_slate_ids,
  dry_run
}) => {
  const games = await db('nfl_games').where({ season_year, season_type, week })
  const week_label = `${season_year}-${season_type}-${week}`

  out(
    `${season_year} ${season_type} week ${week}: ${games.length} scheduled games`
  )
  if (!games.length) return { week_label, skipped: true }

  const window = parse_week_window(games)
  const slates = await discover_fanduel_slates({
    window,
    scan_radius,
    pace,
    seed_slate_ids
  })

  if (!slates.length) {
    return {
      week_label,
      total_games: games.length,
      slates: 0,
      rows: 0,
      covered_games: 0,
      coverage: 0
    }
  }

  const all_rows = []
  let total_listed = 0
  let total_unmatched_players = 0

  for (const slate of slates) {
    const result = await build_salary_rows({ slate, games })
    total_listed += result.listed
    total_unmatched_players += result.unmatched_players
    all_rows.push(...result.rows)
    out(
      `  slate ${slate.slate_id} (fixture ${slate.site_slate_id}): ` +
        `${result.listed} listed -> ${result.rows.length} rows ` +
        `(${result.unmatched_players} unmatched players, ${result.unmatched_games} unmatched games)`
    )
  }

  const deduped = new Map()
  for (const row of all_rows) {
    deduped.set(`${row.pid}|${row.esbid}|${row.source_contest_id}`, row)
  }
  const rows = [...deduped.values()]

  const covered_games = new Set(rows.map((row) => row.esbid)).size
  const coverage = games.length ? covered_games / games.length : 0
  const player_match_rate = total_listed
    ? (total_listed - total_unmatched_players) / total_listed
    : 0

  if (!dry_run && rows.length) {
    await db('player_salaries')
      .insert(rows)
      .onConflict(['pid', 'esbid', 'source_contest_id'])
      .merge()
  }

  out(
    `  => ${rows.length} rows across ${slates.length} slate(s), ` +
      `${covered_games}/${games.length} games covered (${(coverage * 100).toFixed(0)}%), ` +
      `player match ${(player_match_rate * 100).toFixed(1)}%` +
      (dry_run ? ' [DRY RUN, nothing written]' : '')
  )

  return {
    week_label,
    total_games: games.length,
    slates: slates.length,
    rows: rows.length,
    covered_games,
    coverage,
    player_match_rate
  }
}

const find_gap_weeks = async ({ season_year }) => {
  const query = db('nfl_games')
    .select('season_year', 'season_type', 'week')
    .count('* as total_games')
    .whereIn('season_type', ['REG', 'POST'])
    .groupBy('season_year', 'season_type', 'week')
    .orderBy(['season_year', 'season_type', 'week'])

  if (season_year) query.where({ season_year })

  const weeks = await query

  const covered = await db('player_salaries')
    .join('nfl_games', 'nfl_games.esbid', 'player_salaries.esbid')
    .select('nfl_games.season_year', 'nfl_games.season_type', 'nfl_games.week')
    .countDistinct('player_salaries.esbid as salary_games')
    .where('player_salaries.source_id', 'FANDUEL')
    .groupBy('nfl_games.season_year', 'nfl_games.season_type', 'nfl_games.week')

  const covered_index = new Map(
    covered.map((row) => [
      `${row.season_year}|${row.season_type}|${row.week}`,
      Number(row.salary_games)
    ])
  )

  return weeks
    .map((row) => ({
      season_year: row.season_year,
      season_type: row.season_type,
      week: row.week,
      total_games: Number(row.total_games),
      salary_games:
        covered_index.get(
          `${row.season_year}|${row.season_type}|${row.week}`
        ) ?? 0
    }))
    .filter((row) => row.salary_games < row.total_games)
}

const backfill_fanduel_salaries = async ({
  season_year = null,
  week = null,
  season_type = 'REG',
  scan_radius = DEFAULT_SCAN_RADIUS,
  pace = 1,
  slate_ids = [],
  dry_run = false,
  limit = null
} = {}) => {
  await preload_active_players({
    all_players: true,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  let targets
  if (week !== null) {
    if (!season_year) throw new Error('--week requires --year')
    targets = [{ season_year, season_type, week }]
  } else {
    const gaps = await find_gap_weeks({ season_year })
    targets = gaps.map((row) => ({
      season_year: row.season_year,
      season_type: row.season_type,
      week: row.week
    }))
    out(`${gaps.length} week(s) with incomplete FanDuel salary coverage`)
    for (const row of gaps) {
      out(
        `  ${row.season_year} ${row.season_type} week ${row.week}: ` +
          `${row.salary_games}/${row.total_games} games`
      )
    }
  }

  if (limit) targets = targets.slice(0, limit)

  if (!targets.length) {
    out('ORACLE PASS: no incomplete weeks; nothing to backfill')
    return { targets: 0, results: [] }
  }

  const results = []
  for (const target of targets) {
    results.push(
      await backfill_week({
        ...target,
        scan_radius,
        pace,
        seed_slate_ids: slate_ids,
        dry_run
      })
    )
  }

  const attempted = results.filter((row) => !row.skipped)
  const total_rows = attempted.reduce((sum, row) => sum + row.rows, 0)
  const empty_weeks = attempted.filter((row) => row.rows === 0)

  out('')
  out(
    `SUMMARY: ${attempted.length} week(s) attempted, ${total_rows} rows, ` +
      `${empty_weeks.length} empty`
  )

  if (dry_run) {
    out('ORACLE SKIPPED: dry run wrote nothing')
    return { targets: targets.length, results }
  }

  if (!total_rows) {
    throw new Error(
      `backfill produced 0 rows across ${attempted.length} targeted week(s)`
    )
  }

  // Graded per week, not in aggregate. Unlike the DraftKings backfill this does
  // NOT fail the run on an empty week: RotoWire's archive genuinely does not
  // reach every week, and a permanently-unavailable week would then make the job
  // red forever — the "chronically failing detector is an absent detector"
  // shape. Empty weeks are named loudly and the run still succeeds.
  if (empty_weeks.length) {
    out(
      `ORACLE PARTIAL: ${empty_weeks.length} of ${attempted.length} week(s) produced no rows: ` +
        empty_weeks.map((row) => row.week_label).join(', ')
    )
  } else {
    out(`ORACLE PASS: all ${attempted.length} targeted week(s) produced rows`)
  }

  return { targets: targets.length, results, total_rows }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', { type: 'number', describe: 'Season year' })
      .option('week', { type: 'number', describe: 'Week (requires --year)' })
      .option('seas_type', { type: 'string', default: 'REG' })
      .option('scan_radius', {
        type: 'number',
        default: DEFAULT_SCAN_RADIUS,
        describe: `RotoWire slate ids to probe each side of the estimate (~${ROTOWIRE_SLATES_PER_WEEK}/week)`
      })
      .option('pace', { type: 'number', default: 1 })
      .option('slate_id', {
        type: 'array',
        describe: 'Explicit RotoWire slate id(s), skipping discovery'
      })
      .option('limit', { type: 'number' })
      .option('dry', { type: 'boolean', default: false }).argv

    await backfill_fanduel_salaries({
      season_year: argv.year ?? null,
      week: argv.week ?? null,
      season_type: argv.seas_type,
      scan_radius: argv.scan_radius,
      pace: argv.pace,
      slate_ids: (argv.slate_id ?? []).map(Number),
      limit: argv.limit ?? null,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    out(`FAILED: ${err.message}`)
  }

  await report_job({
    job_type: job_types.IMPORT_FANDUEL_DFS_SALARIES,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_fanduel_salaries
