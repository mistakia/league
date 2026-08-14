/*
  The reference probe behind the `pfr-gamelog-agreement` registered data check:
  our per-week stat totals against Pro Football Reference's, at (season_year,
  week, stat) grain.

  ## It reads the cache and never fetches

  `get_player_gamelogs_for_season` in private/libs-server crawls one page per
  game with an 8-second wait -- roughly 36 minutes per season through a stealth
  browser against a site that blocks scrapers. A check that fetches acquires the
  upstream's failure modes, its latency and its blocking behaviour on a schedule
  nobody is watching, so this grades what the cache holds and reports what it
  cannot grade. Refreshing the cache stays the importer's job.

  ## Two interchangeable corpora, not one

  The retained corpus is opportunistic rather than systematic:
  `player-gamelogs/` holds a per-SEASON file for only some seasons, while
  `games/` holds a per-GAME box score whose `player_passing_rushing_receiving`
  table carries all 13 shared stat fields. The second is a full reference source
  and not a metadata cache, which is what makes a season with no season file
  gradeable at all -- 2024 has none, and reading only the season file left this
  check throwing on it.

  Both readers below are exported so either can be pointed at a season
  independently, which is how their agreement is established rather than
  assumed.

  ## The precondition is load-bearing, not a detail

  `min_rate` is ONE-SIDED, and an agreement comparison is two-sided: ours 816
  against PFR 817 fails correctly, but 817 against 816 PASSES, as does every one
  of the ratios up to 5.5 that grading a partially-crawled 2025 produced. A
  stale reference makes our data look EXCESS rather than deficient, which a
  floor cannot see.

  So reference completeness gates gradeability: a week is graded only when PFR's
  distinct game count equals ours. Bye weeks make per-week counts genuinely vary
  from 13 to 16, so a fixed expected count would be wrong; equality against our
  own count is the comparison that holds. This is the only thing catching a
  reference that is BEHIND ours, and the check's calibration says so.

  Rows are emitted for the UNION of both sides' weeks. Iterating the reference
  alone made a week we hold and the reference does not invisible rather than
  un-gradeable -- no row at all, so nothing to report and nothing to count,
  which is scope discovered from the reference instead of declared.

  ## The completeness precondition is game-grained, and that is its limit

  A game counts as present the moment ONE of its box-score rows is read, so a
  box score cached with a TRUNCATED `player_passing_rushing_receiving` array
  still contributes its game id: the week's counts stay equal while its
  reference totals are understated, which reads as a ratio above 1.0 and passes
  a one-sided floor silently. Closing that needs a per-game expected player
  count the cache does not carry, so it is a known limit rather than a guarded
  case. The failure requires a partially-written cache entry, which the writer
  does not produce today -- it writes whole files.
*/

import db from '#db'
import { get } from './cache.mjs'

// The 13 stat fields both corpora carry, in the per-season file's vocabulary
// against ours.
export const SHARED_STAT_FIELDS = {
  pa: 'passing_attempts',
  pc: 'passing_completions',
  py: 'passing_yards',
  ints: 'passing_interceptions',
  tdp: 'passing_touchdowns',
  ra: 'rushing_attempts',
  ry: 'rushing_yards',
  tdr: 'rushing_touchdowns',
  fuml: 'fumbles_lost',
  trg: 'targets',
  rec: 'receptions',
  recy: 'receiving_yards',
  tdrec: 'receiving_touchdowns'
}

// The same 13 fields in the PER-GAME box score's vocabulary, which is a
// different spelling of the same numbers: `player_passing_rushing_receiving`
// carries one row per player per game with `pass_att` where the season file
// says `pa`. Both readers below normalize onto OUR column names so nothing
// downstream has to know which corpus answered.
export const BOX_SCORE_STAT_FIELDS = {
  pass_att: 'passing_attempts',
  pass_cmp: 'passing_completions',
  pass_yds: 'passing_yards',
  pass_int: 'passing_interceptions',
  pass_td: 'passing_touchdowns',
  rush_att: 'rushing_attempts',
  rush_yds: 'rushing_yards',
  rush_td: 'rushing_touchdowns',
  fumbles_lost: 'fumbles_lost',
  targets: 'targets',
  rec: 'receptions',
  rec_yds: 'receiving_yards',
  rec_td: 'receiving_touchdowns'
}

