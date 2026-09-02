import db from '#db'
import { current_season } from '#constants'
import { physical_year_projection } from '#libs-server/data-views/physical-season-columns.mjs'

export const from = 'player_year_week'
export const to = 'team_year_week'
export const mode = 'default'

const CTE_NAME = 'player_week_teams'
const APPEARANCES_CTE_NAME = 'player_week_appearances'

// The team a player was on in a GIVEN WEEK, and the game he was in that week.
//
// The week-grain sibling of player-year-to-team-year.mjs, and the reason both
// exist: a year-grain answer is an approximation the moment a player changes
// teams mid-season. That bridge picks the team he played the most games for and
// applies it to all 17 weeks, so every week on the other team renders the wrong
// team's data. Measured on the REG corpus: 15.5% / 12.0% / 5.9% of 2023 / 2024 /
// 2025 player-seasons are multi-team, covering 1,012 / 888 / 540 player-weeks
// attributed to a team the player was not on that week.
//
// NO AGGREGATION, DELIBERATELY. player_gamelogs holds exactly one row per
// (pid, year, week) -- measured across 105,000 REG player-weeks in 2023-2025,
// maximum 1 row per group and zero groups carrying two teams -- so the team for
// a week is a stored fact, not something to derive. The year bridge needs an
// array_agg and a majority rule; this one needs neither, and that difference IS
// the point. If a future import breaks the uniqueness, this CTE starts fanning
// out rather than silently picking a winner, which is the failure direction to
// prefer.
//
// esbid rides along because it is what a game-grain fact should join on. A
// betting market is attached to a GAME; matching it through the game the player
// was actually in is exact, where matching through a team code plus a week
// predicate re-derives the same thing less directly.
//
// TWO TEAM COLUMNS, WITH DELIBERATELY DIFFERENT ABSENCE RULES. 19.3-20.0% of
// player-year-week slots have no gamelog row at all -- bye, injured reserve,
// practice squad, not yet signed -- and the right answer for that population
// depends on what the asking column means by "team". The bridge refuses to pick
// one, and projects both:
//
//   nfl_team              the team whose GAME he was in that week. NULL when he
//                         was in none. Consumed by the betting-market columns,
//                         where the cell is a fact about a specific game: no
//                         game, no fact, and carrying a team forward would
//                         attach a game he had nothing to do with to his row.
//
//   nfl_team_most_recent  the team of his most recent appearance AS OF this
//                         week, carried forward across the gap. Consumed by the
//                         team-stat columns under their default scope, where the
//                         cell is a fact about the TEAM over a span and the
//                         player's own participation is explicitly not the
//                         criterion -- that is what the player_team_* family is
//                         for. Dropping the team's week-6 game because he was on
//                         injured reserve would contradict the scope's own
//                         definition, and it is not a rare correction: single-
//                         team player-seasons average 14.6 weeks with a gamelog
//                         row out of 17, so the exact column alone would render
//                         a season total at ~86% of the team's actual with
//                         nothing on screen saying it was truncated.
//
// Naming the second column for its DERIVATION rather than for what a caller
// wishes it meant is deliberate. It is an inference -- "he was still there" --
// and a name like nfl_team_at_week would hide that behind a claim of fact.
//
// Carry-forward is FORWARD ONLY. Weeks before a player's first appearance in the
// season stay NULL in both columns: he was on no NFL team at the time, so there
// is nothing to carry. The one irreducible gap is a player traded while injured
// who never appears for the new team, which is unknowable from this source and
// renders his old team.
//
// THE SPINE IS WHY THE CARRY IS POSSIBLE. This CTE emits one row per
// (pid, year, week) for every week in scope, not one row per appearance, so an
// absent week is a row carrying NULLs rather than a missing row. Betting
// behaviour is unchanged by that: those columns match on esbid, and a spine row
// for a week he did not play carries a NULL esbid that no market can equal.
const resolve_season_type = (params = {}) => {
  if (Array.isArray(params.seas_type) && params.seas_type.length) {
    return params.seas_type
  }
  if (params.seas_type) return [params.seas_type]
  return ['REG']
}

