/*
  The derived aggregates left stale by
  `2026-08-24-split-tyrone-wheatley-father-and-son.mjs`.

  That script moved fact rows between two pids. It could not correct the
  aggregates computed over them, because those are population-wide: a seasonlog
  carries ranks against every other player in the season, and a careerlog is a
  sum over a career whose shape just changed.

  ## What is actually stale, measured rather than assumed

  Each surface was compared against the rows it derives from before this was
  written. Three of the six were already consistent and are NOT regenerated:

    player_seasonlogs stat sums          consistent (all 16 rows)
    league_format_player_seasonlogs      consistent (points_added and startable)
    scoring_format_player_gamelogs       consistent (points are per-pid-per-game)

  The three that are stale:

    scoring_format_player_seasonlogs  games_played wrong for Sr in 2002-2004,
                                      54 of 63 formats. He kept 10 roster-shell
                                      gamelogs the moved seasonlog never counted,
                                      which also moves points_per_game and so
                                      every rank in those seasons.

    scoring_format_player_careerlogs  points AND games_played wrong on BOTH pids
                                      in every format -- 54 for Sr, 63 for Jr.

    league_format_player_careerlogs   wrong for Jr in 13 of 14 formats, and Sr
                                      has no rows at all despite now owning 56
                                      league-format seasonlogs.

  2001 is deliberately excluded from the seasonlog pass: it measured clean on
  both games_played and points, because none of the 10 kept shells fall in it.
  2000 has no REG gamelogs at all, league-wide.

  ## What is NOT here

  `player_seasonlogs.player_position` still reads RB on Jr's five rows. Its
  owner, `scripts/process-player-seasonlogs.mjs`, cannot run at all: it inserts
  a `pos` key against a column named `player_position`, so Postgres rejects
  every batch -- and the script still exits 0. Repairing it is a separate call,
  because the fix would rewrite player_position for every player in whatever
  years it is then run against, from CURRENT roster position. Jr's five rows are
  corrected directly here instead.

  `player_gamelogs.career_game` and `player_seasonlogs.career_year` are stale on
  both pids -- Jr's seasons read 6, 7, 8 because the fused row had nine seasons.
  Their owner, `scripts/generate-player-career-game-counts.mjs`, takes no
  arguments and rebuilds all players across all history, so it is run separately
  rather than from inside this script.
*/

import debug from 'debug'

import db from '#db'
import generate_scoring_format_player_seasonlogs from '#scripts/generate-scoring-format-player-seasonlogs.mjs'
import generate_scoring_format_player_careerlogs from '#scripts/generate-scoring-format-player-careerlogs.mjs'
import generate_league_format_player_careerlogs from '#scripts/generate-league-format-player-careerlogs.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('regenerate-wheatley-split-derived-logs')
enable_debug_namespaces('regenerate-wheatley-split-derived-logs')

const SR = 'TYRO-WHEA-001076'
const JR = 'TYRO-WHEA-027188'
const PIDS = [SR, JR]

// The seasons holding the 10 roster-shell gamelogs Sr kept. 2001 measured
// clean; 2000 has no REG gamelogs league-wide.
const SEASONLOG_YEARS = [2002, 2003, 2004]

/*
  Each check returns the rows that disagree with what they derive from. They run
  before and after: before to prove the regeneration had something to fix, after
  to prove it fixed it. A check that reports zero on BOTH passes is a check that
  is not measuring anything, which is why the before count is asserted non-zero.
*/
const CHECKS = [
  {
    name: 'scoring_format_player_seasonlogs vs its gamelogs',
    sql: `
      SELECT s.pid, s.season_year, count(*)::int AS bad
      FROM scoring_format_player_seasonlogs s
      WHERE s.pid IN (?, ?)
        AND (
          s.games_played <> (
            SELECT count(*) FROM scoring_format_player_gamelogs g
            JOIN nfl_games ng ON ng.esbid = g.esbid
            WHERE g.pid = s.pid AND g.scoring_format_id = s.scoring_format_id
              AND ng.season_year = s.season_year AND ng.season_type = 'REG'
          )
          OR abs(s.points - (
            SELECT coalesce(sum(g.points), 0) FROM scoring_format_player_gamelogs g
            JOIN nfl_games ng ON ng.esbid = g.esbid
            WHERE g.pid = s.pid AND g.scoring_format_id = s.scoring_format_id
              AND ng.season_year = s.season_year AND ng.season_type = 'REG'
          )) > 0.01
        )
      GROUP BY s.pid, s.season_year ORDER BY s.pid, s.season_year`
  },
  {
    name: 'scoring_format_player_careerlogs vs its seasonlogs',
    sql: `
      SELECT c.pid, NULL::int AS season_year, count(*)::int AS bad
      FROM scoring_format_player_careerlogs c
      WHERE c.pid IN (?, ?)
        AND (
          c.games_played <> (
            SELECT coalesce(sum(s.games_played), 0) FROM scoring_format_player_seasonlogs s
            WHERE s.pid = c.pid AND s.scoring_format_id = c.scoring_format_id
          )
          OR abs(c.points - (
            SELECT coalesce(sum(s.points), 0) FROM scoring_format_player_seasonlogs s
            WHERE s.pid = c.pid AND s.scoring_format_id = c.scoring_format_id
          )) > 0.01
        )
      GROUP BY c.pid ORDER BY c.pid`
  },
  {
    name: 'league_format_player_careerlogs vs its seasonlogs',
    sql: `
      SELECT c.pid, NULL::int AS season_year, count(*)::int AS bad
      FROM league_format_player_careerlogs c
      WHERE c.pid IN (?, ?)
        AND (
          c.startable_games <> (
            SELECT coalesce(sum(s.startable_games), 0) FROM league_format_player_seasonlogs s
            WHERE s.pid = c.pid AND s.league_format_id = c.league_format_id
          )
          OR abs(c.points_added_earned - (
            SELECT coalesce(sum(s.points_added_earned), 0) FROM league_format_player_seasonlogs s
            WHERE s.pid = c.pid AND s.league_format_id = c.league_format_id
          )) > 0.01
        )
      GROUP BY c.pid ORDER BY c.pid`
  },
  {
    // Sr owns 56 league_format seasonlogs and held zero careerlogs before this
    // ran. An absent row is a different defect from a wrong one and no
    // value-comparison check can see it.
    name: 'league_format_player_careerlogs missing for a pid holding seasonlogs',
    sql: `
      SELECT s.pid, NULL::int AS season_year, count(DISTINCT s.league_format_id)::int AS bad
      FROM league_format_player_seasonlogs s
      WHERE s.pid IN (?, ?)
        AND NOT EXISTS (
          SELECT 1 FROM league_format_player_careerlogs c
          WHERE c.pid = s.pid AND c.league_format_id = s.league_format_id
        )
      GROUP BY s.pid ORDER BY s.pid`
  }
]

