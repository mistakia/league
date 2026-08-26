// STATUS: PENDING
//
// 2026-08-25: Backfill ESPN team line win rates for 2020-2023, and replace the
// week-2 partial we hold for 2024.
//
// WHY. `espn_team_win_rates_index` held only 2024 and 2025, so the four
// blocking columns on the /data-views team-year grain rendered blank for every
// season before 2024 -- the complaint that started this
// (/u/6b8e9a40a13ae24e05ff5a4840d65c68). The importer scrapes ESPN's live
// article, which only ever covers the current season, so no amount of running
// it can produce a prior year. There is no season parameter and no API.
//
// AND 2024 IS NOT WHAT IT CLAIMS TO BE. Every 2024 row was observed between
// 2024-09-13 and 2024-09-19 -- weeks 1 and 2 -- because job 79 stopped running
// after 2024-09-19 and did not run again until 2025-09. So the "2024 season"
// row a user sees is a two-game sample: BUF 0.85 and NE 0.38 pass block, against
// full-season figures of 0.68 and 0.51. Present, plausible, and wrong. A
// row-count check cannot see this class at all; only comparing observed_at
// against the season it labels can.
//
// SOURCE. ESPN publishes one story per season, each with its own article id,
// and the Internet Archive holds post-season captures of all of them. Fetched
// through the `id_` form, which returns the original bytes without the Wayback
// toolbar.
//
// SCOPE IS TEAM-LEVEL ONLY. The 2020-2022 articles render every player Top-10
// as an infographic IMAGE -- 20 photos, zero tables -- so player win rates are
// not recoverable by scraping for those years. 2023 does carry player tables,
// but one season of player rows in isolation buys little and costs the whole
// player-matching surface, so this backfill leaves espn_player_win_rates_*
// alone.
//
// TWO INDEPENDENT SOURCES, AGREEING WHERE BOTH ARE SOUND. A spreadsheet of team
// pass-block and run-block win rates was supplied alongside, and is used as a
// cross-check rather than as a source. It agrees with the archived articles
// EXACTLY on 2020, 2021, 2022 and 2024 -- 32 of 32 teams, zero mismatches -- and
// that agreement is what licenses trusting either.
//
// It has two demonstrated defects, and the cross-check is scoped around both
// rather than being weakened to accommodate them:
//
//   - Its RUN BLOCK column is a DUPLICATE OF ITS PASS BLOCK COLUMN for
//     2019-2022, identical on all 32 rows in each of those years and on 0 of 32
//     for 2023 and 2024. Run block is therefore cross-checked from 2024 only.
//   - Its 2023 row matches no season at all -- 30 of 32 pass-block values
//     disagree with the 2023 article and 27 disagree with the 2024 one, so it is
//     not a year-shift either. That season is dropped from the reference.
//
// Both exclusions are ASSERTED in assert_reference_shape rather than left to
// these comments, so a later refresh of the reference fails loudly instead of
// silently checking a column against itself or reintroducing the bad row.
//
// RUN. The archive and the database are not reachable from the same machine:
// web.archive.org serves a workstation and returns 429 to the league host,
// while production postgres is reachable only from the host. So this runs in
// two halves, each re-running the full oracle:
//
//   workstation:  node db/adhoc/2026-08-25-backfill-espn-team-win-rates-2020-2024.mjs --emit /tmp/espn-win-rates.json
//   league host:  NODE_ENV=production node db/adhoc/2026-08-25-backfill-espn-team-win-rates-2020-2024.mjs --from /tmp/espn-win-rates.json [--dry]

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as cheerio from 'cheerio'
import { readFile, writeFile } from 'fs/promises'

import db from '#db'
import { fixTeam } from '#libs-shared'

const log = debug('backfill-espn-team-win-rates')
debug.enable('backfill-espn-team-win-rates')

