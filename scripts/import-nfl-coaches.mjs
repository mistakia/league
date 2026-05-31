import { Readable } from 'stream'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import csv from 'csv-parser'
import fs from 'fs'
import path from 'path'

import db from '#db'
import { is_main } from '#libs-server'
import { current_season } from '#constants'

const log = debug('import-nfl-coaches')
debug.enable('import-nfl-coaches')

const SOURCE_BASE =
  'https://raw.githubusercontent.com/samhoppen/NFL_public/refs/heads/main/data'

// Long franchise name -> current team abbreviation.
// yearly_coaching_history.csv uses current long names only (Las Vegas Raiders,
// Los Angeles Chargers, Los Angeles Rams, Washington Commanders) even for
// pre-relocation seasons.
const LONG_NAME_TO_ABBREV = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LA',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS'
}

const UNRESOLVED_LOG_PATH = 'tmp/import-nfl-coaches-unresolved.csv'

const fetch_csv = async (filename) => {
  const url = `${SOURCE_BASE}/${filename}`
  log(`fetching ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`fetch ${filename} failed: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

const parse_csv = (text, expected_headers) =>
  new Promise((resolve, reject) => {
    const rows = []
    let settled = false
    const stream = Readable.from(text).pipe(csv())
    const fail = (err) => {
      if (settled) return
      settled = true
      stream.destroy()
      reject(err)
    }
    const succeed = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    let saw_headers = false
    stream
      .on('headers', (headers) => {
        saw_headers = true
        const missing = expected_headers.filter((h) => !headers.includes(h))
        if (missing.length) {
          fail(
            new Error(
              `CSV header drift: missing ${JSON.stringify(missing)} (got ${JSON.stringify(headers)})`
            )
          )
        }
      })
      .on('data', (row) => rows.push(row))
      .on('error', fail)
      .on('end', () => {
        if (!saw_headers) fail(new Error('CSV had no headers'))
        else succeed(rows)
      })
  })

const build_resolution_map = (history_rows) => {
  // Key: `${name}|${current_abbrev}|${season}` -> pfr_coach_id
  // Also collect distinct (pfr_coach_id, name) for nfl_coaches upsert.
  const map = new Map()
  const coaches = new Map()
  const unknown_long_names = new Set()
  for (const row of history_rows) {
    const coach = row.coach?.trim()
    // PFR IDs in this source sometimes carry a leading path component like
    // /coaches/ or /executives/ (head coaches who also held GM roles).
    // The stable identifier is the trailing basename (e.g. BeliBi0).
    const raw_id = row.coach_id?.trim()
    const coach_id = raw_id ? raw_id.split('/').pop() : null
    const team_name = row.team_name?.trim()
    const season = row.season?.trim()
    if (!coach || !coach_id || !team_name || !season) continue
    const abbrev = LONG_NAME_TO_ABBREV[team_name]
    if (!abbrev) {
      unknown_long_names.add(team_name)
      continue
    }
    map.set(`${coach}|${abbrev}|${season}`, coach_id)
    if (!coaches.has(coach_id)) coaches.set(coach_id, coach)
  }
  if (unknown_long_names.size) {
    log(
      `WARN: ${unknown_long_names.size} unknown long_names in yearly_coaching_history.csv: ${Array.from(unknown_long_names).join(', ')}`
    )
  }
  return { map, coaches }
}

const assert_abbrev_coverage = (playcaller_rows, years) => {
  const year_set = new Set(years.map(String))
  const known_abbrevs = new Set(Object.values(LONG_NAME_TO_ABBREV))
  const unknown = new Set()
  for (const row of playcaller_rows) {
    if (!year_set.has(String(row.season))) continue
    const team = row.team?.trim()
    if (team && !known_abbrevs.has(team)) unknown.add(team)
  }
  if (unknown.size) {
    throw new Error(
      `Unknown team abbreviations in all_playcallers.csv (likely new franchise / relocation): ${Array.from(unknown).join(', ')}`
    )
  }
}

const write_unresolved = (entries) => {
  if (!entries.length) return
  fs.mkdirSync(path.dirname(UNRESOLVED_LOG_PATH), { recursive: true })
  const header = 'season,week,team,game_id,name,role,reason\n'
  const body = entries
    .map((e) =>
      [e.season, e.week, e.team, e.game_id, e.name, e.role, e.reason]
        .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
  fs.writeFileSync(UNRESOLVED_LOG_PATH, header + body + '\n')
  log(`wrote ${entries.length} unresolved rows to ${UNRESOLVED_LOG_PATH}`)
}

const resolve_coach = ({ name, team, season, role, game_id, week, resolution_map, unresolved }) => {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  const key = `${trimmed}|${team}|${season}`
  const pfr_id = resolution_map.get(key)
  if (!pfr_id) {
    unresolved.push({
      season,
      week,
      team,
      game_id,
      name: trimmed,
      role,
      reason: 'no_pfr_coach_id_for_triple'
    })
    return null
  }
  return pfr_id
}

const upsert_coaches = async (coaches) => {
  if (!coaches.size) return 0
  const rows = Array.from(coaches.entries()).map(([pfr_coach_id, full_name]) => ({
    pfr_coach_id,
    full_name,
    updated_at: db.fn.now()
  }))
  await db('nfl_coaches')
    .insert(rows)
    .onConflict('pfr_coach_id')
    .merge(['full_name', 'updated_at'])
  return rows.length
}

const process_week = async ({ year, week, rows, resolution_map, unresolved }) => {
  const bridge_rows = []
  for (const row of rows) {
    const game_id = row.game_id?.trim()
    const team = row.team?.trim()
    if (!game_id || !team) continue
    const ctx = { season: year, week, team, game_id, resolution_map, unresolved }
    bridge_rows.push({
      nflverse_game_id: game_id,
      team,
      head_coach_pfr_id: resolve_coach({
        ...ctx,
        name: row.head_coach,
        role: 'head_coach'
      }),
      off_play_caller_pfr_id: resolve_coach({
        ...ctx,
        name: row.off_play_caller,
        role: 'off_play_caller'
      }),
      def_play_caller_pfr_id: resolve_coach({
        ...ctx,
        name: row.def_play_caller,
        role: 'def_play_caller'
      }),
      ingested_at: db.fn.now()
    })
  }
  if (!bridge_rows.length) return { bridge: 0, populated: 0 }

  // One transaction per (year, week) for bridge upsert + nfl_games cache update.
  let populated = 0
  await db.transaction(async (trx) => {
    await trx('nfl_game_coaches')
      .insert(bridge_rows)
      .onConflict(['nflverse_game_id', 'team'])
      .merge([
        'head_coach_pfr_id',
        'off_play_caller_pfr_id',
        'def_play_caller_pfr_id',
        'ingested_at'
      ])

    // Update denormalized name strings on nfl_games for this batch.
    const game_ids = Array.from(new Set(bridge_rows.map((r) => r.nflverse_game_id)))
    const home_update = await trx.raw(
      `UPDATE nfl_games AS g
       SET home_play_caller = c.full_name
       FROM nfl_game_coaches gc
       JOIN nfl_coaches c ON c.pfr_coach_id = gc.off_play_caller_pfr_id
       WHERE gc.nflverse_game_id = g.nflverse_game_id
         AND gc.team = g.h
         AND g.nflverse_game_id = ANY(?)`,
      [game_ids]
    )
    const away_update = await trx.raw(
      `UPDATE nfl_games AS g
       SET away_play_caller = c.full_name
       FROM nfl_game_coaches gc
       JOIN nfl_coaches c ON c.pfr_coach_id = gc.off_play_caller_pfr_id
       WHERE gc.nflverse_game_id = g.nflverse_game_id
         AND gc.team = g.v
         AND g.nflverse_game_id = ANY(?)`,
      [game_ids]
    )
    populated = (home_update.rowCount || 0) + (away_update.rowCount || 0)
  })

  return { bridge: bridge_rows.length, populated }
}

const import_nfl_coaches = async ({ backfill = false, since = null } = {}) => {
  const playcaller_headers = [
    'season',
    'week',
    'team',
    'game_id',
    'off_play_caller',
    'def_play_caller',
    'head_coach'
  ]
  const history_headers = [
    'type',
    'coach',
    'coach_id',
    'team_name',
    'season',
    'off_scheme',
    'def_scheme'
  ]

  const [playcaller_text, history_text] = await Promise.all([
    fetch_csv('all_playcallers.csv'),
    fetch_csv('yearly_coaching_history.csv')
  ])
  const playcaller_rows = await parse_csv(playcaller_text, playcaller_headers)
  const history_rows = await parse_csv(history_text, history_headers)
  log(
    `parsed all_playcallers.csv: ${playcaller_rows.length} rows; yearly_coaching_history.csv: ${history_rows.length} rows`
  )

  // Determine year range.
  const all_years = Array.from(
    new Set(playcaller_rows.map((r) => Number(r.season)).filter((y) => !Number.isNaN(y)))
  ).sort((a, b) => a - b)

  // Stale-feed guard. The header check catches structural drift and the
  // zero-bridge guard at the end catches total failure, but a feed that
  // silently stops updating mid-life (samhoppen has done this before)
  // sails past both. If the newest season in the feed is older than last
  // year, treat it as stale.
  const max_year = all_years[all_years.length - 1]
  if (max_year != null && max_year < current_season.year - 1) {
    throw new Error(
      `samhoppen feed appears stale: max season in all_playcallers.csv is ${max_year}, expected >= ${current_season.year - 1}`
    )
  }

  let target_years
  if (backfill) {
    target_years = all_years
  } else {
    const start =
      since === 'current' || since == null
        ? current_season.year
        : Number(since)
    if (
      !Number.isInteger(start) ||
      start < 1990 ||
      start > current_season.year + 1
    ) {
      throw new Error(
        `Invalid --since value: ${since} (expected integer year between 1990 and ${current_season.year + 1}, or 'current')`
      )
    }
    target_years = all_years.filter((y) => y >= start)
  }
  if (!target_years.length) {
    throw new Error(
      `No target years selected (backfill=${backfill}, since=${since}, csv years=${all_years[0]}..${all_years[all_years.length - 1]})`
    )
  }
  log(`target years: ${target_years.join(',')}`)

  assert_abbrev_coverage(playcaller_rows, target_years)

  const { map: resolution_map, coaches } = build_resolution_map(history_rows)
  log(`resolution map: ${resolution_map.size} (name,team,season) triples; ${coaches.size} distinct coaches`)

  // Upsert nfl_coaches up front (single transaction across the whole run).
  const coaches_upserted = await upsert_coaches(coaches)

  const unresolved = []
  let total_bridge = 0
  const year_results = []

  for (const year of target_years) {
    const year_rows = playcaller_rows.filter((r) => Number(r.season) === year)
    const weeks = Array.from(
      new Set(year_rows.map((r) => r.week?.trim()).filter(Boolean))
    ).sort()
    let bridge_total = 0
    let populated_total = 0
    let games_csv = 0
    for (const week of weeks) {
      const rows = year_rows.filter((r) => r.week?.trim() === week)
      games_csv += rows.filter((r) => r.game_id?.trim()).length
      const { bridge, populated } = await process_week({
        year,
        week,
        rows,
        resolution_map,
        unresolved
      })
      bridge_total += bridge
      populated_total += populated
    }
    total_bridge += bridge_total

    const matched_row = await db('nfl_game_coaches as gc')
      .join('nfl_games as g', 'g.nflverse_game_id', 'gc.nflverse_game_id')
      .where('g.year', year)
      .countDistinct('gc.nflverse_game_id as matched')
      .first()
    const matched = Number(matched_row?.matched || 0)
    const year_unresolved = unresolved.filter((u) => Number(u.season) === year).length
    console.log(
      `[import-nfl-coaches] year=${year} games_csv=${games_csv} games_matched=${matched} populated=${populated_total} coaches=${coaches_upserted} unresolved=${year_unresolved}`
    )
    year_results.push({ year, games_csv, bridge: bridge_total, populated: populated_total, matched })
  }

  write_unresolved(unresolved)

  if (!total_bridge) {
    throw new Error(
      `Zero nfl_game_coaches rows ingested across ${target_years.length} target years`
    )
  }

  return { years: year_results, coaches: coaches_upserted, unresolved: unresolved.length }
}

const main = async () => {
  let exit_code = 0
  try {
    const argv = yargs(hideBin(process.argv))
      .option('backfill', { type: 'boolean', default: false })
      .option('since', { type: 'string' })
      .parse()
    if (argv.backfill && argv.since) {
      throw new Error('Pass either --backfill or --since, not both')
    }
    await import_nfl_coaches({ backfill: argv.backfill, since: argv.since })
  } catch (err) {
    console.log(`ERROR: ${err.message}`)
    console.error(err)
    exit_code = 1
  }
  await db.destroy()
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nfl_coaches