const resolve_year_range = ({ query_context, params }) => {
  if (
    Array.isArray(query_context.year_range) &&
    query_context.year_range.length > 0
  ) {
    return query_context.year_range
  }
  if (params && params.year != null) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    const parsed = year_array
      .map((y) => parseInt(y, 10))
      .filter((y) => Number.isFinite(y))
    if (parsed.length > 0) {
      return Array.from(new Set(parsed)).sort((a, b) => a - b)
    }
  }
  return [current_season.year]
}

export const add_cte = ({ query_context, params = {} }) => {
  const { players_query } = query_context
  if (query_context.registered_ctes.has(CTE_NAME)) {
    query_context.player_week_teams_cte_name = CTE_NAME
    return
  }

  const year_range = resolve_year_range({ query_context, params })
  const week_range = query_context.week_range || []

  const season_types = resolve_season_type(params)

  // The appearances are NOT week-filtered, and that is load-bearing rather than
  // an omission. Carrying a team forward into week 10 requires knowing where the
  // player last appeared, which may be week 3; filtering the appearances to the
  // requested week range would leave every carried value in a narrow view NULL.
  // The week filter belongs on the spine below, which is what the CTE emits.
  const appearances = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .select(physical_year_projection('nfl_games'))
    .select('nfl_games.week as week')
    .select('nfl_games.esbid as esbid')
    .select('player_gamelogs.nfl_team as nfl_team')
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.season_type', season_types)
    // Both sides carry the year so the partitioned player_gamelogs scan prunes;
    // see the Year Pushdown Contract in this directory's ABOUT.
    .whereIn('nfl_games.season_year', year_range)
    .whereIn('player_gamelogs.season_year', year_range)

  // The weeks that exist, read from the schedule rather than counted from a
  // constant: a season's week count is data, and 2021 added one.
  const scheduled_weeks = db('nfl_games')
    .distinct(physical_year_projection('nfl_games'), 'nfl_games.week as week')
    .whereIn('nfl_games.season_type', season_types)
    .whereIn('nfl_games.season_year', year_range)

  if (week_range.length) {
    scheduled_weeks.whereIn('nfl_games.week', week_range)
  }

  // The appearances go in as their OWN CTE, referenced three times below, and
  // that is a performance decision with a measured number behind it. Inlined as
  // a subquery at each reference, the planner re-derived the gamelogs-to-games
  // join per spine row and the spine join became a nested loop: 655,792 index
  // scans, 2.1M buffers, 1,380ms for a single season. Postgres materializes a
  // plain CTE at more than one reference, so naming it once collapses that to a
  // single scan feeding hash joins.
  players_query.with(APPEARANCES_CTE_NAME, appearances)
  query_context.registered_ctes.add(APPEARANCES_CTE_NAME)

  // A player enters the spine for a season if he has a gamelog row in it.
  // Players with none get no rows, which keeps the spine proportional to the
  // population actually under view rather than to every pid in the table.
  //
  // READ FROM player_gamelogs, NOT FROM THE APPEARANCES CTE, and the reason is
  // the planner rather than the semantics. Postgres has no statistics for a
  // CTE, so it estimates the appearances join at 6,721 rows where 104,895 come
  // back -- a 15x miss across a three-season range. Downstream of that miss the
  // spine looks tiny, and the join below is planned as a merge on (year, week)
  // alone with the pid equality demoted to a Join Filter: every player-week in a
  // week is compared against every other, and a query that runs in 831ms took
  // longer than the 30s statement timeout. Reading the real partitioned table
  // gives the planner honest statistics, and the same join comes back as a
  // three-column merge. Measured on production, 2023-2025 REG.
  //
  // The season-type filter is deliberately NOT applied here. Applying it needs
  // the nfl_games join, which is the correlated-predicate shape that produced
  // the bad estimate. Its absence admits players whose only games that season
  // were PRE or POST: they get spine rows carrying NULL in both team columns,
  // which attribute nothing and render nothing. An inert row is the right price
  // for a plan that does not fall off a cliff.
  const spine_players = db
    .distinct('player_gamelogs.pid')
    .select(physical_year_projection('player_gamelogs'))
    .from('player_gamelogs')
    .whereIn('player_gamelogs.season_year', year_range)

  // appearance_group counts the appearances at or before this week, so every
  // week between one appearance and the next carries the same number. Grouping
  // on it turns carry-forward into a partitioned max: within a group there is
  // exactly one non-NULL team -- the appearance that opened it -- and max()
  // ignores the NULLs after it. Postgres has no IGNORE NULLS on window
  // functions, which is what rules out the direct last_value() spelling.
  const carried = db
    .select('spine_players.pid')
    .select('spine.year')
    .select('spine.week')
    .select('week_appearance.esbid')
    .select('week_appearance.nfl_team')
    .select(
      db.raw(
        'count(week_appearance.nfl_team) over (partition by spine_players.pid, spine.year order by spine.week rows between unbounded preceding and current row) as appearance_group'
      )
    )
    .from(spine_players.as('spine_players'))
    .innerJoin(scheduled_weeks.as('spine'), function () {
      this.on('spine.year', '=', 'spine_players.year')
    })
    .leftJoin(`${APPEARANCES_CTE_NAME} as week_appearance`, function () {
      this.on('week_appearance.pid', '=', 'spine_players.pid')
      this.andOn('week_appearance.year', '=', 'spine.year')
      this.andOn('week_appearance.week', '=', 'spine.week')
    })

  const cte_query = db
    .select('pid', 'year', 'week', 'esbid', 'nfl_team')
    .select(
      db.raw(
        'max(nfl_team) over (partition by pid, year, appearance_group) as nfl_team_most_recent'
      )
    )
    .from(carried.as('player_week_team_spine'))

  // Plain `with`, not `withMaterialized`, for the reason the year bridge
  // records: the fence is an optimizer barrier that makes the planner estimate
  // one row against thousands and pick a nested loop.
  players_query.with(CTE_NAME, cte_query)
  query_context.registered_ctes.add(CTE_NAME)
  query_context.player_week_teams_cte_name = CTE_NAME
  query_context.player_week_teams_year_range = year_range
}