// Post-season captures, so each carries that season's FINAL numbers. Several
// candidates per season because a 200 response is not a complete capture --
// some are a shell with no article body at all, and the only way to tell is to
// parse one. The first candidate that satisfies the completeness oracle wins,
// and the run prints which.
const ARCHIVE_CAPTURES = {
  2020: {
    url: 'https://www.espn.com/nfl/story/_/id/29939464/2020-nfl-pass-rushing-run-stopping-blocking-leaderboard-win-rate-rankings',
    timestamps: ['20210301195346', '20210112074301', '20210128021710']
  },
  2021: {
    url: 'https://www.espn.com/nfl/story/_/id/32176833/2021-nfl-pass-rushing-run-stopping-blocking-leaderboard-win-rate-rankings',
    timestamps: ['20220309183929', '20220308211441', '20220311122455']
  },
  2022: {
    url: 'https://www.espn.com/nfl/story/_/id/34536376/2022-nfl-pass-rushing-run-stopping-blocking-leaderboard-win-rate-rankings-top-players-teams',
    timestamps: ['20230305182226', '20230124212304', '20230122043931']
  },
  2023: {
    url: 'https://www.espn.com/nfl/story/_/id/38356170/2023-nfl-pass-rush-run-stop-blocking-win-rate-rankings-top-players-teams',
    timestamps: ['20240301011102', '20240115143812']
  },
  2024: {
    url: 'https://www.espn.com/nfl/story/_/id/41040723/2024-nfl-win-rates-top-teams-players-rankings',
    timestamps: ['20250301014039', '20250312091601', '20250503184424']
  }
}

// The four metrics in the order ESPN's team table columns carry them.
const METRICS = [
  { key: 'pass_rush_win_rate', heading: 'pass rush' },
  { key: 'run_stop_win_rate', heading: 'run stop' },
  { key: 'pass_block_win_rate', heading: 'pass block' },
  { key: 'run_block_win_rate', heading: 'run block' }
]

// Cross-check reference, from the supplied spreadsheet, restricted to the parts
// of it that survived checking. Measured against the archived ESPN articles,
// all 32 teams, both metrics:
//
//   sheet 2020 pass block vs archive 2020   0 mismatches
//   sheet 2021 pass block vs archive 2021   0
//   sheet 2022 pass block vs archive 2022   0
//   sheet 2024 pass block vs archive 2024   0
//   sheet 2024 run block  vs archive 2024   0
//   sheet 2023 pass block vs archive 2023   30 mismatches
//   sheet 2023 pass block vs archive 2024   27 mismatches
//
// So the reference is exact on four of its five seasons and its 2023 row
// matches NO season -- not 2023, not 2024, and not any shift of them. That row
// is excluded rather than reconciled: a reference that disagrees with the
// source it is meant to confirm is not evidence, and the sheet has an
// independently demonstrated defect (see the run-block duplication below).
// 2023 is therefore written on the archived ESPN article alone, guarded by the
// completeness, range and distinctness rules in grade_capture.
const REFERENCE_PASS_BLOCK = {
  2020: {
    ARI: 0.67,
    ATL: 0.57,
    BAL: 0.62,
    BUF: 0.64,
    CAR: 0.53,
    CHI: 0.58,
    CIN: 0.5,
    CLE: 0.71,
    DAL: 0.51,
    DEN: 0.54,
    DET: 0.55,
    GB: 0.74,
    HOU: 0.56,
    IND: 0.6,
    JAX: 0.51,
    KC: 0.63,
    LA: 0.63,
    LAC: 0.47,
    LV: 0.6,
    MIA: 0.51,
    MIN: 0.56,
    NE: 0.59,
    NO: 0.63,
    NYG: 0.46,
    NYJ: 0.5,
    PHI: 0.6,
    PIT: 0.51,
    SEA: 0.62,
    SF: 0.54,
    TB: 0.57,
    TEN: 0.53,
    WAS: 0.59
  },
  2021: {
    ARI: 0.61,
    ATL: 0.54,
    BAL: 0.62,
    BUF: 0.64,
    CAR: 0.5,
    CHI: 0.66,
    CIN: 0.49,
    CLE: 0.67,
    DAL: 0.58,
    DEN: 0.61,
    DET: 0.58,
    GB: 0.66,
    HOU: 0.54,
    IND: 0.6,
    JAX: 0.6,
    KC: 0.68,
    LA: 0.68,
    LAC: 0.61,
    LV: 0.59,
    MIA: 0.47,
    MIN: 0.54,
    NE: 0.62,
    NO: 0.66,
    NYG: 0.54,
    NYJ: 0.61,
    PHI: 0.67,
    PIT: 0.49,
    SEA: 0.61,
    SF: 0.61,
    TB: 0.6,
    TEN: 0.56,
    WAS: 0.63
  },
  2022: {
    ARI: 0.61,
    ATL: 0.59,
    BAL: 0.66,
    BUF: 0.67,
    CAR: 0.62,
    CHI: 0.68,
    CIN: 0.5,
    CLE: 0.68,
    DAL: 0.53,
    DEN: 0.62,
    DET: 0.6,
    GB: 0.66,
    HOU: 0.6,
    IND: 0.49,
    JAX: 0.49,
    KC: 0.75,
    LA: 0.61,
    LAC: 0.57,
    LV: 0.62,
    MIA: 0.55,
    MIN: 0.57,
    NE: 0.61,
    NO: 0.6,
    NYG: 0.52,
    NYJ: 0.57,
    PHI: 0.62,
    PIT: 0.65,
    SEA: 0.63,
    SF: 0.59,
    TB: 0.55,
    TEN: 0.54,
    WAS: 0.53
  },
  2024: {
    ARI: 0.6,
    ATL: 0.59,
    BAL: 0.7,
    BUF: 0.68,
    CAR: 0.52,
    CHI: 0.6,
    CIN: 0.5,
    CLE: 0.65,
    DAL: 0.57,
    DEN: 0.74,
    DET: 0.64,
    GB: 0.67,
    HOU: 0.58,
    IND: 0.56,
    JAX: 0.59,
    KC: 0.67,
    LA: 0.59,
    LAC: 0.65,
    LV: 0.59,
    MIA: 0.56,
    MIN: 0.7,
    NE: 0.51,
    NO: 0.54,
    NYG: 0.56,
    NYJ: 0.57,
    PHI: 0.67,
    PIT: 0.62,
    SEA: 0.58,
    SF: 0.61,
    TB: 0.68,
    TEN: 0.56,
    WAS: 0.66
  }
}

