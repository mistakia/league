/*
  Standing audit: flag `player` rows whose identity fields contradict each other.

  A conflated row is what you get when a name match lands on the wrong
  same-named player and a writer then merges the two -- one row carrying one
  person's birth date and another person's `nfl_draft_year`, external ids split
  across both. It is expensive because `nfl_draft_year` is the input every
  downstream era check reads, so one bad merge corrupts the DETECTOR as well as
  the data: `CHRI-SMIT-007265` went 2014 -> 2023 from source `sleeper`, and the
  resulting row caused 245 correct play-stat identifiers to be NULLed by the era
  repair in 8f4292e08.

  Every previous instance of this was found by a data-loss incident. This exists
  so the next one surfaces on its own.

  ## Three independent falsifiers

  None is trusted alone, and they are reported separately rather than summed,
  because they fail in different directions and a row tripping two of them is a
  much stronger finding than a row tripping one.

    age            `nfl_draft_year` against `date_of_birth`. Entering the league
                   before 20 or after 30 is not impossible, but it is rare
                   enough to be worth reading: 50 of 25,361 rows with a usable
                   birth date (measured against production 2026-08-05).

    nflverse       `nfl_draft_year` against the `rookie_season` nflverse
                   publishes for the SAME gsis id. The gsis id names a specific
                   person, so this asks the question directly rather than
                   inferring it: if we say a man entered the league decades from
                   when the holder of his id actually did, one of the two facts
                   on the row belongs to someone else.

    observed       `nfl_draft_year` later than the first season the player has a
                   gamelog in. Narrow, since it only sees players with gamelogs,
                   but it needs no external feed.

  The undrafted grace window matters on `observed`: `nfl_draft_year` is a DEBUT
  year only when `draft_round > 0`. For an undrafted player it records entry by
  whatever route the source knew about and routinely postdates the real first
  appearance, so applying the raw comparison makes the defect look several times
  larger than it is. See libs-server/player-era.mjs.

  ## Why the nflverse falsifier replaced a cohort-percentile one

  The falsifier here until 2026-08-27 grouped players by draft year and flagged
  a gsis serial outside its cohort's 5th/95th percentiles. Serials ARE issued
  chronologically, so the idea was sound, but the implementation could not work
  and its failures all pointed the same way -- it reported rows that were fine
  and stayed silent on rows that were not:

    - It needed a crowd. A draft year required 20+ gsis-bearing rows before the
      check would run, so the historical years where conflation is most obvious
      were skipped outright. All eleven pre-1970 grafts were invisible to it.
    - It graded against its own corruption. The band came from the same rows
      being judged, so a year whose population was largely conflated widened the
      band to fit them.
    - It never applied the undrafted grace this header promised it: the query
      selected `draft_round` and then never read it. The result was that all 31
      rows it reported were undrafted and 30 sat below their band -- it was
      measuring the undrafted entry offset, not self-contradiction.

  Asking nflverse needs none of that machinery: no percentiles, no cohort
  minimum, no slack constant, and no threshold to invent. Measured 2026-08-27,
  `rookie_season - nfl_draft_year` over the 15,327 rows nflverse resolves ran
  continuously from -4 to +7, then left THIRTY-FOUR consecutive empty years,
  then held eleven rows between +42 and +67, with a twelfth at -8. The data drew
  its own boundary; MAXIMUM_PLAUSIBLE_ENTRY_GAP_SEASONS just names it. All
  twelve were repaired by db/adhoc/2026-08-27-repair-conflated-player-identity
  .sql, so this falsifier carries an EMPTY baseline -- a finding here is new.

  Re-derive with:
    node db/gates/check-conflated-player-rows.mjs --distribution

  ## Why a ratchet rather than a threshold

  The `age` and `observed` falsifiers carry pre-existing debt, so a bare
  threshold would be red on day one and read as noise within a week. The
  baseline is the set of pids already known to trip a falsifier; the check fails
  only on a pid that is NEW to it. That is the same shape as
  check-schema-conformance-ratchet.mjs, for the same reason.

  Removing a pid from the baseline is what REPAIRING a row looks like. Adding
  one is accepting new debt and should be deliberate -- `--rebaseline` exists
  for the case where the whole set has been re-adjudicated, not for making a
  red run go away.

  ## Running it

    NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
      node db/gates/check-conflated-player-rows.mjs

  Read-only. Writes nothing but the baseline file, and only under --rebaseline.
  `main()` is called bare rather than through `is_main`: that helper compares
  process.argv[1] VERBATIM, so a relative invocation of a db/adhoc script
  silently does nothing and exits 0.
*/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import {
  MINIMUM_PLAUSIBLE_ENTRY_AGE,
  MAXIMUM_PLAUSIBLE_ENTRY_AGE
} from '#libs-server/player-era.mjs'
import { asyncBufferFromFile } from 'hyparquet'

