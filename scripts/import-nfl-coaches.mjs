import { Readable } from 'stream'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import csv from 'csv-parser'
import fs from 'fs'
import path from 'path'

import db from '#db'
import { is_main } from '#libs-server'
import { current_season, is_offseason } from '#constants'

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
const PFR_FIXTURE_PATH = 'static-data/pfr-coaches.json'

// PFR coaches whose PFR page lacks a parseable DOB but who are bridge-
// referenced or appear in samhoppen YCH (including under /executives/);
// kept with sentinel '0000-00-00' so the importer can resolve them. Mirrors
// SENTINEL_KEEP in scripts/build-nfl-coaches-additive-fixture-values.mjs.
// Storage convention: coach_id text carries '0000-00-00', dob column stores
// '1900-01-01' (PostgreSQL date type rejects 0000-00-00).
const SENTINEL_PFR_COACHES = {
  DoylDe0: 'Declan Doyle',
  KubiKl1: 'Klay Kubiak',
  LaFlMi0: 'Mike LaFleur',
  PiolSc0: 'Scott Pioli',
  SmitGi0: 'Giff Smith',
  UdinGr0: 'Grant Udinski'
}

// Seeds for the 8 PFR-unindexed interim coordinators that close the 47 NULL
// bridge cells. DOBs sourced from public bios; sentinel '0000-00-00' used
// where DOB is not publicly findable. Pre-seeded into the dim upsert AND
// the resolution map so re-ingesting samhoppen does not re-NULL the
// (team, season, role) slots the Phase 1 adhoc backfilled.
const INTERIM_COORDINATOR_SEEDS = [
  {
    coach_id: 'WILL-BLAK-1984-12-30',
    full_name: 'Blake Williams',
    dob: '1984-12-30',
    team: 'LA',
    season: 2012,
    role: 'def_play_caller'
  },
  {
    coach_id: 'JOHN-MIKE-1967-05-02',
    full_name: 'Mike Johnson',
    dob: '1967-05-02',
    team: 'SF',
    season: 2010,
    role: 'off_play_caller'
  },
  {
    coach_id: 'FRAZ-PARK-1991-11-20',
    full_name: 'Parks Frazier',
    dob: '1991-11-20',
    team: 'IND',
    season: 2022,
    role: 'off_play_caller'
  },
  {
    coach_id: 'MURP-MIKE-1944-09-25',
    full_name: 'Mike Murphy',
    dob: '1944-09-25',
    team: 'IND',
    season: 2011,
    role: 'def_play_caller'
  },
  {
    coach_id: 'MILA-SCOT-1973-01-25',
    full_name: 'Scott Milanovich',
    dob: '1973-01-25',
    team: 'JAX',
    season: 2018,
    role: 'off_play_caller'
  },
  {
    coach_id: 'WHIP-SPEN-1989-03-18',
    full_name: 'Spencer Whipple',
    dob: '1989-03-18',
    team: 'ARI',
    season: 2021,
    role: 'off_play_caller'
  },
  {
    // Evan Rothstein DOB not publicly findable as of 2026-05-31. Sentinel-DOB
    // collision discriminator suffix not needed (no other ROTH-EVAN sentinel).
    // Per samhoppen all_playcallers, Rothstein was DET 2020 week 16 DC
    // (not OC -- the initial plan draft had Rothstein and Ryan swapped).
    coach_id: 'ROTH-EVAN-0000-00-00',
    full_name: 'Evan Rothstein',
    dob: '0000-00-00',
    team: 'DET',
    season: 2020,
    role: 'def_play_caller'
  },
  {
    // Per samhoppen all_playcallers, Sean Ryan was DET 2020 week 17 OC.
    // (Public bios list him as QB coach; samhoppen is the authoritative
    // source for the importer's role attribution.)
    coach_id: 'RYAN-SEAN-1972-05-01',
    full_name: 'Sean Ryan',
    dob: '1972-05-01',
    team: 'DET',
    season: 2020,
    role: 'off_play_caller'
  }
]