const REFERENCE_RUN_BLOCK = {
  2024: {
    ARI: 0.72,
    ATL: 0.71,
    BAL: 0.74,
    BUF: 0.71,
    CAR: 0.72,
    CHI: 0.73,
    CIN: 0.68,
    CLE: 0.72,
    DAL: 0.73,
    DEN: 0.75,
    DET: 0.72,
    GB: 0.71,
    HOU: 0.68,
    IND: 0.74,
    JAX: 0.7,
    KC: 0.73,
    LA: 0.72,
    LAC: 0.72,
    LV: 0.71,
    MIA: 0.7,
    MIN: 0.72,
    NE: 0.67,
    NO: 0.71,
    NYG: 0.69,
    NYJ: 0.68,
    PHI: 0.72,
    PIT: 0.71,
    SEA: 0.69,
    SF: 0.71,
    TB: 0.73,
    TEN: 0.71,
    WAS: 0.74
  }
}

const EXPECTED_TEAM_COUNT = 32

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Wayback throttles a burst hard -- refused connections and resets, not 429s --
// so back off generously and treat a transport failure as retryable. A capture
// that returns bytes but parses empty is NOT retried here; that is the
// truncated-capture case, and the caller moves to the next timestamp.
const fetch_capture = async ({ timestamp, url, attempts = 4 }) => {
  const archive_url = `https://web.archive.org/web/${timestamp}id_/${url}`
  let last_error
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(archive_url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(120000)
      })
      if (!response.ok) {
        throw new Error(`http ${response.status}`)
      }
      return await response.text()
    } catch (err) {
      last_error = err
      log(
        `  ${timestamp} attempt ${attempt}/${attempts} failed: ${err.message || err.name}`
      )
      if (attempt < attempts) await wait(10000 * attempt)
    }
  }
  throw last_error
}

// 2023 onward: the team leaderboard is the last `table.inline-table`, columns
// Team | PRWR | RSWR | PBWR | RBWR.
const parse_team_tables = (html) => {
  const $ = cheerio.load(html)
  const tables = $('table.inline-table')
  if (!tables.length) return {}

  const team_table = tables.eq(tables.length - 1)
  const parsed = {}
  for (const row of team_table.find('tbody tr').get()) {
    const cells = $(row).find('td')
    if (cells.length < METRICS.length + 1) continue
    const team_name = $(cells[0]).text().trim()
    if (!team_name) continue
    const values = {}
    let complete = true
    METRICS.forEach((metric, index) => {
      const match = $(cells[index + 1])
        .text()
        .match(/(\d+(?:\.\d+)?)/)
      if (match) values[metric.key] = parseFloat(match[1]) / 100
      else complete = false
    })
    if (complete) parsed[team_name] = values
  }
  return parsed
}

