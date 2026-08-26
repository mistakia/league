// STATUS: APPLIED 2026-08-26 against league_production (64 team rows, oracle PASS)
//
// 2026-08-26: Backfill ESPN team line win rates for 2018 and 2019 -- the two
// seasons that exist upstream and were still missing after the 2020-2024
// backfill (db/adhoc/2026-08-25-backfill-espn-team-win-rates-2020-2024.mjs).
//
// RUN BLOCK AND RUN STOP ARE WRITTEN NULL, AND THAT IS THE POINT.
//
// ESPN launched Pass Block Win Rate and Pass Rush Win Rate in September 2018.
// Run Block Win Rate and Run Stop Win Rate did not exist until 2020. Both source
// articles confirm this in their own markup rather than by assertion: the 2018
// article carries exactly two leaderboard tables, headed PBWR and PRWR, and the
// 2019 article carries exactly two team sections, "Team Pass Rush Win Rate" and
// "Team Pass Block Win Rate". There is no third or fourth metric to parse.
//
// So NULL is the canonical value for those two columns in these two seasons --
// not a gap to be filled later, and specifically not a copy of pass block. The
// supplied reference spreadsheet does exactly that: its run-block column is a
// verbatim duplicate of its pass-block column for 2019-2022, which is why the
// prior backfill rejected that column for four seasons. `assert_no_run_metrics`
// below is the guard that stops this script from reintroducing the same defect,
// and it is asserted on the rows rather than left to this comment.
//
// SOURCES. One capture per season, each fetched through the `id_` form so
// Wayback returns the original bytes without its toolbar.
//
//   2019  id/27584726  text lists under <h2>, the same shape as 2020-2022
//   2018  id/26888038  two `table.inline-table` elements, two team/value PAIRS
//                      per row
//
// THREE PARSE HAZARDS, each verified against the captures rather than assumed:
//
//   1. The 2018 team tables are NOT the last `inline-table`. They sit at indexes
//      4 and 5 of six; indexes 0-3 are correlation summaries whose rows read
//      ["Expected points added/play", "0.40", "0.15"] and ["2018", "0.69",
//      "0.69"]. A last-table parser -- which is exactly what the 2020-2024
//      backfill uses for 2023+ -- silently returns pass rush only and never sees
//      pass block. The indexes are declared per season AND the header row is
//      asserted, so a re-ordered page fails loudly instead of parsing a
//      correlation table as a leaderboard.
//
//   2. The 2018 rows carry TWO team/value pairs each: 17 rows, a header plus 16,
//      holding ranks N and N+16 side by side ("1. Rams | 62% | 17. Steelers |
//      48%"). Reading only the first pair yields a plausible-looking 16-team
//      table.
//
//   3. `fixTeam` THROWS on "Bucs". The 2018 tables use bare nicknames and 31 of
//      32 resolve; that one does not, and fixTeam raises rather than returning
//      null, so an unhandled name aborts the run instead of being skipped. The
//      override is LOCAL to this script on purpose -- "Bucs" is 2018 ESPN
//      article styling, not a league-wide alias, and the shared map in
//      libs-shared should not grow a synonym to serve one adhoc backfill.
//
// A 2019 CAPTURE MUST BE POST-SEASON, and this is not a formality. The 2019
// article is a LIVE-UPDATED page: Wayback holds captures from 2019-10, 2019-11
// and 2019-12, and each carries that week's partial-season numbers under the
// same "2019 season" headline. Loading one would reproduce, exactly, the defect
// this cluster has already been bitten by twice -- the 2024 team rows and the
// 2024 player rows were both a weeks-1-2 sample wearing a season label.
// `MINIMUM_POST_SEASON_TIMESTAMP` rejects any capture taken before the 2019
// season ended, and `cross_check_captures` requires two independent post-season
// captures to agree on all 32 teams before either is trusted.
//
// RUN. The archive and the database are not reachable from the same machine:
// web.archive.org serves a workstation and returns 429 to the league host, while
// production postgres is reachable only from the host. Two halves, each running
// the full oracle, so the payload is transport rather than a trusted input:
//
//   workstation:  node db/adhoc/2026-08-26-backfill-espn-team-win-rates-2018-2019.mjs --emit /tmp/espn-team-2018-2019.json
//   league host:  NODE_ENV=production node db/adhoc/2026-08-26-backfill-espn-team-win-rates-2018-2019.mjs --from /tmp/espn-team-2018-2019.json [--dry]

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as cheerio from 'cheerio'
import { readFile, writeFile } from 'fs/promises'