// Derive the deterministic own-id from canonical name + DOB.
// Format: LNAM-FNAM-YYYY-MM-DD (last 4 / first 4 / ISO date).
// Sentinel-DOB ('0000-00-00') rows can carry an optional -NN discriminator
// when multiple coaches share LNAM-FNAM with unknown DOB; that path is
// handled at seed-authoring time, not derived here.
const derive_coach_id = (full_name, dob) => {
  if (!full_name || !dob) return null
  const parts = full_name.trim().split(/\s+/)
  if (parts.length < 2) return null
  const first = parts[0]
  let last = parts[parts.length - 1]
  last = last.replace(/(Jr|Sr|II|III|IV)\.?$/i, '').trim()
  if (!last) {
    // Suffix was the entire last token; fall back to the second-to-last.
    if (parts.length < 3) return null
    last = parts[parts.length - 2]
  }
  // Strip non-alpha (apostrophe, hyphen, etc.) before slicing so the LNAM/FNAM
  // segments satisfy the CHECK regex [A-Z]{1,4}. E.g. "O'Leary" -> "OLEA",
  // not "O'LE" (the latter would fail the constraint and abort the txn).
  const lnam = last.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)
  const fnam = first.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)
  if (!lnam || !fnam) return null
  // Accept either an ISO 'YYYY-MM-DD' string or a Date.
  const dob_text =
    typeof dob === 'string' ? dob : dob.toISOString().slice(0, 10)
  return `${lnam}-${fnam}-${dob_text}`
}

const load_pfr_fixture = () => {
  if (!fs.existsSync(PFR_FIXTURE_PATH)) {
    throw new Error(
      `PFR fixture missing at ${PFR_FIXTURE_PATH} -- run scripts/scrape-pfr-coaches.mjs and commit static-data/pfr-coaches.json before running this importer`
    )
  }
  const rows = JSON.parse(fs.readFileSync(PFR_FIXTURE_PATH, 'utf-8'))
  const pfr_to_coach_id = new Map()
  const dim_rows = []
  for (const r of rows) {
    if (!r.pfr_coach_id) continue
    if (r.dob && r.full_name) {
      const coach_id = derive_coach_id(r.full_name, r.dob)
      if (!coach_id) continue
      pfr_to_coach_id.set(r.pfr_coach_id, coach_id)
      dim_rows.push({
        coach_id,
        pfr_coach_id: r.pfr_coach_id,
        full_name: r.full_name,
        dob: r.dob
      })
      continue
    }
    // Null-DOB row: keep if in the sentinel disposition map.
    const sentinel_name = SENTINEL_PFR_COACHES[r.pfr_coach_id]
    if (!sentinel_name) continue
    const coach_id = derive_coach_id(sentinel_name, '0000-00-00')
    if (!coach_id) continue
    pfr_to_coach_id.set(r.pfr_coach_id, coach_id)
    dim_rows.push({
      coach_id,
      pfr_coach_id: r.pfr_coach_id,
      full_name: sentinel_name,
      dob: '0000-00-00'
    })
  }
  return { pfr_to_coach_id, dim_rows }
}