// 2020-2022: no tables at all. Each metric is a plain-text ranked list under an
// <h2>, entries separated by <br>. Three things this must not assume, each
// found the hard way:
//   - HEADING CASE varies. 2022 lowercases them; 2020 and 2021 title-case.
//   - RANKS ARE NOT MONOTONIC. 2020 pass block has two 29th places and no 30th,
//     so anything keyed on a rank sequence silently drops a team.
//   - SECTION BOUNDS are the next <h2>, not a fixed window. A fixed window
//     bleeds the following section's entries into this one.
const parse_team_text_sections = (html) => {
  const $ = cheerio.load(html)
  const headings = $('h2').get()
  const parsed = {}

  headings.forEach((heading, index) => {
    const label = $(heading).text().trim().toLowerCase()
    if (!label.startsWith('team')) return
    const metric = METRICS.find((candidate) =>
      label.includes(candidate.heading)
    )
    if (!metric) return

    // Everything between this heading and the next one.
    const section = $(heading).nextUntil(headings[index + 1] || null)
    const text = section
      .toArray()
      .map((node) => $(node).html() || '')
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')

    for (const line of text.split('\n')) {
      const match = line.match(/^\s*\d+\.\s*(.+?),\s*(\d+(?:\.\d+)?)%/)
      if (!match) continue
      const team_name = match[1].trim()
      parsed[team_name] = parsed[team_name] || {}
      parsed[team_name][metric.key] = parseFloat(match[2]) / 100
    }
  })

  return parsed
}

// Normalize to our team codes and keep only teams carrying all four metrics.
// fixTeam already handles the era names this reaches back through (Washington
// Football Team, Oakland/Las Vegas).
const to_team_rows = (parsed) => {
  const rows = []
  for (const [team_name, values] of Object.entries(parsed)) {
    const nfl_team = fixTeam(team_name)
    if (!nfl_team) continue
    if (METRICS.some((metric) => values[metric.key] == null)) continue
    rows.push({ nfl_team, ...values })
  }
  return rows
}

// Completeness oracle for one capture. A 200 with bytes is not evidence: some
// captures are a shell with no article body, and a partial parse is exactly
// what would write a half-populated season nobody notices.
const grade_capture = ({ season_year, rows }) => {
  const failures = []
  const teams = new Set(rows.map((row) => row.nfl_team))

  if (rows.length !== EXPECTED_TEAM_COUNT) {
    failures.push(
      `parsed ${rows.length} complete team row(s), expected ${EXPECTED_TEAM_COUNT}`
    )
  }
  if (teams.size !== rows.length) {
    failures.push(
      `parsed ${rows.length} row(s) covering only ${teams.size} distinct team(s)`
    )
  }

  for (const metric of METRICS) {
    const values = rows
      .map((row) => row[metric.key])
      .filter((value) => value != null)
    if (!values.length) {
      failures.push(`${metric.key} is empty`)
      continue
    }
    // Range and distinctness, the two rules that separate a real distribution
    // from a sentinel or a percentage parsed at the wrong scale.
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min < 0.05 || max > 0.99) {
      failures.push(
        `${metric.key} spans ${min}-${max}, outside a plausible rate`
      )
    }
    if (new Set(values).size <= 1) {
      failures.push(
        `${metric.key} carries one repeated value across every team`
      )
    }
  }

  return { passed: !failures.length, failures, season_year }
}

// Cross-check the parse against the supplied reference. Any disagreement is a
// hard stop: two independent sources of the same published number must agree,
// and if they do not, one of them is being read wrong.
const cross_check = ({ season_year, rows }) => {
  const failures = []
  const by_team = Object.fromEntries(rows.map((row) => [row.nfl_team, row]))

  const compare = (reference, key) => {
    if (!reference) return 0
    let compared = 0
    for (const [reference_team, expected] of Object.entries(reference)) {
      const nfl_team = fixTeam(reference_team)
      const row = by_team[nfl_team]
      if (!row) {
        failures.push(
          `${key}: reference team ${reference_team} absent from parse`
        )
        continue
      }
      compared++
      if (Math.abs(row[key] - expected) > 0.0001) {
        failures.push(
          `${key}: ${nfl_team} parsed ${row[key]}, reference says ${expected}`
        )
      }
    }
    return compared
  }

  const pass_block_compared = compare(
    REFERENCE_PASS_BLOCK[season_year],
    'pass_block_win_rate'
  )
  const run_block_compared = compare(
    REFERENCE_RUN_BLOCK[season_year],
    'run_block_win_rate'
  )

  return { failures, pass_block_compared, run_block_compared }
}

