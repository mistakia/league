import db from '#db'
import { current_season } from '#constants'

const PLAYER_YEAR_TEAMS_CTE_NAME = 'player_year_teams'

// Year-grain player->team association is needed whenever the query has a
// year filter or year split: joining team-keyed fact tables through
// player.current_nfl_team would attribute historical stats to the player's
// present team. This predicate stays private; callers attach the bridge via
// ensure_player_year_teams_join_if_historical.
const has_year_filter = (params = {}) => {
  if (!params || params.year == null) return false
  const year_array = Array.isArray(params.year) ? params.year : [params.year]
  return year_array.length > 0
}

const is_historical_team_mode = ({ params = {}, splits = [] } = {}) =>
  has_year_filter(params) || splits.includes('year')

const resolve_year_range = ({ params = {}, data_view_options = {} }) => {
  if (
    Array.isArray(data_view_options.year_range) &&
    data_view_options.year_range.length > 0
  ) {
    return data_view_options.year_range
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

export const add_player_year_teams_cte = ({
  players_query,
  params = {},
  splits = [],
  data_view_options = {}
}) => {
  if (data_view_options.player_year_teams_cte_name) {
    return
  }

  const year_range = resolve_year_range({ params, data_view_options })

  const inner_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .select('nfl_games.year')
    .select('player_gamelogs.tm')
    .count('* as game_count')
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.seas_type', 'REG')
    .whereIn('nfl_games.year', year_range)
    .whereIn('player_gamelogs.year', year_range)
    .groupBy('player_gamelogs.pid', 'nfl_games.year', 'player_gamelogs.tm')

  const cte_query = db
    .select('pid')
    .select('year')
    .select(
      db.raw('(array_agg(tm ORDER BY game_count DESC, tm ASC))[1] as team')
    )
    .from(inner_query.as('player_year_team_counts'))
    .groupBy('pid', 'year')

  players_query.withMaterialized(PLAYER_YEAR_TEAMS_CTE_NAME, cte_query)

  data_view_options.player_year_teams_cte_name = PLAYER_YEAR_TEAMS_CTE_NAME
  data_view_options.player_year_teams_year_range = year_range

  if (data_view_options.query_context) {
    data_view_options.query_context.applied_bridges.add(
      'player_year->team_year'
    )
  }
}

export const ensure_player_year_teams_join = ({
  players_query,
  data_view_options = {},
  splits = []
}) => {
  if (data_view_options.player_year_teams_joined) {
    return
  }
  if (!data_view_options.player_year_teams_cte_name) {
    return
  }

  const cte_name = data_view_options.player_year_teams_cte_name
  const pid_reference = data_view_options.pid_reference
  const year_reference = data_view_options.year_reference

  players_query.leftJoin(cte_name, function () {
    this.on(`${cte_name}.pid`, '=', pid_reference)

    if (splits.includes('year') && year_reference) {
      this.andOn(`${cte_name}.year`, '=', year_reference)
    } else {
      const year_range = data_view_options.player_year_teams_year_range || []
      const join_year =
        year_range.length > 0 ? Math.max(...year_range) : current_season.year
      this.andOn(`${cte_name}.year`, '=', db.raw('?', [join_year]))
    }
  })

  data_view_options.player_year_teams_joined = true
}

export const ensure_player_year_teams_join_if_historical = ({
  players_query,
  params = {},
  splits = [],
  data_view_options = {}
}) => {
  if (!is_historical_team_mode({ params, splits })) return false
  add_player_year_teams_cte({
    players_query,
    params,
    splits,
    data_view_options
  })
  ensure_player_year_teams_join({
    players_query,
    data_view_options,
    splits
  })
  return true
}