const GRADED_SEASON_TYPE = 'REG'

// The cache API serves one file per request and offers no directory listing, so
// the per-game corpus is read by enumerating the season index and asking for
// each game. That is ~272 requests a season against our own API, which is why
// they run concurrently -- measured 167ms each sequentially against 700ms for
// 48 in parallel.
const GAME_FETCH_CONCURRENCY = 8

// Runs `worker` over `items` at bounded concurrency and keeps NO results. A box
// score is roughly 141 KB of which the table we need is about 9 KB, so
// materializing all ~272 of a season before reducing peaked well over a hundred
// megabytes of heap to use a couple. The worker folds each one into `by_week`
// and lets it go; `add_to_week` is synchronous, so concurrent folds cannot
// interleave.
const each_with_concurrency = async ({ items, limit, worker }) => {
  let next = 0

  const run = async () => {
    while (next < items.length) {
      const index = next++
      await worker(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  )
}

const add_to_week = ({ by_week, week, game_id, row, field_map }) => {
  if (!Number.isFinite(week)) return

  if (!by_week.has(week)) {
    by_week.set(week, { games: new Set(), totals: {} })
  }

  const bucket = by_week.get(week)
  // Only a real id counts toward the game count. The per-game reader filters
  // the index on `pfr_game_id`, but the season file is a flat player-row list
  // with no such guarantee, and adding a nullish id would put one phantom entry
  // in the Set -- inflating the week's reference game count by one and breaking
  // the completeness equality for a reason no reader could diagnose.
  if (game_id !== null && game_id !== undefined && game_id !== '') {
    bucket.games.add(game_id)
  }

  for (const [source_field, column] of Object.entries(field_map)) {
    const value = Number(row[source_field])
    if (!Number.isFinite(value)) continue
    bucket.totals[column] = (bucket.totals[column] || 0) + value
  }
}

/**
 * Per-week reference totals from the per-SEASON player-gamelog file.
 *
 * Returns null when the cache holds no such file, which is the ordinary case
 * rather than an error: the retained corpus is opportunistic, and a season with
 * no season file is graded from the per-game corpus below instead.
 */
export const read_reference_season_file = async ({ season_year }) => {
  const rows = await get({
    key: `/pro-football-reference/player-gamelogs/${season_year}.json`
  })

  if (!Array.isArray(rows)) return null

  const by_week = new Map()

  for (const row of rows) {
    if (row.seas_type !== GRADED_SEASON_TYPE) continue

    add_to_week({
      by_week,
      week: Number(row.week),
      game_id: row.pfr_game_id,
      row,
      field_map: SHARED_STAT_FIELDS
    })
  }

  return by_week
}

/**
 * Per-week reference totals from the per-GAME box scores.
 *
 * The season index (`games/<year>.json`) lists every SCHEDULED game with its
 * week and season type; a game counts toward the week's reference game count
 * only when its box score is actually cached. That distinction is what keeps
 * the precondition honest — counting scheduled games would let a week whose box
 * scores are half-crawled read as complete.
 */
export const read_reference_season_games = async ({ season_year }) => {
  const index = await get({
    key: `/pro-football-reference/games/${season_year}.json`
  })

  if (!Array.isArray(index)) return null

  const scheduled = index.filter(
    (game) => game.seas_type === GRADED_SEASON_TYPE && game.pfr_game_id
  )

  const by_week = new Map()
  const unreadable_games = []

  await each_with_concurrency({
    items: scheduled,
    limit: GAME_FETCH_CONCURRENCY,
    worker: async (game) => {
      let box_score
      try {
        box_score = await get({
          key: `/pro-football-reference/games/${game.pfr_game_id}.json`
        })
      } catch (err) {
        // One transport failure out of ~272 must not take the whole check down
        // onto the runner's crash path, which emits on NEITHER dedup key. A
        // game we could not read is a game that does not count toward its
        // week's reference total, which the completeness precondition then
        // rejects -- the same safe direction as a game that was never cached.
        unreadable_games.push({
          pfr_game_id: game.pfr_game_id,
          error: err.message
        })
        return
      }

      if (
        !box_score ||
        !Array.isArray(box_score.player_passing_rushing_receiving)
      ) {
        return
      }

      for (const row of box_score.player_passing_rushing_receiving) {
        add_to_week({
          by_week,
          week: Number(game.week),
          game_id: game.pfr_game_id,
          row,
          field_map: BOX_SCORE_STAT_FIELDS
        })
      }
    }
  })

  if (unreadable_games.length) {
    console.log(
      `pfr-gamelog-agreement: ${unreadable_games.length} of ${scheduled.length} ${season_year} box scores could not be read; their weeks fail the completeness precondition rather than grading short`
    )
  }

  return by_week
}

/**
 * The reference for one season, from whichever corpus holds it.
 *
 * The per-season file is preferred where it exists because it is ONE request
 * against ~272, and the precondition makes the thinner corpus safe rather than
 * merely cheaper: a week the season file covers incompletely is reported
 * un-gradeable, never graded. So preferring it costs coverage in the seasons
 * where both exist and can never produce a false reading. Verified
 * interchangeable on 2022, where the two corpora reproduce each other's
 * per-week totals on every week and every stat.
 */
const read_reference_season = async ({ season_year }) => {
  const from_season_file = await read_reference_season_file({ season_year })
  if (from_season_file && from_season_file.size) {
    return { source: 'player-gamelogs', by_week: from_season_file }
  }

  const from_games = await read_reference_season_games({ season_year })
  if (from_games && from_games.size) {
    return { source: 'games', by_week: from_games }
  }

  throw new Error(
    `pfr-gamelog-agreement: the cache holds neither a player-gamelogs season file nor any per-game box score for ${season_year}`
  )
}

const read_our_season = async ({ season_year }) => {
  const sum_columns = Object.values(SHARED_STAT_FIELDS).map((column) =>
    db.raw(`sum(coalesce(g.??, 0)) as ??`, [column, column])
  )

  const rows = await db('player_gamelogs as g')
    .join('nfl_games as ng', 'ng.esbid', 'g.esbid')
    .select('ng.week')
    .select(db.raw('count(distinct g.esbid) as games'))
    .select(sum_columns)
    .where('ng.season_year', season_year)
    .where('ng.season_type', GRADED_SEASON_TYPE)
    .groupBy('ng.week')

  return new Map(rows.map((row) => [Number(row.week), row]))
}

/**
 * One row per (season_year, week, stat).
 *
 * `numerator` is OUR total and `denominator` is the reference's, so the ratio
 * is ours/theirs and exact agreement is 1.0. `reference_games` and `our_games`
 * ride along for the precondition, which is declared on the registry entry
 * rather than here so the gate is visible beside the threshold it protects.
 */
export const pfr_gamelog_agreement_rows = async ({ season_years }) => {
  const rows = []

  for (const season_year of season_years) {
    const { source, by_week } = await read_reference_season({ season_year })
    const ours = await read_our_season({ season_year })

    // The UNION of both sides' weeks, not just the reference's. Iterating the
    // reference alone made a week we hold and the reference does not INVISIBLE
    // rather than un-gradeable -- no row, so nothing to report and nothing to
    // count. That is scope discovered from the reference rather than declared,
    // and it is exactly what a thin or partially-cached season file produces.
    // Emitted with `reference_games: 0`, the week now fails the completeness
    // precondition and is reported as un-gradeable like any other.
    const weeks = [...new Set([...by_week.keys(), ...ours.keys()])].sort(
      (a, b) => a - b
    )

    for (const week of weeks) {
      const bucket = by_week.get(week)
      const our_week = ours.get(week)

      for (const column of Object.values(SHARED_STAT_FIELDS)) {
        rows.push({
          season_year,
          week,
          stat: column,
          // Rides along for the precondition and the report rather than
          // entering the grain: which corpus answered changes what is
          // gradeable, so a reader diagnosing an un-gradeable week needs it.
          reference_source: source,
          reference_games: bucket ? bucket.games.size : 0,
          our_games: our_week ? Number(our_week.games) : 0,
          numerator: our_week ? Number(our_week[column]) : 0,
          denominator: bucket ? bucket.totals[column] || 0 : 0
        })
      }
    }
  }

  return rows
}