// The reference's run-block column is a copy of its pass-block column for
// 2019-2022, which is why run block is cross-checked only from 2023. Assert the
// premise rather than relying on the comment: if the reference is ever
// refreshed with real run-block values, this fails and the exclusion above
// should be revisited, instead of quietly checking a column against itself.
const assert_reference_shape = () => {
  for (const season_year of [2020, 2021, 2022, 2023]) {
    if (REFERENCE_RUN_BLOCK[season_year]) {
      throw new Error(
        `reference run block for ${season_year} is present -- it was excluded as a duplicate of pass block; re-verify before trusting it`
      )
    }
  }
  if (REFERENCE_PASS_BLOCK[2023]) {
    throw new Error(
      'reference pass block for 2023 is present -- that row matched no season when measured and was excluded; re-verify before trusting it'
    )
  }
  for (const season_year of [2024]) {
    const pass_block = REFERENCE_PASS_BLOCK[season_year]
    const run_block = REFERENCE_RUN_BLOCK[season_year]
    const identical = Object.keys(pass_block).every(
      (team) => pass_block[team] === run_block[team]
    )
    if (identical) {
      throw new Error(
        `reference run block for ${season_year} is identical to pass block on every team -- it is the duplicated column, not real run-block data`
      )
    }
  }
}

// Resolve every season from the archive: fetch, parse, grade, cross-check.
// Split from the write half because the two halves are not reachable from the
// same place -- web.archive.org answers a workstation and returns 429 to the
// league host, while the production database is reachable only from the host.
// `--emit` runs this half and writes the payload; `--from` runs the write half
// against it. Both halves re-run the oracle, so the payload is a transport, not
// a trusted input.
const resolve_from_archive = async () => {
  const resolved = []

  for (const [season_year_string, capture] of Object.entries(
    ARCHIVE_CAPTURES
  )) {
    const season_year = Number(season_year_string)
    const parse =
      season_year >= 2023 ? parse_team_tables : parse_team_text_sections

    let accepted = null
    for (const timestamp of capture.timestamps) {
      log(`${season_year}: fetching capture ${timestamp}`)
      let html
      try {
        html = await fetch_capture({ timestamp, url: capture.url })
      } catch (err) {
        log(`  ${timestamp} unreachable after retries: ${err.message}`)
        continue
      }

      const rows = to_team_rows(parse(html))
      const grade = grade_capture({ season_year, rows })
      if (!grade.passed) {
        log(
          `  ${timestamp} rejected (${html.length} bytes): ${grade.failures.join('; ')}`
        )
        continue
      }

      const check = cross_check({ season_year, rows })
      if (check.failures.length) {
        throw new Error(
          `${season_year} capture ${timestamp} disagrees with the reference: ${check.failures.join('; ')}`
        )
      }

      log(
        `  ${timestamp} accepted: 32 teams, cross-checked ${check.pass_block_compared} pass block and ${check.run_block_compared} run block value(s)`
      )
      accepted = { timestamp, rows }
      break
    }

    if (!accepted) {
      throw new Error(
        `${season_year}: no candidate capture passed the completeness oracle`
      )
    }

    resolved.push({ season_year, ...accepted })
    await wait(3000)
  }

  return resolved
}

// Re-grade a payload loaded from disk. The emitting run already graded it, but
// a file is an input like any other -- it can be stale, hand-edited, or from a
// different article entirely -- and the whole point of the oracle is that
// nothing reaches the table ungraded.
const regrade_payload = (resolved) => {
  const seasons = Object.keys(ARCHIVE_CAPTURES).map(Number).sort()
  const present = resolved.map((entry) => entry.season_year).sort()
  if (JSON.stringify(seasons) !== JSON.stringify(present)) {
    throw new Error(
      `payload covers seasons ${present.join(', ')}, expected ${seasons.join(', ')}`
    )
  }

  for (const { season_year, timestamp, rows } of resolved) {
    if (!ARCHIVE_CAPTURES[season_year]?.timestamps.includes(timestamp)) {
      throw new Error(
        `payload season ${season_year} cites capture ${timestamp}, which is not a declared candidate`
      )
    }
    const grade = grade_capture({ season_year, rows })
    if (!grade.passed) {
      throw new Error(
        `payload season ${season_year} fails the oracle: ${grade.failures.join('; ')}`
      )
    }
    const check = cross_check({ season_year, rows })
    if (check.failures.length) {
      throw new Error(
        `payload season ${season_year} disagrees with the reference: ${check.failures.join('; ')}`
      )
    }
    log(
      `  ${season_year}@${timestamp} regraded OK: 32 teams, cross-checked ${check.pass_block_compared} pass block and ${check.run_block_compared} run block value(s)`
    )
  }
}

