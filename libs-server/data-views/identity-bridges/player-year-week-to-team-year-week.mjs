import db from '#db'
import { current_season } from '#constants'
import { physical_year_projection } from '#libs-server/data-views/physical-season-columns.mjs'

export const from = 'player_year_week'
export const to = 'team_year_week'
export const mode = 'default'

const CTE_NAME = 'player_week_teams'

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
// NO CARRY-FORWARD. A player with no gamelog row that week -- bye, injured
// reserve, practice squad, not yet signed -- gets no row here, so his cell
// renders empty. That is 19.3-20.0% of player-year-week slots, and filling them
// by carrying his previous team forward was considered and rejected: it is an
// inference ("probably still there"), and it would attach a game he had nothing
// to do with to his row. An empty cell says what the data says.
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

  const cte_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .select(physical_year_projection('nfl_games'))
    .select('nfl_games.week as week')
    .select('nfl_games.esbid as esbid')
    .select('player_gamelogs.nfl_team as nfl_team')
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.season_type', resolve_season_type(params))
    // Both sides carry the year so the partitioned player_gamelogs scan prunes;
    // see the Year Pushdown Contract in this directory's ABOUT.
    .whereIn('nfl_games.season_year', year_range)
    .whereIn('player_gamelogs.season_year', year_range)

  if (week_range.length) {
    cte_query.whereIn('nfl_games.week', week_range)
  }

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
