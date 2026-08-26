// STATUS: APPLIED 2026-08-26 against league_production (180 index rows deleted,
// 240 written, 236 of 240 matched to a pid, oracle PASS)
//
// 2026-08-26: Backfill ESPN PLAYER line win rates for 2023, and replace the
// weeks-1-2 partial we hold for 2024.
//
// THE SAME DEFECT AS THE TEAM ROWS, LEFT HALF-DONE. The 2020-2024 team backfill
// (db/adhoc/2026-08-25-backfill-espn-team-win-rates-2020-2024.mjs) fixed the
// team grain and deliberately left the player grain alone. What it left behind:
//
//   - `espn_player_win_rates_index` holds NO 2023 rows at all.
//   - Every 2024 row was observed between 2024-09-12 and 2024-09-19 -- weeks 1
//     and 2 -- because the job stopped running after 2024-09-19 and did not run
//     again until 2025-09. So the "2024 season" row a user sees is a two-game
//     sample. It is not subtly wrong: median total_plays is 27-34 against a
//     full-season 198-352, and twelve pass blockers carry a win rate of exactly
//     1.0000, which is a 2-game artifact and not a season any lineman has ever
//     had. Present, plausible at a glance, and wrong.
//
// THE 2024 REPLACEMENT IS A DELETE, NOT A MERGE, and that distinction is the
// whole reason this needs a script rather than a re-run. The index is keyed
// (player_name, espn_player_id, espn_win_rate_type, season_year). The partial
// holds 180 rows because it captured whoever led after two games; the final
// article publishes 120. A merge would update the players present in both and
// leave ~60 week-2-only players sitting in the 2024 season with their two-game
// numbers -- a half-replaced season, which is worse than either state alone
// because it looks repaired. So the season's index rows are deleted inside the
// same transaction that inserts the replacements.
//
// HISTORY IS NOT DELETED. `espn_player_win_rates_history` is keyed on
// observed_at and the weeks-1-2 rows are an HONEST record: they say "on
// 2024-09-19 ESPN's leaderboard looked like this", which is true. Only the index
// -- which claims to describe a SEASON -- is wrong, and only the index is
// rewritten.
//
// SCOPE IS 2023-2024, AND THAT IS AN UPSTREAM LIMIT. The 2020, 2021 and 2022
// articles render every player Top-10 as an infographic IMAGE -- 20 photos, zero
// tables -- so player win rates are not recoverable by scraping for those years.
// 2018 and 2019 publish player lists as plain text without an ESPN player id,
// and espn_player_id is NOT NULL on both tables, so those are out too. 2023 is
// the first season with parseable player tables carrying ids.
//
// UNMATCHED PLAYERS ARE WRITTEN WITH A NULL pid, WHICH IS A DELIBERATE BREAK
// FROM THE IMPORTER. The live importer drops a player it cannot resolve, and
// libs-server/grade-espn-line-win-rates-run.mjs says in as many words that this
// is why no fetched-vs-matched figure has ever been recoverable for this feed.
// The column is nullable and the table already holds 24 null-pid rows, so
// nothing new is being introduced -- and keeping the row preserves both the
// published leaderboard and the denominator. The match rate is REPORTED per
// category and floored, so a matching collapse fails the run.
//
// MATCHING MUST NOT FILTER ON ROSTER STATUS. `find_player` defaults to
// `ignore_retired: true` and `ignore_free_agent: true`, and
// `preload_active_players` defaults to active players only. For a two-and-three
// season-old leaderboard that discards most of the list -- Aaron Donald, Von
// Miller and Tyron Smith are all retired now. An exact ESPN-id match IS
// identity; whether the player is currently rostered has nothing to do with
// whether this row is about them. Both defaults are overridden below.
//
// RUN. The archive and the database are not reachable from the same machine:
// web.archive.org serves a workstation and returns 429 to the league host, while
// production postgres is reachable only from the host. The split is not
// cosmetic here -- player matching needs the database, so the emit half fetches,
// parses and grades the PUBLISHED rows, and the from half re-grades them, then
// resolves pids and writes:
//
//   workstation:  node db/adhoc/2026-08-26-backfill-espn-player-win-rates-2023-2024.mjs --emit /tmp/espn-player-2023-2024.json
//   league host:  NODE_ENV=production node db/adhoc/2026-08-26-backfill-espn-player-win-rates-2023-2024.mjs --from /tmp/espn-player-2023-2024.json [--dry]

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as cheerio from 'cheerio'
import { readFile, writeFile } from 'fs/promises'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'

