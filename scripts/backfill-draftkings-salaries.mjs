import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import { is_main, report_job, draftkings, wait } from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('backfill-draftkings-salaries')
enable_debug_namespaces('backfill-draftkings-salaries,draft-kings')

// Every outcome line goes to console.log, not the debug logger: a namespace
// constructed at module scope is not reliably re-enabled from inside main(), and
// cron sets no DEBUG, so a verdict routed through `log` can vanish entirely.
// See [[user:guideline/surface-pipeline-failures.md]].
const out = (line) => console.log(line)

// The live importer reads the current lobby, so it can only ever import the
// slate that is open right now — a week missed is a week lost. This backfill
// addresses draft groups by ID instead, which DraftKings serves indefinitely
// (verified back to 2021), making every past week recoverable.
//
// Discovery is entirely DATE-based, and deliberately so. The obvious approach —
// look up `dfs_contests` by (season_year, week) and scan around that id — is
// wrong, because `dfs_contests` has no season_type column: asking it for POST
// week 1 returns REG week 1's draft group, four months adrift. That produced a
// confident 0-row result for every 2025 POST week, since the anchor was fetched
// without any date check and its 658 competitions matched nothing.
//
// So known ids are used only to BRACKET the scan range in time, and every
// candidate — seeded or scanned — has to clear the same date window before it is
// fetched. Nothing is trusted for being in a table.
const DEFAULT_SCAN_RADIUS = 200

// Pacing. These three addresses are shared with NFL Pro and ESPN, so a
// DraftKings flag earned here costs those feeds too. A backfill is bulk traffic
// against a vendor that already blocks our shared pool, which makes it exactly
// the shape worth pacing. See
// [[user:guideline/software/vendor-egress-proxy-posture.md]].
//
// Defaults suit a single recent season. A multi-season sweep is tens of
// thousands of requests and should be slowed with --pace, which multiplies both
// delays — the cost of going slow is wall-clock only, and the cost of going fast
// is three feeds' worth of egress.
const REQUEST_DELAY_MS = 350
const SCAN_DELAY_MS = 150

// Jitter the pace so the request train does not arrive on a fixed metronome,
// which is itself a cheap automation signal.
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
    // A slate opens before its first game and DraftKings stamps the group with
    // the first kickoff, so widen by a day on each side rather than trying to
    // reproduce their boundary exactly. Precision is not needed here: the
    // competition-to-game match downstream is what actually decides a row.
    start: dayjs(dates[0]).subtract(1, 'day'),
    end: dayjs(dates[dates.length - 1]).add(1, 'day')
  }
}

// Every draft group id we already know about, paired with the date of the games
// it actually covered. Read from player_salaries rather than dfs_contests
// because the join to nfl_games gives a real date, which is the only thing that
// can bracket a week correctly across REG and POST.
const load_known_draft_groups = async () => {
  const rows = await db('player_salaries')
    .join('nfl_games', 'nfl_games.esbid', 'player_salaries.esbid')
    .distinct('player_salaries.source_contest_id')
    .min('nfl_games.date as first_date')
    .where('player_salaries.source_id', 'DRAFTKINGS')
    .groupBy('player_salaries.source_contest_id')

  return rows
    .map((row) => ({
      id: Number(row.source_contest_id),
      date: dayjs(row.first_date)
    }))
    .filter((row) => Number.isFinite(row.id) && row.date.isValid())
    .sort((a, b) => a.id - b.id)
}

// Bracket the scan by TIME. Draft group ids increase monotonically with date,
// so the target week's slates sit between the newest known group that precedes
// it and the oldest that follows it.
//
// When that interval is too wide to scan, clamp toward whichever bracket is
// NEARER IN TIME rather than giving up. The interval is wide precisely when one
// neighbour is far away, and the near one is then a good estimate: 2025 POST
// week 1 brackets as 139672..151327 (11,655 ids) because nothing between the
// January playoffs and the following September was ever imported — but its lower
// bracket is REG week 18, five days earlier, so the playoff slates sit just
// above it.
const resolve_scan_range = ({ known, window, max_span }) => {
  const before = known.filter((row) => row.date.isBefore(window.start))
  const after = known.filter((row) => row.date.isAfter(window.end))

  const lower = before.length ? before[before.length - 1] : null
  const upper = after.length ? after[0] : null

  if (!lower && !upper) return null

  const PAD = 20

  if (lower && upper) {
    const span = upper.id - lower.id
    if (span <= max_span) {
      return { lo: lower.id - PAD, hi: upper.id + PAD, basis: 'bracketed' }
    }
    // Too wide. Measure each neighbour's distance to the target in DAYS, not in
    // ids, and scan outward from the closer one.
    const days_below = window.start.diff(lower.date, 'day')
    const days_above = upper.date.diff(window.end, 'day')
    return days_below <= days_above
      ? {
          lo: lower.id - PAD,
          hi: lower.id + max_span,
          basis: `clamped above lower bracket (+${days_below}d)`
        }
      : {
          lo: upper.id - max_span,
          hi: upper.id + PAD,
          basis: `clamped below upper bracket (-${days_above}d)`
        }
  }

  return lower
    ? {
        lo: lower.id - PAD,
        hi: lower.id + max_span,
        basis: 'lower bracket only'
      }
    : {
        lo: upper.id - max_span,
        hi: upper.id + PAD,
        basis: 'upper bracket only'
      }
}