import db from '#db'
import { fixTeam } from '#libs-shared'

const log = debug('backfill-espn-team-win-rates-2018-2019')
debug.enable('backfill-espn-team-win-rates-2018-2019')

// Only the two metrics that existed. The other two columns are written null --
// see the header, and see assert_no_run_metrics.
const METRICS = [
  { key: 'pass_rush_win_rate', heading: 'pass rush', token: 'PRWR' },
  { key: 'pass_block_win_rate', heading: 'pass block', token: 'PBWR' }
]

// The columns ESPN had not invented yet. Asserted null on every row.
const ABSENT_METRICS = ['run_stop_win_rate', 'run_block_win_rate']

const EXPECTED_TEAM_COUNT = 32

// A capture taken before this instant cannot carry that season's final numbers.
// Both are the day after the season's Super Bowl.
const MINIMUM_POST_SEASON_TIMESTAMP = {
  2018: '20190204', // Super Bowl LIII, 2019-02-03
  2019: '20200203' // Super Bowl LIV, 2020-02-02
}

const ARCHIVE_CAPTURES = {
  2018: {
    url: 'https://www.espn.com/nfl/story/_/id/26888038/pass-blocking-matters-more-pass-rushing-prove-it',
    // A June 2019 retrospective on the 2018 regular season, so every capture of
    // it is post-season by construction. Two are declared because two
    // independent captures agreeing is what licenses trusting either.
    timestamps: ['20190608161414', '20190608231120', '20190609163957'],
    parser: 'pair_tables',
    // Declared rather than discovered: indexes 0-3 are correlation summaries.
    table_indexes: { pass_block_win_rate: 4, pass_rush_win_rate: 5 }
  },
  2019: {
    url: 'https://www.espn.com/nfl/story/_/id/27584726/nfl-pass-blocking-pass-rushing-rankings-2019-pbwr-prwr-leaderboard',
    // Post-season only. Wayback also holds 20191009, 20191111 and 20191218
    // captures of this same article, each a partial-season snapshot; those are
    // excluded by MINIMUM_POST_SEASON_TIMESTAMP and the exclusion is asserted.
    timestamps: ['20200211023035', '20200320185230', '20200327113548'],
    parser: 'text_sections'
  }
}

// 2018 ESPN article styling, not a league alias. fixTeam raises on this one and
// resolves the other 31 nicknames; keeping the override here rather than in
// libs-shared keeps a one-article quirk out of the shared map.
const LOCAL_NICKNAMES = { Bucs: 'TB' }