import {
  download_players_file,
  read_parquet_rows
} from '#scripts/import-players-nflverse.mjs'
import { format_negative_controls } from './negative-control.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = path.join(
  __dirname,
  'conflated-player-rows-baseline.json'
)

// The band itself lives in libs-server/player-era.mjs, shared with the
// mint-time guard in create-player.mjs so the audit cannot report a pair the
// minting path was willing to write.

// How far `nfl_draft_year` may sit from nflverse's `rookie_season` for the same
// gsis id before the two are describing different people. The legitimate spread
// is -4..+7 (late entry routes -- CFL, NFL Europe, practice squad years -- put a
// debut well after the recorded entry); the nearest real finding is at -8, and
// the next is +42. See the header for the measured distribution.
const MAXIMUM_PLAUSIBLE_ENTRY_GAP_SEASONS = 8

// nflverse player coverage begins here; every older career is clamped to it.
const NFLVERSE_ROOKIE_SEASON_FLOOR = 1974

// `nfl_draft_year` is an entry year rather than a debut year for an undrafted
// player, so its disagreement with an observed season needs a grace window.
const UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS = 2

const find_age_outliers = async () =>
  db
    .select(
      'pid',
      'nfl_draft_year',
      'date_of_birth',
      'draft_round',
      db.raw(
        'nfl_draft_year - substring(date_of_birth from 1 for 4)::int AS entry_age'
      )
    )
    .from('player')
    .whereNotNull('nfl_draft_year')
    .whereNot('date_of_birth', '0000-00-00')
    .whereNotNull('date_of_birth')
    .whereRaw("date_of_birth ~ '^[0-9]{4}-'")
    .whereRaw(
      'nfl_draft_year - substring(date_of_birth from 1 for 4)::int NOT BETWEEN ? AND ?',
      [MINIMUM_PLAUSIBLE_ENTRY_AGE, MAXIMUM_PLAUSIBLE_ENTRY_AGE]
    )

/**
 * Pair each player row carrying a gsis id with the nflverse row for that same
 * id. Returns one entry per pairable row, whether or not it disagrees, so both
 * the falsifier and `--distribution` read from the same set.
 */
const load_nflverse_entry_gaps = async () => {
  const file_path = await download_players_file({ force_download: false })
  const nflverse_rows = await read_parquet_rows(
    await asyncBufferFromFile(file_path)
  )

  const rookie_season_by_gsis = new Map()
  for (const row of nflverse_rows) {
    if (row.gsis_id && row.rookie_season) {
      rookie_season_by_gsis.set(row.gsis_id, Number(row.rookie_season))
    }
  }

  // Only rows whose id is actually IN gsis format. The column also holds
  // esb-format values on old rows (`MOR305100` on Earl Morrall), and comparing
  // one of those as though it were a gsis id is meaningless -- it matches
  // nflverse's own esb-keyed leftovers and reports famous, correct players.
  const players = await db
    .select('pid', 'gsis_player_id', 'nfl_draft_year')
    .from('player')
    .whereRaw("gsis_player_id ~ '^00-00[0-9]{5}$'")
    .whereNotNull('nfl_draft_year')
    .whereNot('nfl_draft_year', 0)

  const gaps = []
  for (const player of players) {
    const rookie_season = rookie_season_by_gsis.get(player.gsis_player_id)
    if (!rookie_season) continue
    // nflverse coverage starts in 1974 and clamps everyone older to it -- 1,318
    // players carry that value against ~300 for each neighbouring year -- so it
    // is a censoring floor, not a rookie season, and cannot falsify anything.
    if (rookie_season <= NFLVERSE_ROOKIE_SEASON_FLOOR) continue
    gaps.push({
      pid: player.pid,
      gsis_player_id: player.gsis_player_id,
      nfl_draft_year: player.nfl_draft_year,
      nflverse_rookie_season: rookie_season,
      gap: rookie_season - player.nfl_draft_year
    })
  }
  return gaps
}

const find_nflverse_conflicts = (gaps) =>
  gaps
    .filter(({ gap }) => Math.abs(gap) >= MAXIMUM_PLAUSIBLE_ENTRY_GAP_SEASONS)
    .sort((a, b) => a.pid.localeCompare(b.pid))