const log = debug('backfill-espn-player-win-rates-2023-2024')
debug.enable('backfill-espn-player-win-rates-2023-2024')

// The eight player tables, in the order the page carries them, paired into the
// four categories the enum uses. Two tables per category: ESPN publishes an
// edge/OT table and an interior table for each.
//
// `token` is asserted against the rate column's header so that a re-ordered page
// fails loudly rather than filing pass rushers as run blockers. It is matched as
// a PREFIX, not an equality: the 2024 article heads its DT run-stop table
// "RSWRate" while every other table on both pages uses the bare four-letter
// form, and an exact match would reject a sound capture.
const CATEGORIES = [
  {
    espn_win_rate_type: 'PASS_RUSH',
    table_indexes: [0, 1],
    token: 'PRWR',
    expected_rows: 40
  },
  {
    espn_win_rate_type: 'PASS_BLOCK',
    table_indexes: [2, 3],
    token: 'PBWR',
    expected_rows: 40
  },
  {
    espn_win_rate_type: 'RUN_STOP',
    table_indexes: [4, 5],
    token: 'RSWR',
    expected_rows: 20
  },
  {
    espn_win_rate_type: 'RUN_BLOCK',
    table_indexes: [6, 7],
    token: 'RBWR',
    expected_rows: 20
  }
]

// Index 8 is the team leaderboard, already backfilled by the 2020-2024 team
// script. Asserted so that a page with a different number of tables -- which is
// how a table being added or dropped would present -- fails before any index is
// dereferenced.
const EXPECTED_TABLE_COUNT = 9

// THE PARTIAL-SAMPLE ORACLE, and the rule that would have caught the defect this
// script exists to repair. Measured on both captures and on what is in the table
// now:
//
//   final season tables    median total_plays 198-352, minimum 170
//   the 2024 partial       median total_plays  22-34,  maximum  68
//
// Two orders of magnitude apart, so 150 sits in open space with enormous margin
// on both sides. The MEDIAN is the statistic rather than the minimum, because
// ESPN's qualifying threshold has moved between seasons and one lightly-used
// player should not fail an otherwise complete season.
const MINIMUM_MEDIAN_PLAYS = 150

// Of the players a category published, the share that must resolve to a pid.
// Unlike the live importer's bound -- which grade-espn-line-win-rates-run.mjs
// deliberately leaves at 0 because nobody had ever sampled the residual -- this
// one CAN be calibrated, because a frozen archived page lets the residual be
// listed and read. The run prints every unmatched player by name; this floor is
// set well below the observed rate so it catches a collapse rather than
// policing the long tail.
const MINIMUM_MATCH_RATE = 0.8

// Win rates are percentages in [0, 1] after parsing. Deliberately looser than
// the observed range: the job is to catch a decimal-place error, not to police a
// distribution. Pass block runs to 0.99 so the ceiling has to allow it.
const MINIMUM_PLAUSIBLE_RATE = 0.05
const MAXIMUM_PLAUSIBLE_RATE = 1.0

// A capture taken before this instant cannot carry that season's final numbers.
// The day after each season's Super Bowl.
const MINIMUM_POST_SEASON_TIMESTAMP = {
  2023: '20240212', // Super Bowl LVIII, 2024-02-11
  2024: '20250210' // Super Bowl LIX, 2025-02-09
}