const normalize_team = (raw_name) => {
  const name = String(raw_name || '').trim()
  if (!name) return null
  if (LOCAL_NICKNAMES[name]) return LOCAL_NICKNAMES[name]
  try {
    return fixTeam(name)
  } catch (err) {
    // fixTeam THROWS on an unknown name rather than returning null. Converting
    // it to null here would silently drop the team and leave a 31-team season
    // that the completeness rule then reports as a count failure with no
    // indication of which name broke -- so surface the name.
    throw new Error(`unresolvable team name "${name}": ${err.message}`)
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Wayback throttles a burst by refusing the connection outright rather than
// answering 429, so back off generously and treat transport failure as
// retryable. A capture that returns bytes but parses short is NOT retried here;
// that is the truncated-capture case and the caller moves to the next timestamp.
//
// `--compressed` matters: Wayback serves gzip, and a response read without it
// looks exactly like a truncated capture, which cost a wrong diagnosis once.
// Node's fetch sets accept-encoding and decodes transparently, which is the
// equivalent.
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

// 2018. Two leaderboard tables at DECLARED indexes, each row carrying two
// team/value pairs. The header is asserted rather than trusted so that a
// re-ordered page fails here instead of parsing a correlation summary as a
// leaderboard.
const parse_pair_tables = (html, { table_indexes }) => {
  const $ = cheerio.load(html)
  const tables = $('table.inline-table')
  const parsed = {}

  for (const metric of METRICS) {
    const index = table_indexes[metric.key]
    const table = tables.eq(index)
    if (!table.length) {
      throw new Error(
        `expected a table at inline-table index ${index} for ${metric.key}, found ${tables.length} table(s)`
      )
    }

    // ["Team", "PBWR", "Team", "PBWR"] -- if this is a correlation summary
    // instead, the header reads ["Season(s)", "PBWR", "PRWR"] and this fails.
    const header = table
      .find('tr')
      .eq(0)
      .find('th,td')
      .map((_, cell) => $(cell).text().trim())
      .get()
    const expected_header = ['Team', metric.token, 'Team', metric.token]
    if (
      header.join('|').toLowerCase() !== expected_header.join('|').toLowerCase()
    ) {
      throw new Error(
        `inline-table index ${index} header is [${header.join(', ')}], expected [${expected_header.join(', ')}] for ${metric.key}`
      )
    }

    for (const row of table.find('tr').get()) {
      const cells = $(row)
        .find('td')
        .map((_, cell) => $(cell).text().trim())
        .get()
      // Four cells: rank+team, value, rank+team, value. The header row has no
      // <td> at all in this markup, so it drops out here.
      if (cells.length < 4) continue
      for (const [name_cell, value_cell] of [
        [cells[0], cells[1]],
        [cells[2], cells[3]]
      ]) {
        const name_match = String(name_cell).match(/^\s*\d+\.\s*(.+)$/)
        const value_match = String(value_cell).match(/(\d+(?:\.\d+)?)%/)
        if (!name_match || !value_match) continue
        const nfl_team = normalize_team(name_match[1])
        parsed[nfl_team] = parsed[nfl_team] || {}
        parsed[nfl_team][metric.key] = parseFloat(value_match[1]) / 100
      }
    }
  }

  return parsed
}

// 2019. No tables: each metric is a plain-text ranked list under an <h2>,
// entries separated by <br>. Three things this must not assume, all inherited
// from the 2020-2022 parser that found them the hard way:
//   - HEADING CASE varies between seasons.
//   - RANKS ARE NOT MONOTONIC -- ties produce two 29ths and no 30th, so
//     anything keyed on a rank sequence drops a team.
//   - SECTION BOUNDS are the next <h2>, not a fixed window.
// It must also ignore the PLAYER sections on the same page ("Top 10 OT Pass
// Block Win Rate"), which is what the `team` prefix test does.
const parse_text_sections = (html) => {
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

    const text = $(heading)
      .nextUntil(headings[index + 1] || null)
      .toArray()
      .map((node) => $(node).html() || '')
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')

    for (const line of text.split('\n')) {
      const match = line.match(/^\s*\d+\.\s*(.+?),\s*(\d+(?:\.\d+)?)%/)
      if (!match) continue
      const nfl_team = normalize_team(match[1])
      parsed[nfl_team] = parsed[nfl_team] || {}
      parsed[nfl_team][metric.key] = parseFloat(match[2]) / 100
    }
  })

  return parsed
}

const PARSERS = {
  pair_tables: parse_pair_tables,
  text_sections: parse_text_sections
}

// Keep only teams carrying BOTH metrics, and stamp the two absent metrics null
// explicitly rather than letting them be absent keys. An absent key and a null
// column read the same from JavaScript but not from knex: an insert built from
// objects with missing keys writes DEFAULT, and the intent here is specifically
// a null.
const to_team_rows = (parsed) => {
  const rows = []
  for (const [nfl_team, values] of Object.entries(parsed)) {
    if (METRICS.some((metric) => values[metric.key] == null)) continue
    rows.push({
      nfl_team,
      pass_rush_win_rate: values.pass_rush_win_rate,
      pass_block_win_rate: values.pass_block_win_rate,
      run_stop_win_rate: null,
      run_block_win_rate: null
    })
  }
  return rows
}

