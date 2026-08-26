// STATUS: APPLIED 2026-08-26 against league_production (229 index rows deleted,
// 121 written, 121 of 121 matched to a pid, one observation per category,
// oracle PASS)
//
// 2026-08-26: Rebuild the 2025 PLAYER win-rate index from the final published
// leaderboard, replacing a season that is a union of four different in-season
// snapshots.
//
// THE DEFECT IS THE ONE ALREADY REPAIRED FOR 2024, LEFT LIVE IN 2025.
// `espn_player_win_rates_index` is keyed (player_name, espn_player_id,
// espn_win_rate_type, season_year) and the importer merges into it, so a season
// accumulates every player who ever led it rather than describing one
// observation. For 2025 that left 229 rows sourced from four separate runs:
//
//   2025-09-26   26 rows still sourced from it, average 42 plays
//   2025-10-01   58 rows, average 72 plays
//   2025-12-16   37 rows, average 208 plays
//   2026-03-15  108 rows, average 276 plays
//
// So 84 of 229 rows are partial-season figures wearing a 2025 label -- Nick
// Bosa's 2025 pass rush reads 0.22 over 36 plays. It also explains the row
// counts, 68/77/42/42 against the 41/40/20/20 ESPN actually publishes: a player
// who led in September and fell off is never removed.
//
// AND THE FINAL OBSERVATION WAS ITSELF SHORT. The 2026-03-15 run wrote 108 rows
// against the 121 on the page, because the importer DROPPED any player it could
// not resolve to a pid. That drop is fixed in scripts/import-espn-line-win-rates.mjs
// in this same change, and the 22 identity links behind it have been attached to
// the player rows, so this rebuild resolves all 121.
//
// HISTORY IS NOT DELETED. `espn_player_win_rates_history` is keyed on
// observed_at and the in-season rows are an HONEST record -- they say "on
// 2025-10-01 ESPN's leaderboard looked like this", which is true. Only the
// index, which claims to describe a SEASON, is rewritten.
//
// WHY THE LIVE PAGE IS THE SOURCE, AND NOT AN ARCHIVE CAPTURE. The 2023 and
// 2024 rebuilds had to reach Wayback because those articles are years stale. The
// 2025 article is the one `espn_line_win_rates_url` still points at, the 2025
// season is over, and the page carries its final numbers. The Win Rates 2.0
// restatement is NOT a hazard here, contrary to what it looked like: 2.0
// restates 2025 figures inside its own write-up (id/49672562, which puts Nick
// Herbig's edge pass rush at 14.3%), but the 2025 LEADERBOARD article still
// serves the 1.0 numbers -- Herbig 45/180/25%, exactly as stored. Verified
// against the page before this was written, and asserted every run by the
// cross-check below.
//
// THE CROSS-CHECK IS THE STORED MARCH OBSERVATION, WHICH IS BETTER THAN A SECOND
// CAPTURE. The 2023/2024 rebuilds corroborated one Wayback capture against
// another, which establishes only that the bytes were complete. Here the
// comparison is against 108 rows captured five months earlier by different code
// -- an independent observation of the same frozen page. If the live page has
// been restated under 2.0, or reparsed wrong, those rows disagree and this
// refuses to run. That is the rule that makes "the page is final" checkable
// rather than assumed.
//
// RUN IN TWO HALVES, BECAUSE ESPN NOW BLOCKS THE LEAGUE HOST. espn.com answers
// the workstation normally and returns 403 to the league host on every route
// tried -- global fetch, fetch-h2, and curl with full browser headers -- so it
// is an address-level block, not a User-Agent check. Production postgres is
// reachable only from the host. So the same split the archive backfills used,
// for a different reason: the emit half fetches, parses and grades the PUBLISHED
// rows, and the from half re-grades them, corroborates them against what is
// already stored, resolves pids and writes.
//
// This block is also a live defect in the importer itself, which fetches this
// same URL from the host every week and will 403 on its first fetching run of
// 2026. Recorded on the task; out of scope here.
//
//   workstation:  node db/adhoc/2026-08-26-repair-espn-player-win-rates-2025.mjs --emit /tmp/espn-player-2025.json
//   league host:  NODE_ENV=production node db/adhoc/2026-08-26-repair-espn-player-win-rates-2025.mjs --from /tmp/espn-player-2025.json [--dry]

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as cheerio from 'cheerio'
import { fetch as fetch_http2 } from 'fetch-h2'
import { readFile, writeFile } from 'fs/promises'