const backfill = async ({
  dry_run = false,
  emit_path = null,
  from_path = null
} = {}) => {
  assert_reference_shape()
  log('reference shape OK: run block distinct from pass block where used')

  let resolved
  if (from_path) {
    const payload = JSON.parse(await readFile(from_path, 'utf8'))
    resolved = payload.seasons
    log(
      `loaded payload emitted ${payload.generated_at} covering ${resolved.length} season(s)`
    )
    regrade_payload(resolved)
  } else {
    resolved = await resolve_from_archive()
  }

  if (emit_path) {
    await writeFile(
      emit_path,
      `${JSON.stringify({ generated_at: new Date().toISOString(), seasons: resolved }, null, 2)}\n`
    )
    log(
      `emitted ${resolved.length} season(s) to ${emit_path} -- nothing written to the database`
    )
    return { resolved }
  }

  // Every season resolved before anything is written. A backfill that writes as
  // it goes leaves a half-done state behind on the season that fails.
  const inserts = resolved.flatMap(({ season_year, timestamp, rows }) => {
    // The capture time IS the observation time -- that is what makes a later
    // in-season scrape correctly lose to this one under the index's
    // latest-observation rule, and what makes the 2024 replacement honest.
    const observed_at = new Date(
      `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`
    )
    return rows.map((row) => ({ ...row, season_year, observed_at }))
  })

  log(
    `resolved ${resolved.length} season(s), ${inserts.length} team rows: ${resolved.map((entry) => `${entry.season_year}@${entry.timestamp}`).join(', ')}`
  )

  if (dry_run) {
    log('dry run -- nothing written')
    for (const entry of resolved) {
      const sample = entry.rows.slice(0, 3)
      log(
        `  ${entry.season_year}: ${sample.map((row) => `${row.nfl_team} pb=${row.pass_block_win_rate} rb=${row.run_block_win_rate}`).join(', ')}`
      )
    }
    return { resolved, inserts }
  }

  await db('espn_team_win_rates_history')
    .insert(inserts)
    .onConflict(['nfl_team', 'observed_at'])
    .merge()

  await db('espn_team_win_rates_index')
    .insert(inserts)
    .onConflict(['nfl_team', 'season_year'])
    .merge()

  log(`wrote ${inserts.length} team rows`)

  // Read the state back. The write reported no error, which is not the same as
  // the rows being there and being what was intended.
  const written = await db('espn_team_win_rates_index')
    .select('season_year')
    .count('* as team_count')
    .min('pass_block_win_rate as min_pass_block')
    .max('pass_block_win_rate as max_pass_block')
    .whereIn('season_year', Object.keys(ARCHIVE_CAPTURES).map(Number))
    .groupBy('season_year')
    .orderBy('season_year')

  const shortfalls = written
    .filter((row) => Number(row.team_count) !== EXPECTED_TEAM_COUNT)
    .map((row) => `${row.season_year} holds ${row.team_count} team(s)`)

  const missing = Object.keys(ARCHIVE_CAPTURES)
    .map(Number)
    .filter(
      (season_year) =>
        !written.some((row) => Number(row.season_year) === season_year)
    )
  if (missing.length) shortfalls.push(`no rows for ${missing.join(', ')}`)

  for (const row of written) {
    console.log(
      `  ${row.season_year}: ${row.team_count} teams, pass block ${row.min_pass_block}-${row.max_pass_block}`
    )
  }

  if (shortfalls.length) {
    throw new Error(`ORACLE FAIL: ${shortfalls.join('; ')}`)
  }
  console.log(
    `ORACLE PASS: ${written.length} season(s) each holding ${EXPECTED_TEAM_COUNT} team rows`
  )

  return { resolved, inserts }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).argv
    await backfill({
      dry_run: Boolean(argv.dry),
      emit_path: argv.emit || null,
      from_path: argv.from || null
    })
  } catch (err) {
    error = err
    console.log(`FAILED: ${err.message}`)
  }
  process.exit(error ? 1 : 0)
}

main()