export const join_cte = ({ query_context, params = {} }) => {
  const { players_query, row_axes, pid_reference, year_reference } =
    query_context
  const week_reference = query_context.week_reference
  const year_range = resolve_year_range({ query_context, params })
  const week_range = query_context.week_range || []

  players_query.leftJoin(CTE_NAME, function () {
    this.on(`${CTE_NAME}.pid`, '=', pid_reference)

    if (row_axes.includes('year') && year_reference) {
      this.andOn(`${CTE_NAME}.year`, '=', year_reference)
    } else {
      const join_year =
        year_range.length > 0 ? Math.max(...year_range) : current_season.year
      this.andOn(`${CTE_NAME}.year`, '=', db.raw('?', [join_year]))
    }

    // Without a week axis the cell is one row per subject, so a CTE spanning
    // several weeks would fan it out with nothing to select between them.
    // Collapse to the last week in scope, mirroring how the pinned case is
    // resolved elsewhere.
    if (row_axes.includes('week') && week_reference) {
      this.andOn(`${CTE_NAME}.week`, '=', week_reference)
    } else if (week_range.length) {
      this.andOn(
        `${CTE_NAME}.week`,
        '=',
        db.raw('?', [Math.max(...week_range)])
      )
    }
  })
}

export default { from, to, mode, add_cte, join_cte }