const find_observed_season_outliers = async () => {
  const { rows } = await db.raw(
    `
    SELECT p.pid, p.nfl_draft_year, p.draft_round,
      min(g.season_year) AS first_gamelog_season,
      p.nfl_draft_year - min(g.season_year) AS gap
    FROM player p
    JOIN player_gamelogs g ON g.pid = p.pid
    WHERE p.nfl_draft_year IS NOT NULL
    GROUP BY p.pid, p.nfl_draft_year, p.draft_round
    HAVING p.nfl_draft_year - min(g.season_year) >
      CASE WHEN coalesce(p.draft_round, 0) > 0 THEN 0 ELSE ? END
    ORDER BY p.pid
  `,
    [UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS]
  )
  return rows
}

const read_baseline = () => {
  if (!fs.existsSync(BASELINE_PATH)) return {}
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
}

/**
 * Prove the falsifier can go red, and that it is not simply red on everything.
 * A synthetic pair each way, run on every invocation: the runner reads a
 * control that STAYED GREEN as a gate that cannot report.
 */
const run_negative_controls = () => {
  const conflict_row = {
    pid: 'CTRL-CONF-000000',
    gsis_player_id: '00-0000001',
    nfl_draft_year: 1957,
    nflverse_rookie_season: 2006,
    gap: 49
  }
  const legitimate_row = {
    pid: 'CTRL-OKAY-000000',
    gsis_player_id: '00-0000002',
    nfl_draft_year: 1999,
    nflverse_rookie_season: 2003,
    gap: 4
  }
  return [
    {
      name: 'reports a decades-apart entry gap',
      went_red: find_nflverse_conflicts([conflict_row]).length === 1
    },
    {
      name: 'declines a 4-season late-entry-route gap',
      went_red: find_nflverse_conflicts([legitimate_row]).length === 0
    }
  ]
}

const print_distribution = (gaps) => {
  const counts = new Map()
  for (const { gap } of gaps) counts.set(gap, (counts.get(gap) || 0) + 1)
  console.log(`rookie_season - nfl_draft_year over ${gaps.length} paired rows:`)
  for (const gap of [...counts.keys()].sort((a, b) => a - b)) {
    console.log(`  ${gap > 0 ? '+' : ''}${gap}: ${counts.get(gap)}`)
  }
}

const main = async () => {
  const rebaseline = process.argv.includes('--rebaseline')

  const entry_gaps = await load_nflverse_entry_gaps()

  if (process.argv.includes('--distribution')) {
    print_distribution(entry_gaps)
    await db.destroy()
    process.exit(0)
  }

  // stderr, not stdout: the block must reach a terminal on every run without
  // sitting ahead of machine-readable output. The runner reads both streams.
  console.error(format_negative_controls({ controls: run_negative_controls() }))

  const findings = {
    age: await find_age_outliers(),
    nflverse: find_nflverse_conflicts(entry_gaps),
    observed: await find_observed_season_outliers()
  }

  const baseline = read_baseline()
  let new_count = 0

  // A pid tripping more than one falsifier is the strong signal; surface it
  // before the per-falsifier detail so it cannot be lost in the listing.
  const trips_by_pid = new Map()
  for (const [falsifier, rows] of Object.entries(findings)) {
    for (const row of rows) {
      if (!trips_by_pid.has(row.pid)) trips_by_pid.set(row.pid, [])
      trips_by_pid.get(row.pid).push(falsifier)
    }
  }
  const multi_falsifier = [...trips_by_pid.entries()].filter(
    ([, falsifiers]) => falsifiers.length > 1
  )

  for (const [falsifier, rows] of Object.entries(findings)) {
    const known = new Set(baseline[falsifier] || [])
    const fresh = rows.filter((row) => !known.has(row.pid))
    new_count += fresh.length

    console.log(
      `\n## ${falsifier}: ${rows.length} rows (${fresh.length} not in baseline)`
    )
    for (const row of fresh) {
      console.log(`  NEW ${JSON.stringify(row)}`)
    }
  }

  if (multi_falsifier.length) {
    console.log(`\n## rows tripping MORE THAN ONE falsifier`)
    for (const [pid, falsifiers] of multi_falsifier) {
      console.log(`  ${pid}: ${falsifiers.join(', ')}`)
    }
  }

  if (rebaseline) {
    const next = Object.fromEntries(
      Object.entries(findings).map(([falsifier, rows]) => [
        falsifier,
        rows.map((row) => row.pid).sort()
      ])
    )
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`)
    console.log(`\nrebaselined ${BASELINE_PATH}`)
    await db.destroy()
    process.exit(0)
  }

  // The output oracle is distinct from the exit code on purpose: a run that
  // throws before reaching here prints no verdict line at all, so an empty
  // output is never readable as a pass.
  console.log(
    `\nVERDICT: ${new_count} player row(s) newly contradict themselves`
  )
  await db.destroy()
  process.exit(new_count > 0 ? 1 : 0)
}

main()