const ARCHIVE_CAPTURES = {
  2023: {
    url: 'https://www.espn.com/nfl/story/_/id/38356170/2023-nfl-pass-rush-run-stop-blocking-win-rate-rankings-top-players-teams',
    timestamps: ['20240301011102', '20240412080515', '20240225232626']
  },
  2024: {
    url: 'https://www.espn.com/nfl/story/_/id/41040723/2024-nfl-win-rates-top-teams-players-rankings',
    timestamps: ['20250301014039', '20250312091601', '20250503184424']
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Wayback throttles a burst by refusing the connection outright rather than
// answering 429, so back off generously and treat transport failure as
// retryable. A capture that returns bytes but parses short is NOT retried; that
// is the truncated-capture case and the caller moves to the next timestamp.
const fetch_capture = async ({ timestamp, url, attempts = 4 }) => {
  const archive_url = `https://web.archive.org/web/${timestamp}id_/${url}`
  let last_error
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(archive_url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(120000)
      })
      if (!response.ok) throw new Error(`http ${response.status}`)
      return await response.text()
    } catch (err) {
      last_error = err
      log(
        `  ${timestamp} attempt ${attempt}/${attempts} failed: ${err.message || err.name}`
      )
      if (attempt < attempts) await wait(15000 * attempt)
    }
  }
  throw last_error
}

const parse_percentage = (text) => {
  // The fractional part is not optional decoration: /(\d+)%/ against "62.5%"
  // matches the trailing "5%" and yields 0.05 -- a well-formed number off by a
  // factor of ten that no count or fill-rate rule can see.
  const match = String(text).match(/(\d+(?:\.\d+)?)%/)
  return match ? parseFloat(match[1]) / 100 : null
}