import { fixTeam } from '#libs-shared'

// The database and the player cache are imported LAZILY, inside the two
// functions that need them. Both pull `#db`, which reads `config-<NODE_ENV>` at
// module load and throws if it is unset -- and the emit half runs on a
// workstation that has no production config and needs no database. A top-level
// import would make the fetch half require credentials it never uses.
const load_db = async () => (await import('#db')).default
const load_player_cache = async () =>
  await import('#libs-server/player-cache.mjs')

const log = debug('repair-espn-player-win-rates-2025')
debug.enable('repair-espn-player-win-rates-2025')

const SEASON_YEAR = 2025

const ARTICLE_URL =
  'https://www.espn.com/nfl/story/_/id/46138675/2025-nfl-win-rates-top-teams-players-rankings-pass-run-block'

// The observation this run is corroborated against: the last full-season capture
// the importer took, five months before this rebuild.
const CORROBORATING_OBSERVATION = '2026-03-15'

// The eight player tables, in page order, paired into the four categories the
// enum uses. Two tables per category -- ESPN publishes an edge/tackle table and
// an interior table for each. `token` is asserted against the rate column header
// so a re-ordered page fails loudly rather than filing pass rushers as run
// blockers, matched as a PREFIX because the DT run-stop table heads "RSWRate"
// while the others use the bare four-letter form.
//
// Row counts are a RANGE, not an equality. ESPN publishes a fixed top-N per
// table but prints every player tied at the cutoff, so a category runs a little
// over its nominal size -- the 2025 interior pass-rush table carries 21 rows
// against a nominal 20. An equality here would reject a sound page for a tie.
// The floor is what matters; the ceiling only catches a table that ran away.
const CATEGORIES = [
  {
    espn_win_rate_type: 'PASS_RUSH',
    table_indexes: [0, 1],
    token: 'PRWR',
    minimum_rows: 40,
    maximum_rows: 48
  },
  {
    espn_win_rate_type: 'PASS_BLOCK',
    table_indexes: [2, 3],
    token: 'PBWR',
    minimum_rows: 40,
    maximum_rows: 48
  },
  {
    espn_win_rate_type: 'RUN_STOP',
    table_indexes: [4, 5],
    token: 'RSWR',
    minimum_rows: 20,
    maximum_rows: 28
  },
  {
    espn_win_rate_type: 'RUN_BLOCK',
    table_indexes: [6, 7],
    token: 'RBWR',
    minimum_rows: 20,
    maximum_rows: 28
  }
]

// Index 8 is the team leaderboard, already correct and not touched here.
// Asserted so a page with a different number of tables -- which is how a table
// being added or dropped presents -- fails before any index is dereferenced.
const EXPECTED_TABLE_COUNT = 9

// THE PARTIAL-SAMPLE ORACLE, and the rule the whole script exists to enforce.
// Measured on the final tables and on the rows being replaced:
//
//   final season tables    median total_plays 198-352
//   the in-season rows     median total_plays  37-87
//
// Two orders of magnitude apart, so 150 sits in open space. The MEDIAN rather
// than the minimum, because ESPN's qualifying threshold has moved between
// seasons and one lightly-used player should not fail an otherwise full season.
const MINIMUM_MEDIAN_PLAYS = 150