const fetch_csv = async (filename) => {
  const url = `${SOURCE_BASE}/${filename}`
  log(`fetching ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `fetch ${filename} failed: ${response.status} ${response.statusText}`
    )
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

// Explicit alias map for known spellings where all_playcallers.csv
// diverges from yearly_coaching_history.csv (and PFR). Keep small and
// only add entries after confirming the same person from both sides.
const NAME_ALIASES = {
  'Billy Davis': 'Bill Davis',
  'Mike Shannahan': 'Mike Shanahan',
  'Don Beraux': 'Don Breaux',
  'Johnnie Lynn': 'Johnny Lynn',
  // "Jim L. Mora" is Jim Mora Jr (middle name Lee). DOB-keyed identity
  // does the disambiguation now (MoraJi0 1935-05-24 vs MoraJi1 1961-11-19),
  // but the alias remains useful for samhoppen-string normalization so the
  // canonical-name lookup hits.
  'Jim L. Mora': 'Jim Mora'
}

const canonicalize_name = (s) => {
  if (!s) return ''
  let n = s.trim()
  if (NAME_ALIASES[n]) n = NAME_ALIASES[n]
  // Strip honorific suffixes like "Jr.", "Sr.", "II", "III", "IV"
  // (samhoppen all_playcallers writes "Joe Whitt Jr." while
  // yearly_coaching_history writes "Joe Whitt" for the same coach).
  n = n.replace(/[\s,]+(Jr|Sr|II|III|IV)\.?$/i, '')
  return n.replace(/\s+/g, ' ').trim()
}

const build_resolution_map = (history_rows, pfr_to_coach_id) => {
  // Primary key: `${canonical_name}|${current_abbrev}|${season}` -> coach_id.
  // Fallback indexes handle two upstream-quirk failure modes:
  //   - team mis-attribution (Olson 2014 LVR vs actual JAX): (name, season).
  //   - team + season mis-attribution: name alone when unambiguous.
  const team_season_map = new Map()
  const name_season_map = new Map()
  const name_map = new Map()
  const unknown_long_names = new Set()
  const missing_pfr_to_coach_id = new Set()

  // Pre-seed the (team, season, role) -> coach_id index for the 8 interim
  // coordinators. Looked up in process_week when samhoppen resolves to NULL.
  const seed_index = new Map()
  for (const s of INTERIM_COORDINATOR_SEEDS) {
    seed_index.set(`${s.team}|${s.season}|${s.role}`, s.coach_id)
  }

  for (const row of history_rows) {
    const raw_coach = row.coach?.trim()
    const raw_id = row.coach_id?.trim()
    // PFR IDs in this source sometimes carry a leading path component like
    // /coaches/ or /executives/ (head coaches who also held GM roles).
    // The stable identifier is the trailing basename (e.g. BeliBi0).
    const pfr_coach_id = raw_id ? raw_id.split('/').pop() : null
    const team_name = row.team_name?.trim()
    const season = row.season?.trim()
    if (!raw_coach || !pfr_coach_id || !team_name || !season) continue
    const coach_id = pfr_to_coach_id.get(pfr_coach_id)
    if (!coach_id) {
      missing_pfr_to_coach_id.add(pfr_coach_id)
      continue
    }
    const coach = canonicalize_name(raw_coach)
    const abbrev = LONG_NAME_TO_ABBREV[team_name]
    if (!abbrev) {
      unknown_long_names.add(team_name)
      continue
    }
    team_season_map.set(`${coach}|${abbrev}|${season}`, coach_id)
    const ns_key = `${coach}|${season}`
    if (!name_season_map.has(ns_key)) name_season_map.set(ns_key, new Set())
    name_season_map.get(ns_key).add(coach_id)
    if (!name_map.has(coach)) name_map.set(coach, new Set())
    name_map.get(coach).add(coach_id)
  }
  if (unknown_long_names.size) {
    log(
      `WARN: ${unknown_long_names.size} unknown long_names in yearly_coaching_history.csv: ${Array.from(unknown_long_names).join(', ')}`
    )
  }
  if (missing_pfr_to_coach_id.size) {
    throw new Error(
      `pipeline_failure: ${missing_pfr_to_coach_id.size} pfr_coach_ids in samhoppen's yearly_coaching_history.csv are not in static-data/pfr-coaches.json -- re-run scripts/scrape-pfr-coaches.mjs --ids ${Array.from(missing_pfr_to_coach_id).join(',')} and recommit the fixture`
    )
  }
  return { team_season_map, name_season_map, name_map, seed_index }
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

const resolve_coach = ({
  name,
  team,
  season,
  role,
  game_id,
  week,
  resolution,
  unresolved,
  fallback_stats
}) => {
  if (!name || !name.trim()) {
    // Samhoppen left this (team, season, role) cell blank. If a seed covers
    // this slot, use it -- prevents the 47 backfilled cells from re-NULLing
    // when the cron re-ingests the same upstream rows.
    const seed_id = resolution.seed_index.get(`${team}|${season}|${role}`)
    if (seed_id) {
      fallback_stats.seed++
      return seed_id
    }
    return null
  }
  const trimmed = name.trim()
  const canonical = canonicalize_name(trimmed)
  const primary = resolution.team_season_map.get(
    `${canonical}|${team}|${season}`
  )
  if (primary) return primary
  const ns_set = resolution.name_season_map.get(`${canonical}|${season}`)
  if (ns_set && ns_set.size === 1) {
    fallback_stats.name_season++
    return [...ns_set][0]
  }
  const name_set = resolution.name_map.get(canonical)
  if (name_set && name_set.size === 1) {
    fallback_stats.name_only++
    return [...name_set][0]
  }
  unresolved.push({
    season,
    week,
    team,
    game_id,
    name: trimmed,
    role,
    reason:
      ns_set && ns_set.size > 1
        ? 'name_season_ambiguous'
        : name_set && name_set.size > 1
          ? 'name_only_ambiguous'
          : 'no_coach_id_for_name'
  })
  return null
}