const parse_player_tables = (html) => {
  const $ = cheerio.load(html)
  const tables = $('table.inline-table')
  if (tables.length !== EXPECTED_TABLE_COUNT) {
    throw new Error(
      `found ${tables.length} inline-table(s), expected ${EXPECTED_TABLE_COUNT} (8 player tables plus the team table)`
    )
  }

  const rows = []
  for (const category of CATEGORIES) {
    for (const index of category.table_indexes) {
      const table = tables.eq(index)
      const header = table
        .find('tr')
        .eq(0)
        .find('th,td')
        .map((_, cell) => $(cell).text().trim())
        .get()
      // Column 5 is the rate column. Prefix match -- see the CATEGORIES comment.
      if (
        !String(header[5] || '')
          .toUpperCase()
          .startsWith(category.token)
      ) {
        throw new Error(
          `inline-table index ${index} rate column header is "${header[5]}", expected it to start with ${category.token} for ${category.espn_win_rate_type}`
        )
      }

      for (const row of table.find('tbody tr').get()) {
        const cells = $(row).find('td')
        if (cells.length < 7) continue
        const link = $(cells[1]).find('a')
        const href = link.attr('href')
        // espn_player_id is NOT NULL on both tables and is the importer's
        // primary matching key, so a row without one is not writable. Every row
        // on both captures carries one; this raises rather than skipping,
        // because a page that stopped linking players is a restructure worth
        // failing on, not a row worth dropping.
        const espn_player_id = href
          ? Number(href.split('/id/')[1]?.split('/')[0])
          : null
        if (!espn_player_id) {
          throw new Error(
            `table ${index} row "${link.text().trim() || $(cells[1]).text().trim()}" carries no ESPN player id`
          )
        }

        rows.push({
          espn_win_rate_type: category.espn_win_rate_type,
          player_name: link.text().trim(),
          espn_player_id,
          nfl_team: fixTeam($(cells[2]).text().trim()),
          line_win_count: Number($(cells[3]).text().trim()),
          total_plays: Number($(cells[4]).text().trim()),
          win_rate: parse_percentage($(cells[5]).text()),
          double_team_percentage: parse_percentage($(cells[6]).text())
        })
      }
    }
  }

  return rows
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Completeness oracle for one capture, graded PER CATEGORY. That grain is not
// decoration: RUN_STOP and RUN_BLOCK publish 20 rows against PASS_RUSH's 40, so
// either could collapse to zero and an aggregate floor across all four would
// still look healthy.
const grade_capture = ({ season_year, rows }) => {
  const failures = []

  for (const category of CATEGORIES) {
    const label = category.espn_win_rate_type
    const category_rows = rows.filter((row) => row.espn_win_rate_type === label)

    if (category_rows.length !== category.expected_rows) {
      failures.push(
        `${label} carries ${category_rows.length} row(s), expected exactly ${category.expected_rows}`
      )
      if (!category_rows.length) continue
    }

    const ids = new Set(category_rows.map((row) => row.espn_player_id))
    if (ids.size !== category_rows.length) {
      failures.push(
        `${label} carries ${category_rows.length} row(s) covering only ${ids.size} distinct ESPN player id(s)`
      )
    }

    // Fill. A renamed column or a moved cell index parses to null for every
    // entry, which any presence check reads as healthy because the rows exist.
    for (const key of [
      'player_name',
      'nfl_team',
      'win_rate',
      'double_team_percentage'
    ]) {
      const filled = category_rows.filter(
        (row) => row[key] != null && row[key] !== ''
      ).length
      if (filled !== category_rows.length) {
        failures.push(
          `${label} ${key} populated on ${filled} of ${category_rows.length} row(s)`
        )
      }
    }
    for (const key of ['line_win_count', 'total_plays']) {
      const finite = category_rows.filter((row) =>
        Number.isFinite(row[key])
      ).length
      if (finite !== category_rows.length) {
        failures.push(
          `${label} ${key} is a finite number on ${finite} of ${category_rows.length} row(s)`
        )
      }
    }

    const rates = category_rows
      .map((row) => row.win_rate)
      .filter((rate) => rate != null)
    if (rates.length) {
      const min = Math.min(...rates)
      const max = Math.max(...rates)
      if (min < MINIMUM_PLAUSIBLE_RATE || max > MAXIMUM_PLAUSIBLE_RATE) {
        failures.push(
          `${label} win rate spans ${min}-${max}, outside a plausible rate -- suspect a percentage parsed at the wrong scale`
        )
      }
      if (new Set(rates).size <= 1) {
        failures.push(
          `${label} carries a single repeated win rate across ${rates.length} row(s) -- a sentinel or a dead cell, not a distribution`
        )
      }
    }

    // The partial-sample rule. This is the one that separates a season from a
    // two-game snapshot wearing a season label.
    const plays = category_rows
      .map((row) => row.total_plays)
      .filter((value) => Number.isFinite(value))
    if (plays.length) {
      const median_plays = median(plays)
      if (median_plays < MINIMUM_MEDIAN_PLAYS) {
        failures.push(
          `${label} median total_plays is ${median_plays} (floor ${MINIMUM_MEDIAN_PLAYS}) -- this is an in-season partial, not a full season`
        )
      }
    }

    // A win count above the play count is arithmetically impossible and would
    // mean the two columns were read in the wrong order.
    const impossible = category_rows.filter(
      (row) => row.line_win_count > row.total_plays
    )
    if (impossible.length) {
      failures.push(
        `${label} has ${impossible.length} row(s) with more wins than plays -- suspect the wins and plays columns are transposed`
      )
    }

    // The published rate must agree with wins/plays. This is an INTERNAL
    // cross-check that needs no second source: ESPN prints all three numbers and
    // they have to be consistent, so it catches a rate column read from the
    // wrong cell even when the value looks plausible. Tolerance is one
    // percentage point, because the rate is published rounded to whole percent.
    const inconsistent = category_rows.filter((row) => {
      if (!row.total_plays || row.win_rate == null) return false
      return (
        Math.abs(row.line_win_count / row.total_plays - row.win_rate) > 0.01
      )
    })
    if (inconsistent.length) {
      const sample = inconsistent
        .slice(0, 3)
        .map(
          (row) =>
            `${row.player_name} ${row.line_win_count}/${row.total_plays}=${(row.line_win_count / row.total_plays).toFixed(3)} but published ${row.win_rate}`
        )
      failures.push(
        `${label} has ${inconsistent.length} row(s) whose published win rate disagrees with wins/plays: ${sample.join('; ')}`
      )
    }
  }

  return { passed: !failures.length, failures, season_year }
}

const assert_post_season = ({ season_year, timestamp }) => {
  const floor = MINIMUM_POST_SEASON_TIMESTAMP[season_year]
  if (!floor)
    throw new Error(`no post-season floor declared for ${season_year}`)
  if (String(timestamp).slice(0, 8) < floor) {
    throw new Error(
      `${season_year} capture ${timestamp} predates ${floor} -- an in-season capture carries a partial-season sample, which is the exact defect this script repairs`
    )
  }
}

// Two independent captures of the same article must agree on every row. This is
// the cross-check that IS available here: there is no second PUBLISHER of these
// numbers, so what two captures months apart establish is that the page was
// frozen and the bytes are complete -- not that ESPN's arithmetic is right. The
// wins/plays consistency rule in grade_capture is what checks the arithmetic.
const cross_check_captures = ({ season_year, primary, secondary }) => {
  const failures = []
  const key_of = (row) => `${row.espn_win_rate_type}:${row.espn_player_id}`
  const by_key = new Map(secondary.rows.map((row) => [key_of(row), row]))

  for (const row of primary.rows) {
    const other = by_key.get(key_of(row))
    if (!other) {
      failures.push(
        `${row.player_name} (${key_of(row)}) present in ${primary.timestamp} but absent from ${secondary.timestamp}`
      )
      continue
    }
    for (const key of ['win_rate', 'line_win_count', 'total_plays']) {
      if (Math.abs(Number(row[key]) - Number(other[key])) > 0.0001) {
        failures.push(
          `${row.player_name} ${key}: ${primary.timestamp} says ${row[key]}, ${secondary.timestamp} says ${other[key]}`
        )
      }
    }
  }

  if (failures.length) {
    throw new Error(
      `${season_year}: captures ${primary.timestamp} and ${secondary.timestamp} disagree: ${failures.slice(0, 6).join('; ')}`
    )
  }
  return primary.rows.length
}

const resolve_season = async ({ season_year, capture }) => {
  const accepted = []

  for (const timestamp of capture.timestamps) {
    assert_post_season({ season_year, timestamp })
    log(`${season_year}: fetching capture ${timestamp}`)
    let html
    try {
      html = await fetch_capture({ timestamp, url: capture.url })
    } catch (err) {
      log(`  ${timestamp} unreachable after retries: ${err.message}`)
      continue
    }

    let rows
    try {
      rows = parse_player_tables(html)
    } catch (err) {
      log(`  ${timestamp} parse failed (${html.length} bytes): ${err.message}`)
      continue
    }

    const grade = grade_capture({ season_year, rows })
    if (!grade.passed) {
      log(
        `  ${timestamp} rejected (${html.length} bytes): ${grade.failures.join('; ')}`
      )
      continue
    }

    log(
      `  ${timestamp} accepted: ${rows.length} player rows across 4 categories`
    )
    accepted.push({ timestamp, rows })
    if (accepted.length === 2) break
    await wait(6000)
  }

  if (!accepted.length) {
    throw new Error(
      `${season_year}: no candidate capture passed the completeness oracle`
    )
  }
  if (accepted.length < 2) {
    throw new Error(
      `${season_year}: only capture ${accepted[0].timestamp} passed -- a second agreeing capture is required before these values are trusted`
    )
  }

  const compared = cross_check_captures({
    season_year,
    primary: accepted[0],
    secondary: accepted[1]
  })
  log(
    `  ${season_year}: captures ${accepted[0].timestamp} and ${accepted[1].timestamp} agree on all ${compared} row(s)`
  )

  return {
    season_year,
    timestamp: accepted[0].timestamp,
    corroborating_timestamp: accepted[1].timestamp,
    rows: accepted[0].rows
  }
}

const resolve_from_archive = async () => {
  const resolved = []
  for (const [season_year_string, capture] of Object.entries(
    ARCHIVE_CAPTURES
  )) {
    resolved.push(
      await resolve_season({ season_year: Number(season_year_string), capture })
    )
    await wait(6000)
  }
  return resolved
}

// Re-grade a payload loaded from disk. The emitting run already graded it, but a
// file is an input like any other -- stale, hand-edited, or from a different
// article entirely -- and the point of the oracle is that nothing reaches the
// table ungraded.
const regrade_payload = (resolved) => {
  const expected = Object.keys(ARCHIVE_CAPTURES).map(Number).sort()
  const present = resolved.map((entry) => entry.season_year).sort()
  if (JSON.stringify(expected) !== JSON.stringify(present)) {
    throw new Error(
      `payload covers seasons ${present.join(', ')}, expected ${expected.join(', ')}`
    )
  }

  for (const entry of resolved) {
    const { season_year, timestamp, corroborating_timestamp, rows } = entry
    for (const stamp of [timestamp, corroborating_timestamp]) {
      if (!ARCHIVE_CAPTURES[season_year]?.timestamps.includes(stamp)) {
        throw new Error(
          `payload season ${season_year} cites capture ${stamp}, which is not a declared candidate`
        )
      }
      assert_post_season({ season_year, timestamp: stamp })
    }
    const grade = grade_capture({ season_year, rows })
    if (!grade.passed) {
      throw new Error(
        `payload season ${season_year} fails the oracle: ${grade.failures.join('; ')}`
      )
    }
    log(
      `  ${season_year}@${timestamp} regraded OK: ${rows.length} row(s), corroborated by ${corroborating_timestamp}`
    )
  }
}

// Resolve each published row to a pid. Roster-status filters are OFF: an exact
// ESPN-id match is identity, and these leaderboards are two and three seasons
// old, so most of the list is retired or a free agent today.
const match_players = async (resolved) => {
  await preload_active_players({ all_players: true })
  log('player cache initialized with all players (retired included)')

  const report = []

  for (const entry of resolved) {
    for (const category of CATEGORIES) {
      const label = category.espn_win_rate_type
      const category_rows = entry.rows.filter(
        (row) => row.espn_win_rate_type === label
      )
      const unmatched = []

      for (const row of category_rows) {
        let player = find_player({
          espn_player_id: row.espn_player_id,
          ignore_retired: false,
          ignore_free_agent: false
        })
        if (!player) {
          player = find_player({
            name: row.player_name,
            teams: row.nfl_team ? [row.nfl_team] : [],
            ignore_retired: false,
            ignore_free_agent: false
          })
        }
        if (!player) {
          player = find_player({
            name: row.player_name,
            ignore_retired: false,
            ignore_free_agent: false
          })
        }
        // pid stays null rather than the row being dropped -- see the header.
        row.pid = player ? player.pid : null
        if (!player) {
          unmatched.push(
            `${row.player_name} (${row.nfl_team}, espn ${row.espn_player_id})`
          )
        }
      }

      const matched = category_rows.length - unmatched.length
      const match_rate = category_rows.length
        ? matched / category_rows.length
        : 0
      report.push({
        season_year: entry.season_year,
        label,
        fetched: category_rows.length,
        matched,
        match_rate,
        unmatched
      })
    }
  }

  const failures = []
  for (const line of report) {
    log(
      `  ${line.season_year} ${line.label}: matched ${line.matched}/${line.fetched} (${(line.match_rate * 100).toFixed(1)}%)`
    )
    if (line.unmatched.length) {
      log(`    unmatched: ${line.unmatched.join(', ')}`)
    }
    if (line.match_rate < MINIMUM_MATCH_RATE) {
      failures.push(
        `${line.season_year} ${line.label} match rate ${(line.match_rate * 100).toFixed(1)}% below ${(MINIMUM_MATCH_RATE * 100).toFixed(1)}% (${line.matched} of ${line.fetched})`
      )
    }
  }
  if (failures.length) {
    throw new Error(`ORACLE FAIL (matching): ${failures.join('; ')}`)
  }

  return report
}

const observed_at_of = (timestamp) =>
  new Date(
    `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`
  )

const backfill = async ({
  dry_run = false,
  emit_path = null,
  from_path = null
} = {}) => {
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
      `emitted ${resolved.length} season(s) to ${emit_path} -- nothing written to the database, and no player matching attempted (that needs the database)`
    )
    return { resolved }
  }

  const match_report = await match_players(resolved)

  const inserts = resolved.flatMap(({ season_year, timestamp, rows }) => {
    // The capture time IS the observation time. That is what makes these rows
    // beat the weeks-1-2 rows on any latest-observation reading, and what makes
    // the post-season constraint meaningful rather than cosmetic.
    const observed_at = observed_at_of(timestamp)
    return rows.map((row) => ({
      pid: row.pid,
      player_name: row.player_name,
      espn_player_id: row.espn_player_id,
      nfl_team: row.nfl_team,
      line_win_count: row.line_win_count,
      total_plays: row.total_plays,
      win_rate: row.win_rate,
      double_team_percentage: row.double_team_percentage,
      espn_win_rate_type: row.espn_win_rate_type,
      observed_at,
      season_year
    }))
  })

  const seasons = resolved.map((entry) => entry.season_year)
  log(
    `resolved ${resolved.length} season(s), ${inserts.length} player rows: ${resolved.map((entry) => `${entry.season_year}@${entry.timestamp}`).join(', ')}`
  )

  if (dry_run) {
    log('dry run -- nothing written')
    for (const line of match_report) {
      log(
        `  ${line.season_year} ${line.label}: ${line.matched}/${line.fetched} matched`
      )
    }
    return { resolved, inserts, match_report }
  }

  // Delete and insert in ONE transaction. Between a bare delete and a bare
  // insert the season would hold zero rows, and a failure in that window leaves
  // the data worse than it started -- the partial at least had something.
  await db.transaction(async (trx) => {
    // History is APPENDED, never cleared. The weeks-1-2 rows record what ESPN
    // published on those dates, which remains true.
    await trx('espn_player_win_rates_history')
      .insert(inserts)
      .onConflict([
        'player_name',
        'espn_player_id',
        'espn_win_rate_type',
        'observed_at'
      ])
      .merge()

    // The index claims to describe a SEASON, so the season is replaced whole.
    // A merge would leave the ~60 week-2-only players behind. See the header.
    const deleted = await trx('espn_player_win_rates_index')
      .whereIn('season_year', seasons)
      .del()
    log(`deleted ${deleted} existing index row(s) for ${seasons.join(', ')}`)

    await trx('espn_player_win_rates_index').insert(inserts)
    log(`inserted ${inserts.length} index row(s)`)
  })

  // Read the state back. The write reported no error, which is not the same as
  // the rows being there and being what was intended.
  const written = await db('espn_player_win_rates_index')
    .select('season_year', 'espn_win_rate_type')
    .count('* as row_count')
    .count('pid as matched_count')
    .min('total_plays as min_plays')
    .max('win_rate as max_rate')
    .whereIn('season_year', seasons)
    .groupBy('season_year', 'espn_win_rate_type')
    .orderBy(['season_year', 'espn_win_rate_type'])

  const shortfalls = []
  for (const season_year of seasons) {
    for (const category of CATEGORIES) {
      const row = written.find(
        (candidate) =>
          Number(candidate.season_year) === season_year &&
          candidate.espn_win_rate_type === category.espn_win_rate_type
      )
      if (!row) {
        shortfalls.push(
          `${season_year} ${category.espn_win_rate_type} has no rows`
        )
        continue
      }
      const count = Number(row.row_count)
      if (count !== category.expected_rows) {
        shortfalls.push(
          `${season_year} ${category.espn_win_rate_type} holds ${count} row(s), expected ${category.expected_rows}`
        )
      }
      // Read the partial-sample rule back off the table, because a merge or a
      // stray surviving row is exactly what this would catch.
      if (Number(row.min_plays) < 100) {
        shortfalls.push(
          `${season_year} ${category.espn_win_rate_type} holds a row with only ${row.min_plays} plays -- an in-season partial survived the replacement`
        )
      }
      console.log(
        `  ${season_year} ${category.espn_win_rate_type}: ${count} rows, ${row.matched_count} matched to a pid, min plays ${row.min_plays}, max rate ${row.max_rate}`
      )
    }
  }

  if (shortfalls.length)
    throw new Error(`ORACLE FAIL: ${shortfalls.join('; ')}`)
  console.log(
    `ORACLE PASS: ${seasons.join(' and ')} each hold 40/40/20/20 player rows, every row from a post-season capture`
  )

  return { resolved, inserts, match_report }
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