const run_checks = async (label) => {
  log(`--- consistency ${label} ---`)
  let total = 0
  for (const check of CHECKS) {
    const { rows } = await db.raw(check.sql, PIDS)
    const subtotal = rows.reduce((acc, row) => acc + Number(row.bad), 0)
    total += subtotal
    const detail = rows
      .map(
        (row) =>
          `${row.pid}${row.season_year ? ` ${row.season_year}` : ''}=${row.bad}`
      )
      .join(' ')
    log(`  ${check.name}: ${subtotal}${detail ? `  [${detail}]` : ''}`)
  }
  log(`  TOTAL inconsistent: ${total}`)
  return total
}

const main = async () => {
  const before = await run_checks('BEFORE')

  // A regeneration that had nothing to fix cannot be shown to have worked. This
  // is the negative control: if the surfaces already agree, either a sibling
  // session got here first or the checks are measuring nothing.
  if (before === 0) {
    log(
      'REFUSING: every surface already agrees with what it derives from. Nothing to regenerate, and a run would prove nothing.'
    )
    await db.destroy()
    process.exit(1)
  }

  const scoring_format_ids = (
    await db('scoring_format_player_seasonlogs')
      .distinct('scoring_format_id')
      .orderBy('scoring_format_id')
  ).map((row) => row.scoring_format_id)

  const league_format_ids = (
    await db('league_format_player_seasonlogs')
      .distinct('league_format_id')
      .orderBy('league_format_id')
  ).map((row) => row.league_format_id)

  log(
    `${scoring_format_ids.length} scoring formats, ${league_format_ids.length} league formats`
  )

  let step = 0
  const total_steps =
    scoring_format_ids.length * SEASONLOG_YEARS.length +
    scoring_format_ids.length +
    league_format_ids.length

  for (const scoring_format_id of scoring_format_ids) {
    for (const year of SEASONLOG_YEARS) {
      await generate_scoring_format_player_seasonlogs({
        year,
        scoring_format_id
      })
      step += 1
      log(`[${step}/${total_steps}] seasonlogs ${scoring_format_id} ${year}`)
    }
  }

  // After every seasonlog, because a careerlog is a sum over them.
  for (const scoring_format_id of scoring_format_ids) {
    await generate_scoring_format_player_careerlogs({ scoring_format_id })
    step += 1
    log(`[${step}/${total_steps}] scoring careerlogs ${scoring_format_id}`)
  }

  for (const league_format_id of league_format_ids) {
    await generate_league_format_player_careerlogs({ league_format_id })
    step += 1
    log(`[${step}/${total_steps}] league careerlogs ${league_format_id}`)
  }

  // Jr is a tackle. His five player_seasonlogs rows still read RB, and the
  // script that owns the column cannot run -- see the header.
  const position_rows = await db('player_seasonlogs')
    .where({ pid: JR })
    .whereNot({ player_position: 'T' })
    .update({ player_position: 'T' })
  log(
    `player_seasonlogs.player_position corrected on ${position_rows} Jr row(s)`
  )

  const after = await run_checks('AFTER')

  if (after > 0) {
    throw new Error(
      `REFUSING TO REPORT SUCCESS: ${after} row group(s) still disagree with what they derive from (was ${before})`
    )
  }

  log(`\nall surfaces consistent (was ${before} inconsistent before the run)`)

  await db.destroy()
  process.exit(0)
}

main()