const upsert_coaches_dim = async ({ dim_rows, dry_run }) => {
  // Idempotent upsert of the PFR-sourced dim rows plus the 8 interim seed
  // rows. Phase 1 SQL already loaded these from static-data/pfr-coaches.json
  // into nfl_coaches, but the importer re-asserts on each run so that a
  // newly scraped pfr_coach_id (added to the fixture and re-committed) is
  // picked up without an out-of-band SQL apply.
  const rows = dim_rows.map((r) => ({
    coach_id: r.coach_id,
    pfr_coach_id: r.pfr_coach_id,
    full_name: r.full_name,
    // Sentinel '0000-00-00' is not a valid PostgreSQL date; store
    // 1900-01-01 for sentinel rows (the coach_id text carries the
    // '0000-00-00' marker for sentinel-aware consumers).
    dob: r.dob === '0000-00-00' ? '1900-01-01' : r.dob,
    updated_at: db.fn.now()
  }))
  for (const s of INTERIM_COORDINATOR_SEEDS) {
    rows.push({
      coach_id: s.coach_id,
      pfr_coach_id: null,
      full_name: s.full_name,
      // Sentinel '0000-00-00' is not a valid PostgreSQL date; store
      // 1900-01-01 as the storage sentinel (the coach_id text carries
      // the '0000-00-00' marker for sentinel-aware consumers).
      dob: s.dob === '0000-00-00' ? '1900-01-01' : s.dob,
      updated_at: db.fn.now()
    })
  }
  if (dry_run) {
    log(`[dry-run] would upsert ${rows.length} nfl_coaches dim rows`)
    return rows.length
  }
  await db('nfl_coaches')
    .insert(rows)
    .onConflict('coach_id')
    .merge(['pfr_coach_id', 'full_name', 'dob', 'updated_at'])
  return rows.length
}

const process_week = async ({
  year,
  week,
  rows,
  resolution,
  unresolved,
  fallback_stats,
  dry_run
}) => {
  const bridge_rows = []
  for (const row of rows) {
    const game_id = row.game_id?.trim()
    const team = row.team?.trim()
    if (!game_id || !team) continue
    const ctx = {
      season: year,
      week,
      team,
      game_id,
      resolution,
      unresolved,
      fallback_stats
    }
    bridge_rows.push({
      nflverse_game_id: game_id,
      team,
      head_coach_id: resolve_coach({
        ...ctx,
        name: row.head_coach,
        role: 'head_coach'
      }),
      off_play_caller_id: resolve_coach({
        ...ctx,
        name: row.off_play_caller,
        role: 'off_play_caller'
      }),
      def_play_caller_id: resolve_coach({
        ...ctx,
        name: row.def_play_caller,
        role: 'def_play_caller'
      }),
      ingested_at: db.fn.now()
    })
  }
  if (!bridge_rows.length) return { bridge: 0, populated: 0 }

  if (dry_run) {
    log(
      `[dry-run] year=${year} week=${week} would upsert ${bridge_rows.length} bridge rows`
    )
    return { bridge: bridge_rows.length, populated: 0 }
  }

  let populated = 0
  await db.transaction(async (trx) => {
    await trx('nfl_game_coaches')
      .insert(bridge_rows)
      .onConflict(['nflverse_game_id', 'team'])
      .merge([
        'head_coach_id',
        'off_play_caller_id',
        'def_play_caller_id',
        'ingested_at'
      ])

    // Denormalize the offensive play-caller name into nfl_games for this
    // batch. Joins via the new *_coach_id FK.
    const game_ids = Array.from(
      new Set(bridge_rows.map((r) => r.nflverse_game_id))
    )
    const home_update = await trx.raw(
      `UPDATE nfl_games AS g
       SET home_play_caller = c.full_name
       FROM nfl_game_coaches gc
       JOIN nfl_coaches c ON c.coach_id = gc.off_play_caller_id
       WHERE gc.nflverse_game_id = g.nflverse_game_id
         AND gc.team = g.h
         AND g.nflverse_game_id = ANY(?)`,
      [game_ids]
    )
    const away_update = await trx.raw(
      `UPDATE nfl_games AS g
       SET away_play_caller = c.full_name
       FROM nfl_game_coaches gc
       JOIN nfl_coaches c ON c.coach_id = gc.off_play_caller_id
       WHERE gc.nflverse_game_id = g.nflverse_game_id
         AND gc.team = g.v
         AND g.nflverse_game_id = ANY(?)`,
      [game_ids]
    )
    populated = (home_update.rowCount || 0) + (away_update.rowCount || 0)
  })

  return { bridge: bridge_rows.length, populated }
}