// Deliberately looser than the observed range: the job is to catch a
// decimal-place error, not to police a distribution. Pass block runs to 0.98.
const MINIMUM_PLAUSIBLE_RATE = 0.05
const MAXIMUM_PLAUSIBLE_RATE = 1.0

const parse_percentage = (text) => {
  // The fractional part is not optional decoration: /(\d+)%/ against "62.5%"
  // matches the trailing "5%" and yields 0.05 -- a well-formed number off by a
  // factor of ten that no count or fill-rate rule can see.
  const match = String(text).match(/(\d+(?:\.\d+)?)%/)
  return match ? parseFloat(match[1]) / 100 : null
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// fetch-h2, the same client the live importer uses, and not global fetch. ESPN
// answers a plain HTTP/1.1 fetch from the league host with 403 -- verified, it
// is not a transient. The importer has always reached this page over HTTP/2, so
// matching it is what makes this script runnable where the database is.
const fetch_article = async () => {
  const response = await fetch_http2(ARTICLE_URL)
  if (!response.ok)
    throw new Error(`http ${response.status} fetching the article`)
  return await response.text()
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
        // espn_player_id is NOT NULL on both tables and is the primary matching
        // key, so a row without one is not writable. This raises rather than
        // skipping: a page that stopped linking players is a restructure worth
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

// Completeness oracle, graded PER CATEGORY. That grain is not decoration:
// RUN_STOP and RUN_BLOCK publish 20 rows against PASS_RUSH's 41, so either could
// collapse and an aggregate floor across all four would still look healthy.
const grade_capture = (rows) => {
  const failures = []

  for (const category of CATEGORIES) {
    const label = category.espn_win_rate_type
    const category_rows = rows.filter((row) => row.espn_win_rate_type === label)

    if (
      category_rows.length < category.minimum_rows ||
      category_rows.length > category.maximum_rows
    ) {
      failures.push(
        `${label} carries ${category_rows.length} row(s), expected ${category.minimum_rows}-${category.maximum_rows}`
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

    // The rule that separates a season from an in-season snapshot wearing a
    // season label, which is the defect being repaired.
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

    // The published rate must agree with wins/plays. An INTERNAL cross-check
    // that needs no second source: ESPN prints all three and they have to be
    // consistent, so it catches a rate read from the wrong cell even when the
    // value looks plausible. Tolerance is one point, the published rounding.
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

  if (failures.length) {
    throw new Error(`ORACLE FAIL (capture): ${failures.join('; ')}`)
  }
  log(`capture graded OK: ${rows.length} player rows across 4 categories`)
}

// Corroborate the live page against the last full-season observation already on
// disk. This is what makes "the page carries its final numbers" a checked claim
// rather than an assumption -- and it is the rule that would fire if ESPN ever
// restates this leaderboard under Win Rates 2.0.
const cross_check_against_stored_observation = async (rows) => {
  const db = await load_db()
  const stored = await db('espn_player_win_rates_history')
    .select(
      'espn_win_rate_type',
      'espn_player_id',
      'player_name',
      'line_win_count',
      'total_plays',
      'win_rate'
    )
    .where({ season_year: SEASON_YEAR })
    .whereRaw('observed_at::date = ?', [CORROBORATING_OBSERVATION])

  if (!stored.length) {
    throw new Error(
      `no stored ${SEASON_YEAR} observation on ${CORROBORATING_OBSERVATION} to corroborate against -- refusing to rebuild a season from a single unchecked read`
    )
  }

  const key_of = (row) => `${row.espn_win_rate_type}:${row.espn_player_id}`
  const live_by_key = new Map(rows.map((row) => [key_of(row), row]))

  const failures = []
  let compared = 0
  for (const stored_row of stored) {
    const live = live_by_key.get(key_of(stored_row))
    // The stored observation is a SUBSET of the page -- it dropped the players
    // it could not match -- so a stored row missing from the live page is a real
    // disagreement, while a live row missing from stored is expected.
    if (!live) {
      failures.push(
        `${stored_row.player_name} (${key_of(stored_row)}) is in the ${CORROBORATING_OBSERVATION} observation but absent from the page now`
      )
      continue
    }
    compared++
    for (const key of ['win_rate', 'line_win_count', 'total_plays']) {
      if (Math.abs(Number(live[key]) - Number(stored_row[key])) > 0.0001) {
        failures.push(
          `${stored_row.player_name} ${key}: the page says ${live[key]}, the ${CORROBORATING_OBSERVATION} observation says ${stored_row[key]}`
        )
      }
    }
  }

  if (failures.length) {
    throw new Error(
      `ORACLE FAIL (corroboration): the live page disagrees with the ${CORROBORATING_OBSERVATION} observation on ${failures.length} point(s) -- suspect a restatement, which would mean these numbers are not comparable with the seasons already stored: ${failures.slice(0, 6).join('; ')}`
    )
  }
  log(
    `corroborated: the page agrees with all ${compared} row(s) of the ${CORROBORATING_OBSERVATION} observation`
  )
}

// Resolve every published row to a pid. Roster-status filters are OFF: an exact
// ESPN-id match is identity, and whether a player is currently rostered has
// nothing to do with whether this row is about them.
//
// NO MATCH-RATE THRESHOLD. A floor is a decision to keep losing whoever falls
// under it. Every published row must resolve, and any that does not fails the
// run by name so the identity link gets attached instead of the player being
// quietly dropped for another season.
const match_players = async (rows) => {
  const { preload_active_players, find_player } = await load_player_cache()
  await preload_active_players({ all_players: true })
  log('player cache initialized with all players (retired included)')

  const unmatched = []
  for (const row of rows) {
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
    row.pid = player ? player.pid : null
    if (!player) {
      unmatched.push(
        `${row.player_name} (${row.nfl_team}, espn ${row.espn_player_id}, ${row.espn_win_rate_type})`
      )
    }
  }

  log(`matched ${rows.length - unmatched.length}/${rows.length} published rows`)
  if (unmatched.length) {
    throw new Error(
      `ORACLE FAIL (matching): ${unmatched.length} published player(s) did not resolve to a pid -- attach their espn_player_id and re-run: ${unmatched.join(', ')}`
    )
  }
}

const repair = async ({
  dry_run = false,
  emit_path = null,
  from_path = null
} = {}) => {
  let rows
  if (from_path) {
    const payload = JSON.parse(await readFile(from_path, 'utf8'))
    if (payload.season_year !== SEASON_YEAR) {
      throw new Error(
        `payload covers season ${payload.season_year}, expected ${SEASON_YEAR}`
      )
    }
    if (payload.article_url !== ARTICLE_URL) {
      throw new Error(
        `payload was fetched from ${payload.article_url}, expected ${ARTICLE_URL}`
      )
    }
    rows = payload.rows
    log(
      `loaded payload emitted ${payload.generated_at} carrying ${rows.length} row(s)`
    )
  } else {
    const html = await fetch_article()
    log(`fetched ${html.length} bytes from the ${SEASON_YEAR} article`)
    rows = parse_player_tables(html)
  }

  // Graded in BOTH halves. The emitting run already graded it, but a file is an
  // input like any other -- stale, hand-edited, or from a different article --
  // and the point of an oracle is that nothing reaches the table ungraded.
  grade_capture(rows)

  if (emit_path) {
    await writeFile(
      emit_path,
      `${JSON.stringify({ generated_at: new Date().toISOString(), season_year: SEASON_YEAR, article_url: ARTICLE_URL, rows }, null, 2)}\n`
    )
    log(
      `emitted ${rows.length} row(s) to ${emit_path} -- nothing written to the database, and no player matching attempted (that needs the database)`
    )
    return { rows }
  }

  await cross_check_against_stored_observation(rows)
  await match_players(rows)

  const db = await load_db()

  // The read time IS the observation time. That is what makes these rows beat
  // every in-season row on any latest-observation reading.
  const observed_at = new Date()
  const inserts = rows.map((row) => ({
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
    season_year: SEASON_YEAR
  }))

  for (const category of CATEGORIES) {
    const count = inserts.filter(
      (row) => row.espn_win_rate_type === category.espn_win_rate_type
    ).length
    log(`  ${category.espn_win_rate_type}: ${count} row(s)`)
  }

  if (dry_run) {
    log(
      `dry run -- ${inserts.length} row(s) would replace the ${SEASON_YEAR} index, nothing written`
    )
    return { inserts }
  }

  // Delete and insert in ONE transaction. Between a bare delete and a bare
  // insert the season holds zero rows, and a failure in that window leaves the
  // data worse than it started -- the partial at least had something.
  await db.transaction(async (trx) => {
    // History is APPENDED, never cleared. The in-season rows record what ESPN
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

    // The index claims to describe a SEASON, so the season is replaced whole. A
    // merge would leave the ~108 in-season-only players behind with their
    // partial numbers -- a half-replaced season, which is worse than either
    // state alone because it looks repaired.
    const deleted = await trx('espn_player_win_rates_index')
      .where({ season_year: SEASON_YEAR })
      .del()
    log(`deleted ${deleted} existing index row(s) for ${SEASON_YEAR}`)

    await trx('espn_player_win_rates_index').insert(inserts)
    log(`inserted ${inserts.length} index row(s)`)
  })

  // Read the state back. The write reported no error, which is not the same as
  // the rows being there and being what was intended.
  const written = await db('espn_player_win_rates_index')
    .select('espn_win_rate_type')
    .count('* as row_count')
    .count('pid as matched_count')
    .min('total_plays as min_plays')
    .max('win_rate as max_rate')
    .countDistinct('observed_at as observation_count')
    .where({ season_year: SEASON_YEAR })
    .groupBy('espn_win_rate_type')
    .orderBy('espn_win_rate_type')

  const shortfalls = []
  for (const category of CATEGORIES) {
    const row = written.find(
      (candidate) =>
        candidate.espn_win_rate_type === category.espn_win_rate_type
    )
    if (!row) {
      shortfalls.push(`${category.espn_win_rate_type} has no rows`)
      continue
    }
    const count = Number(row.row_count)
    if (count < category.minimum_rows || count > category.maximum_rows) {
      shortfalls.push(
        `${category.espn_win_rate_type} holds ${count} row(s), expected ${category.minimum_rows}-${category.maximum_rows}`
      )
    }
    if (Number(row.matched_count) !== count) {
      shortfalls.push(
        `${category.espn_win_rate_type} holds ${count - Number(row.matched_count)} row(s) with no pid`
      )
    }
    // Read the partial-sample rule back off the TABLE. A stray surviving row is
    // exactly what this catches, and it is the whole point of the rebuild.
    if (Number(row.min_plays) < 100) {
      shortfalls.push(
        `${category.espn_win_rate_type} holds a row with only ${row.min_plays} plays -- an in-season partial survived the replacement`
      )
    }
    // One season, one observation. The defect being repaired was precisely a
    // season stitched from several, so assert it cannot have happened again.
    if (Number(row.observation_count) !== 1) {
      shortfalls.push(
        `${category.espn_win_rate_type} is sourced from ${row.observation_count} different observations, expected exactly 1`
      )
    }
    console.log(
      `  ${category.espn_win_rate_type}: ${count} rows, ${row.matched_count} matched to a pid, min plays ${row.min_plays}, max rate ${row.max_rate}, ${row.observation_count} observation`
    )
  }

  if (shortfalls.length)
    throw new Error(`ORACLE FAIL: ${shortfalls.join('; ')}`)
  console.log(
    `ORACLE PASS: ${SEASON_YEAR} player win rates rebuilt from one post-season observation, every row matched to a pid`
  )

  return { inserts }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).argv
    await repair({
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