const discover_draft_group_ids = async ({
  season_year,
  season_type,
  week,
  games,
  known,
  scan_radius,
  pace
}) => {
  const window = parse_week_window(games)
  if (!window) {
    out(`  discovery: no scheduled games for this week; skipping`)
    return []
  }

  const range = resolve_scan_range({
    known,
    window,
    max_span: scan_radius * 10
  })
  if (!range) {
    out(
      `  discovery: no known draft group brackets ${season_year} ${season_type} week ${week}; ` +
        'seed one with --draft_group_id'
    )
    return []
  }

  out(
    `  discovery: scanning ${range.lo}-${range.hi} (${range.basis}) ` +
      `for NFL classic slates in ${window.start.format('YYYY-MM-DD')}..${window.end.format('YYYY-MM-DD')}`
  )

  const found = []
  let scanned = 0
  let scan_errors = 0

  for (let id = range.lo; id <= range.hi; id++) {
    let metadata
    let probe_failed = false
    try {
      metadata = await draftkings.get_draftkings_draft_group_metadata({
        draft_group_id: id
      })
    } catch (err) {
      // A scan is best-effort by nature, but a scan that errors on most of its
      // range is a blocked scan wearing a clean-result costume. Counted here
      // and asserted on below.
      scan_errors++
      probe_failed = true
    } finally {
      scanned++
      await paced_wait(SCAN_DELAY_MS, pace)
    }
    if (probe_failed) continue

    if (!draftkings.is_nfl_salary_slate(metadata)) continue

    const start = dayjs(metadata.minStartTime)
    if (start.isBefore(window.start) || start.isAfter(window.end)) continue

    found.push(id)
  }

  const scan_error_rate = scanned ? scan_errors / scanned : 0
  if (scan_error_rate > 0.2) {
    throw new Error(
      `draft group scan failed ${scan_errors}/${scanned} probes ` +
        `(${(scan_error_rate * 100).toFixed(0)}%) — treating as a blocked scan, not an empty range`
    )
  }

  out(
    `  discovery: scanned ${scanned} ids, ${scan_errors} errors, ` +
      `${found.length} slate(s) in window`
  )

  return found
}