const import_nfl_coaches = async ({
  backfill = false,
  since = null,
  dry_run = false
} = {}) => {
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

  // Offseason short-circuit. samhoppen's all_playcallers.csv carries no rows
  // for the current season until games are actually played, so a weekly
  // `--since current` run in the offseason legitimately resolves zero bridge
  // rows and would trip the "Zero nfl_game_coaches rows ingested" guard below
  // (signal #113494). The scheduled-command is intentionally year-round and
  // expected to no-op out of season; make that explicit here. Mirrors the ESPN
  // seasonal-import guard (commit 79bf137e) and the league 89bea137 is_offseason
  // short-circuit. An explicit --backfill or --since <year> still runs
  // year-round so manual backfills are never gated.
  if (!backfill && (since == null || since === 'current') && is_offseason) {
    log('Skipping -- NFL offseason; no current-season playcaller data to ingest')
    return {
      skipped: true,
      years: [],
      coaches: 0,
      unresolved: 0,
      fallback: { name_season: 0, name_only: 0, seed: 0 }
    }
  }

  const { pfr_to_coach_id, dim_rows } = load_pfr_fixture()
  log(`loaded PFR fixture: ${dim_rows.length} indexed coaches`)

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
    new Set(
      playcaller_rows
        .map((r) => Number(r.season))
        .filter((y) => !Number.isNaN(y))
    )
  ).sort((a, b) => a - b)

  // Stale-feed guard.
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
      since === 'current' || since == null ? current_season.year : Number(since)
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
  log(`target years: ${target_years.join(',')}${dry_run ? ' [dry-run]' : ''}`)

  assert_abbrev_coverage(playcaller_rows, target_years)

  const resolution = build_resolution_map(history_rows, pfr_to_coach_id)
  log(
    `resolution map: ${resolution.team_season_map.size} (name,team,season) triples; ${resolution.name_map.size} canonical names; ${resolution.seed_index.size} (team,season,role) seeds`
  )

  const coaches_upserted = await upsert_coaches_dim({ dim_rows, dry_run })
  const fallback_stats = { name_season: 0, name_only: 0, seed: 0 }

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
        resolution,
        unresolved,
        fallback_stats,
        dry_run
      })
      bridge_total += bridge
      populated_total += populated
    }
    total_bridge += bridge_total

    let matched = 0
    if (!dry_run) {
      const matched_row = await db('nfl_game_coaches as gc')
        .join('nfl_games as g', 'g.nflverse_game_id', 'gc.nflverse_game_id')
        .where('g.year', year)
        .countDistinct('gc.nflverse_game_id as matched')
        .first()
      matched = Number(matched_row?.matched || 0)
    }
    const year_unresolved = unresolved.filter(
      (u) => Number(u.season) === year
    ).length
    const unresolved_rate = bridge_total ? year_unresolved / bridge_total : 0
    console.log(
      `[import-nfl-coaches] year=${year} games_csv=${games_csv} games_matched=${matched} populated=${populated_total} coaches=${coaches_upserted} unresolved=${year_unresolved} unresolved_rate=${unresolved_rate.toFixed(3)}${dry_run ? ' [dry-run]' : ''}`
    )
    year_results.push({
      year,
      games_csv,
      bridge: bridge_total,
      populated: populated_total,
      matched,
      unresolved: year_unresolved,
      unresolved_rate
    })
  }

  write_unresolved(unresolved)
  log(
    `fallback resolutions: name_season=${fallback_stats.name_season} name_only=${fallback_stats.name_only} seed=${fallback_stats.seed}`
  )

  if (!total_bridge) {
    throw new Error(
      `Zero nfl_game_coaches rows ingested across ${target_years.length} target years`
    )
  }

  // Current-year regression detector. Floor on resolution quality for
  // the season the weekly `--since current` run is actually populating.
  const current_year_result = year_results.find(
    (r) => r.year === current_season.year
  )
  if (
    current_year_result &&
    current_year_result.bridge > 0 &&
    current_year_result.unresolved_rate > 0.1
  ) {
    throw new Error(
      `pipeline_failure: current-year (${current_season.year}) unresolved_rate=${current_year_result.unresolved_rate.toFixed(3)} exceeds 0.10 threshold (${current_year_result.unresolved} unresolved cells / ${current_year_result.bridge} bridge rows)`
    )
  }

  return {
    years: year_results,
    coaches: coaches_upserted,
    unresolved: unresolved.length,
    fallback: fallback_stats
  }
}

const main = async () => {
  let exit_code = 0
  try {
    const argv = yargs(hideBin(process.argv))
      .option('backfill', { type: 'boolean', default: false })
      .option('since', { type: 'string' })
      .option('dry-run', { type: 'boolean', default: false })
      .parse()
    if (argv.backfill && argv.since) {
      throw new Error('Pass either --backfill or --since, not both')
    }
    await import_nfl_coaches({
      backfill: argv.backfill,
      since: argv.since,
      dry_run: argv['dry-run'] || argv.dryRun
    })
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
