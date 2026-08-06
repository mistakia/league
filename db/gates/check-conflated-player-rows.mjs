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

    gsis_cohort    `gsis_player_id` serials are issued roughly chronologically,
                   so a row whose serial sits far outside its own draft year's
                   cohort holds an identifier from a different era. Bounded by
                   the cohort's own 5th/95th percentiles plus a slack margin
                   rather than a fixed width, because cohort size varies by an
                   order of magnitude across years. 35 of 16,275 rows.

    observed       `nfl_draft_year` later than the first season the player has a
                   gamelog in. The strongest of the three, because a gamelog is
                   an observation rather than bookkeeping -- but also the
                   narrowest, since it only sees players with gamelogs. 7 rows
                   beyond the undrafted grace window.

  The undrafted grace window matters on the last two: `nfl_draft_year` is a
  DEBUT year only when `draft_round > 0`. For an undrafted player it records
  entry by whatever route the source knew about and routinely postdates the real
  first appearance, so applying the raw comparison makes the defect look several
  times larger than it is. See libs-server/player-era.mjs.

  ## Why a ratchet rather than a threshold

  Roughly 80 rows trip one of these today and they are pre-existing debt, so a
  bare threshold would be red on day one and read as noise within a week. The
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = path.join(
  __dirname,
  'conflated-player-rows-baseline.json'
)

// A player entering the league outside this band is worth a human reading it.
const MINIMUM_PLAUSIBLE_ENTRY_AGE = 20
const MAXIMUM_PLAUSIBLE_ENTRY_AGE = 30

// Slack on top of the cohort's own percentile band, in gsis serial units.
const GSIS_COHORT_SLACK = 3000

// A draft year cohort smaller than this has percentiles too noisy to use.
const MINIMUM_COHORT_SIZE = 20

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

const find_gsis_cohort_outliers = async () => {
  const { rows } = await db.raw(
    `
    WITH p AS (
      SELECT pid, nfl_draft_year, draft_round,
        substring(gsis_player_id from 6)::int AS gsis_serial
      FROM player
      WHERE gsis_player_id ~ '^00-00[0-9]{5}$' AND nfl_draft_year IS NOT NULL
    ), cohort AS (
      SELECT nfl_draft_year,
        percentile_cont(0.05) WITHIN GROUP (ORDER BY gsis_serial) AS low,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY gsis_serial) AS high
      FROM p GROUP BY 1 HAVING count(*) >= ?
    )
    SELECT p.pid, p.nfl_draft_year, p.draft_round, p.gsis_serial,
      round(cohort.low) AS cohort_low, round(cohort.high) AS cohort_high
    FROM p JOIN cohort ON cohort.nfl_draft_year = p.nfl_draft_year
    WHERE p.gsis_serial < cohort.low - ? OR p.gsis_serial > cohort.high + ?
    ORDER BY p.pid
  `,
    [MINIMUM_COHORT_SIZE, GSIS_COHORT_SLACK, GSIS_COHORT_SLACK]
  )
  return rows
}

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

const main = async () => {
  const rebaseline = process.argv.includes('--rebaseline')

  const findings = {
    age: await find_age_outliers(),
    gsis_cohort: await find_gsis_cohort_outliers(),
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