const build_salary_rows = async ({ draft_group_id, games }) => {
  const data = await draftkings.get_draftkings_draft_group_draftables({
    draft_group_id
  })

  const draftables = data?.draftables ?? []
  const rows = []
  const seen_draftkings_ids = new Set()
  let unmatched_players = 0
  let unmatched_games = 0

  for (const draftable of draftables) {
    let player_row
    try {
      player_row = find_player({
        draftkings_player_id: draftable.playerDkId,
        ignore_free_agent: false,
        ignore_retired: false
      })
    } catch (err) {
      log(err)
    }

    if (!player_row) {
      try {
        player_row = find_player({
          name: `${draftable.firstName} ${draftable.lastName}`,
          teams: draftable.teamAbbreviation ? [draftable.teamAbbreviation] : [],
          ignore_free_agent: false,
          ignore_retired: false
        })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      unmatched_players++
      continue
    }

    if (seen_draftkings_ids.has(draftable.playerDkId)) continue
    seen_draftkings_ids.add(draftable.playerDkId)

    // Deliberately NOT writing draftkings_player_id back onto the player row.
    // This is a historical replay: the id mapping it would assert is one the
    // live importer owns from current data, and a backfill reaching years into
    // the past is the worst possible authority for it.

    const competition = draftable.competition
    if (!competition?.name || !competition?.startTime) {
      unmatched_games++
      continue
    }

    const [away_team, home_team] = competition.name.split(' @ ')
    const game_date = dayjs(competition.startTime).format('YYYY/MM/DD')
    const game = games.find(
      (candidate) =>
        candidate.away_nfl_team === fixTeam(away_team) &&
        candidate.home_nfl_team === fixTeam(home_team) &&
        candidate.date === game_date
    )

    if (!game) {
      unmatched_games++
      continue
    }

    rows.push({
      pid: player_row.pid,
      esbid: game.esbid,
      source_competition_name: competition.name,
      source_player_display_name: `${draftable.firstName} ${draftable.lastName}`,
      source_contest_id: String(draft_group_id),
      salary: draftable.salary,
      source_id: 'DRAFTKINGS'
    })
  }

  return {
    rows,
    draftables: draftables.length,
    unmatched_players,
    unmatched_games
  }
}

const backfill_week = async ({
  season_year,
  season_type,
  week,
  known,
  scan_radius,
  pace,
  seed_draft_group_ids,
  dry_run
}) => {
  const games = await db('nfl_games').where({ season_year, season_type, week })

  out(
    `${season_year} ${season_type} week ${week}: ${games.length} scheduled games`
  )

  if (!games.length) {
    return {
      week_label: `${season_year}-${season_type}-${week}`,
      skipped: true
    }
  }

  const discovered = seed_draft_group_ids.length
    ? seed_draft_group_ids
    : await discover_draft_group_ids({
        season_year,
        season_type,
        week,
        games,
        known,
        scan_radius,
        pace
      })

  if (!discovered.length) {
    return {
      week_label: `${season_year}-${season_type}-${week}`,
      total_games: games.length,
      draft_groups: 0,
      rows: 0,
      covered_games: 0,
      coverage: 0
    }
  }

  const all_rows = []
  let total_draftables = 0
  let total_unmatched_players = 0
  let total_unmatched_games = 0

  for (const draft_group_id of discovered) {
    const result = await build_salary_rows({ draft_group_id, games })
    total_draftables += result.draftables
    total_unmatched_players += result.unmatched_players
    total_unmatched_games += result.unmatched_games
    all_rows.push(...result.rows)
    out(
      `  draft group ${draft_group_id}: ${result.draftables} draftables -> ` +
        `${result.rows.length} rows (${result.unmatched_players} unmatched players, ` +
        `${result.unmatched_games} unmatched games)`
    )
    await paced_wait(REQUEST_DELAY_MS, pace)
  }

  // Dedupe on the insert conflict key. Two slates covering the same game can
  // carry the same player at different salaries; both are legitimate rows
  // because source_contest_id differs, but the SAME slate must not appear twice.
  const deduped = new Map()
  for (const row of all_rows) {
    deduped.set(`${row.pid}|${row.esbid}|${row.source_contest_id}`, row)
  }
  const rows = [...deduped.values()]

  const covered_games = new Set(rows.map((row) => row.esbid)).size
  const coverage = games.length ? covered_games / games.length : 0

  if (!dry_run && rows.length) {
    await db('player_salaries')
      .insert(rows)
      .onConflict(['pid', 'esbid', 'source_contest_id'])
      .merge()
  }

  const player_match_rate = total_draftables
    ? (total_draftables - total_unmatched_players) / total_draftables
    : 0

  out(
    `  => ${rows.length} rows across ${discovered.length} slate(s), ` +
      `${covered_games}/${games.length} games covered (${(coverage * 100).toFixed(0)}%), ` +
      `player match ${(player_match_rate * 100).toFixed(1)}%` +
      (dry_run ? ' [DRY RUN, nothing written]' : '')
  )

  return {
    week_label: `${season_year}-${season_type}-${week}`,
    total_games: games.length,
    draft_groups: discovered.length,
    rows: rows.length,
    covered_games,
    coverage,
    player_match_rate,
    unmatched_games: total_unmatched_games
  }
}

// Which weeks actually need work, read from the database rather than passed in.
// A backfill whose target list is hand-maintained goes stale the moment a week
// is filled or a new one is missed.
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
    .where('player_salaries.source_id', 'DRAFTKINGS')
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

const backfill_draftkings_salaries = async ({
  season_year = null,
  week = null,
  season_type = 'REG',
  scan_radius = DEFAULT_SCAN_RADIUS,
  pace = 1,
  draft_group_ids = [],
  dry_run = false,
  limit = null
} = {}) => {
  await preload_active_players({
    all_players: true,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  // Loaded once. Note this is a snapshot taken BEFORE any week is written, so a
  // week filled earlier in this run does not become a bracket for a later one —
  // which is what we want, since a run processes weeks in chronological order
  // and a freshly written week would only narrow the bracket to itself.
  const known = await load_known_draft_groups()
  out(`${known.length} known draft group(s) available to bracket scans`)

  let targets
  if (week !== null) {
    if (!season_year) {
      throw new Error('--week requires --year')
    }
    targets = [{ season_year, season_type, week }]
  } else {
    const gaps = await find_gap_weeks({ season_year })
    targets = gaps.map((row) => ({
      season_year: row.season_year,
      season_type: row.season_type,
      week: row.week
    }))
    out(`${gaps.length} week(s) with incomplete DraftKings salary coverage`)
    for (const row of gaps) {
      out(
        `  ${row.season_year} ${row.season_type} week ${row.week}: ` +
          `${row.salary_games}/${row.total_games} games`
      )
    }
  }

  if (limit) targets = targets.slice(0, limit)

  // "Nothing to do" and "did nothing" must not share an outcome. A run with no
  // gap weeks is a healthy no-op and says so; a run that HAD targets and wrote
  // nothing fails the oracle below.
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
        known,
        pace,
        seed_draft_group_ids: draft_group_ids,
        dry_run
      })
    )
  }

  const attempted = results.filter((row) => !row.skipped)
  const total_rows = attempted.reduce((sum, row) => sum + row.rows, 0)

  // Oracle, graded PER WEEK. A season-wide or run-wide rate is structurally
  // blind to a single dead week — the exact defect that let 2021 REG week 15 sit
  // at 42.5% enrichment for years behind a passing season-level check.
  // See [[user:guideline/surface-pipeline-failures.md]].
  const empty_weeks = attempted.filter((row) => row.rows === 0)
  const thin_weeks = attempted.filter(
    (row) => row.rows > 0 && row.coverage < 0.5
  )

  out('')
  out(
    `SUMMARY: ${attempted.length} week(s) attempted, ${total_rows} rows, ` +
      `${empty_weeks.length} empty, ${thin_weeks.length} under 50% game coverage`
  )

  if (dry_run) {
    out('ORACLE SKIPPED: dry run wrote nothing')
    return { targets: targets.length, results }
  }

  if (!total_rows) {
    throw new Error(
      `backfill produced 0 rows across ${attempted.length} targeted week(s) — ` +
        'every week was already reachable when selected, so this is a failure, not a no-op'
    )
  }

  // A per-week floor rather than a global rate: a run that fills nine weeks and
  // silently misses one should not read as a pass.
  if (empty_weeks.length) {
    out(
      `ORACLE FAIL: ${empty_weeks.length} week(s) produced no rows: ` +
        empty_weeks.map((row) => row.week_label).join(', ')
    )
    throw new Error(
      `${empty_weeks.length} of ${attempted.length} targeted weeks produced no salary rows`
    )
  }

  out(
    `ORACLE PASS: every targeted week produced rows; ` +
      `${thin_weeks.length ? `thin weeks (under 50% games): ${thin_weeks.map((r) => r.week_label).join(', ')}` : 'all weeks above 50% game coverage'}`
  )

  return { targets: targets.length, results, total_rows }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', { type: 'number', describe: 'Season year' })
      .option('week', { type: 'number', describe: 'Week (requires --year)' })
      .option('seas_type', {
        type: 'string',
        default: 'REG',
        describe: 'Season type: REG or POST'
      })
      .option('scan_radius', {
        type: 'number',
        default: DEFAULT_SCAN_RADIUS,
        describe:
          'Draft group ids to scan on each side of an anchor (0 disables)'
      })
      .option('draft_group_id', {
        type: 'array',
        describe: 'Explicit draft group id(s), skipping discovery'
      })
      .option('pace', {
        type: 'number',
        default: 1,
        describe:
          'Multiply every inter-request delay (use 4-8 for a multi-season sweep)'
      })
      .option('limit', { type: 'number', describe: 'Max weeks to process' })
      .option('dry', {
        type: 'boolean',
        default: false,
        describe: 'Dry run'
      }).argv

    await backfill_draftkings_salaries({
      season_year: argv.year ?? null,
      week: argv.week ?? null,
      season_type: argv.seas_type,
      scan_radius: argv.scan_radius,
      pace: argv.pace,
      draft_group_ids: (argv.draft_group_id ?? []).map(Number),
      limit: argv.limit ?? null,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    out(`FAILED: ${err.message}`)
  }

  await report_job({
    job_type: job_types.IMPORT_DRAFTKINGS_DFS_SALARIES,
    error
  })

  // Rethrow through the exit code. Reporting an error to the `jobs` table and
  // then exiting 0 makes the run read as a success to job-wrapper and the runs
  // ledger, which is how 43 failed salary imports never opened a signal.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_draftkings_salaries