// The guard that keeps this script from becoming the spreadsheet. Run block and
// run stop must be null on EVERY row -- not merely absent, and specifically not
// equal to pass block or pass rush.
const assert_no_run_metrics = ({ season_year, rows }) => {
  const failures = []
  for (const key of ABSENT_METRICS) {
    const populated = rows.filter((row) => row[key] != null)
    if (populated.length) {
      failures.push(
        `${season_year}: ${key} is populated on ${populated.length} row(s) -- that metric did not exist before 2020 and must be null`
      )
    }
  }
  return failures
}

// Completeness oracle for one capture. A 200 with bytes is not evidence: some
// captures are a shell with no article body, and a partial parse is exactly what
// writes a half-populated season nobody notices.
const grade_capture = ({ season_year, rows }) => {
  const failures = [...assert_no_run_metrics({ season_year, rows })]
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
    // Fill rate. `to_team_rows` drops incomplete rows at parse time, but a
    // payload loaded from disk has not been through it, and every rule below
    // this point operates on the non-null values only -- so a row carrying a
    // null rate sails through the count, range and distinctness checks and is
    // written as a team with no number. Caught by forcing exactly that case:
    // the other ten red cases fired and this one did not until the rule existed.
    if (values.length !== rows.length) {
      failures.push(
        `${metric.key} is populated on ${values.length} of ${rows.length} row(s) -- every team on this page carries every metric it published`
      )
    }
    const min = Math.min(...values)
    const max = Math.max(...values)
    // Range catches a percentage read at the wrong scale; distinctness catches a
    // sentinel or a dead cell. Neither is a distribution check -- the bound is
    // deliberately looser than the observed range.
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

// A capture taken during the season carries that week's partial numbers under
// the same headline as the final ones. This is the rule that separates them, and
// it is the only defense that would have caught the 2024 partial before it was
// written.
const assert_post_season = ({ season_year, timestamp }) => {
  const floor = MINIMUM_POST_SEASON_TIMESTAMP[season_year]
  if (!floor)
    throw new Error(`no post-season floor declared for ${season_year}`)
  if (String(timestamp).slice(0, 8) < floor) {
    throw new Error(
      `${season_year} capture ${timestamp} predates ${floor} -- an in-season capture of a live-updated article carries a partial-season sample, not final numbers`
    )
  }
}

// Two independent captures of the same article must agree on every team and both
// metrics. This is the cross-check that IS available for these two seasons: the
// reference spreadsheet carries no run-block column worth trusting and its 2018
// row does not exist at all, so there is no second PUBLISHER to check against.
// Two captures months apart agreeing proves the page was frozen and the bytes
// are complete -- it does not prove ESPN's arithmetic, and this comment is the
// place that says so rather than the report implying a check that was not run.
const cross_check_captures = ({ season_year, primary, secondary }) => {
  const failures = []
  const by_team = Object.fromEntries(
    secondary.rows.map((row) => [row.nfl_team, row])
  )

  for (const row of primary.rows) {
    const other = by_team[row.nfl_team]
    if (!other) {
      failures.push(
        `${row.nfl_team} present in ${primary.timestamp} but absent from ${secondary.timestamp}`
      )
      continue
    }
    for (const metric of METRICS) {
      if (Math.abs(row[metric.key] - other[metric.key]) > 0.0001) {
        failures.push(
          `${row.nfl_team} ${metric.key}: ${primary.timestamp} says ${row[metric.key]}, ${secondary.timestamp} says ${other[metric.key]}`
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
  const parse = PARSERS[capture.parser]
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
      rows = to_team_rows(parse(html, capture))
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
      `  ${timestamp} accepted: ${rows.length} teams, both metrics, run columns null`
    )
    accepted.push({ timestamp, rows })
    // Two agreeing captures is the whole cross-check; a third buys nothing and
    // costs another request against a host that throttles hard.
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
    `  ${season_year}: captures ${accepted[0].timestamp} and ${accepted[1].timestamp} agree on ${compared} team(s), both metrics`
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
      `  ${season_year}@${timestamp} regraded OK: ${rows.length} teams, corroborated by ${corroborating_timestamp}, run columns null`
    )
  }
}

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
      `emitted ${resolved.length} season(s) to ${emit_path} -- nothing written to the database`
    )
    return { resolved }
  }

  // Every season resolved before anything is written. A backfill that writes as
  // it goes leaves a half-done state behind on the season that fails.
  const inserts = resolved.flatMap(({ season_year, timestamp, rows }) => {
    // The capture time IS the observation time. That is what makes these rows
    // lose correctly to any later observation under the index's
    // latest-observation rule, and what makes the post-season constraint
    // meaningful rather than cosmetic.
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
      log(
        `  ${entry.season_year}: ${entry.rows
          .slice(0, 3)
          .map(
            (row) =>
              `${row.nfl_team} pb=${row.pass_block_win_rate} pr=${row.pass_rush_win_rate} rb=${row.run_block_win_rate} rs=${row.run_stop_win_rate}`
          )
          .join(', ')}`
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
  // the rows being there and being what was intended -- and for this backfill
  // the intent includes two columns being EMPTY, which no insert-side check can
  // confirm.
  const seasons = Object.keys(ARCHIVE_CAPTURES).map(Number)
  const written = await db('espn_team_win_rates_index')
    .select('season_year')
    .count('* as team_count')
    .countDistinct('nfl_team as distinct_teams')
    .count('pass_block_win_rate as pass_block_filled')
    .count('pass_rush_win_rate as pass_rush_filled')
    .count('run_block_win_rate as run_block_filled')
    .count('run_stop_win_rate as run_stop_filled')
    .min('pass_block_win_rate as min_pass_block')
    .max('pass_block_win_rate as max_pass_block')
    .whereIn('season_year', seasons)
    .groupBy('season_year')
    .orderBy('season_year')

  const shortfalls = []
  for (const row of written) {
    const count = Number(row.team_count)
    if (count !== EXPECTED_TEAM_COUNT) {
      shortfalls.push(`${row.season_year} holds ${count} team row(s)`)
    }
    if (Number(row.distinct_teams) !== count) {
      shortfalls.push(
        `${row.season_year} holds ${count} row(s) covering ${row.distinct_teams} distinct team(s)`
      )
    }
    for (const [label, filled] of [
      ['pass_block_win_rate', row.pass_block_filled],
      ['pass_rush_win_rate', row.pass_rush_filled]
    ]) {
      if (Number(filled) !== count) {
        shortfalls.push(
          `${row.season_year} ${label} populated on ${filled} of ${count} row(s)`
        )
      }
    }
    // The null assertion, read back from the table. This is the one that would
    // catch a merge having carried a value in from somewhere else.
    for (const [label, filled] of [
      ['run_block_win_rate', row.run_block_filled],
      ['run_stop_win_rate', row.run_stop_filled]
    ]) {
      if (Number(filled) !== 0) {
        shortfalls.push(
          `${row.season_year} ${label} populated on ${filled} row(s) -- must be null for a season in which the metric did not exist`
        )
      }
    }
    console.log(
      `  ${row.season_year}: ${count} teams, pass block ${row.min_pass_block}-${row.max_pass_block}, run block/run stop null on all ${count}`
    )
  }

  const missing = seasons.filter(
    (season_year) =>
      !written.some((row) => Number(row.season_year) === season_year)
  )
  if (missing.length) shortfalls.push(`no rows for ${missing.join(', ')}`)

  if (shortfalls.length)
    throw new Error(`ORACLE FAIL: ${shortfalls.join('; ')}`)
  console.log(
    `ORACLE PASS: ${written.length} season(s) each holding ${EXPECTED_TEAM_COUNT} team rows, pass block and pass rush fully populated, run block and run stop null throughout`
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
