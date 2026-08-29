import { current_season } from '#constants'
import {
  projected_career_year_cte_select,
  projected_career_year_from_cte
} from '#libs-shared/career-year-definition.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { single_year, seas_type } from '#libs-shared/common-column-params.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year_param = params.year || [current_season.last_completed_season_year]
  if (!Array.isArray(year_param)) {
    year_param = [year_param]
  }
  const year = year_param[0] || current_season.last_completed_season_year
  const seas_type_param = params.seas_type || 'REG'
  return { single_year: Number(year), seas_type: seas_type_param }
}

const get_cache_info_for_player_seasonlogs = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).single_year
})

const player_seasonlogs_table_alias = ({ params = {} }) => {
  const { single_year: year, seas_type: seasType } = get_default_params({
    params
  })

  return get_table_hash(`player_seasonlogs_${year}_${seasType}`)
}

const player_seasonlogs_source = {
  table: 'player_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'season_year' },
  year_default: (params) => [get_default_params({ params }).single_year],
  extra_predicates: (params) => [
    { column: 'season_type', value: get_default_params({ params }).seas_type }
  ]
}

// career_year is only materialized for seasons a player has actually appeared
// in (the career-game-counts generator skips the upcoming season), so under a
// current-season row the column renders blank before the season's first game.
// When the query's year scope includes the current season, project the value a
// player enters the season with via the single declared career-year definition
// (distinct REG seasons before the current year, plus one -- see
// libs-shared/career-year-definition.mjs). Only emitted when the current
// season is in scope, so past-year-only queries stay byte-identical. Cast to
// smallint so the emitted column keeps career_year's int2 type (node-pg would
// otherwise surface a count's bigint as a string).

// The enclosing row's year expression when this query projects, or null when it
// emits the stored column untouched. A missing pid reference counts as "does
// not project": the projection reads a relation joined on the player row, so
// with nothing to join on the stored column is the only thing that can be
// emitted.
const get_projection_row_year = ({ params = {}, data_view_options = {} }) => {
  if (
    !data_view_options.pid_reference ||
    !data_view_options.query_context?.db ||
    !data_view_options.query_context?.players_query
  ) {
    return null
  }

  const year_range = data_view_options.year_range
  const year_reference = data_view_options.query_context?.year_reference
  const current_year_in_scope =
    Array.isArray(year_range) && year_range.includes(current_season.year)
  const column_year_is_current =
    !current_year_in_scope &&
    get_default_params({ params }).single_year === current_season.year

  if (current_year_in_scope && year_reference) {
    return year_reference
  }
  if (column_year_is_current) {
    return String(current_season.year)
  }
  return null
}

// The season is pinned into the alias so it moves when the season rolls, rather
// than a stale relation surviving under a name that no longer describes it.
const career_year_projection_cte_name = () =>
  get_table_hash(`career_year_projection/${current_season.year}`)

// Registered from the select expression rather than from the register_ctes
// hook, because that hook cannot tell a SELECT column from a WHERE clause and
// the two want opposite answers: main_where reads the STORED column
// deliberately (filtering on career_year has never consulted the projection),
// so a where-only use must add no CTE and no join. Registering from the hook
// put an unread relation into every career-year golden.
//
// Registering on first reference gives the stronger invariant anyway -- the
// relation exists exactly when something reads it.
//
// Idempotent: main_select and main_group_by both emit the expression, and two
// career-year columns share the one relation. Re-registering the name would
// emit a duplicate WITH alias (42712).
const ensure_career_year_projection_cte = (data_view_options) => {
  const { db, players_query } = data_view_options.query_context
  const cte_name = career_year_projection_cte_name()

  if (data_view_options.career_year_projection_cte_registered) {
    return cte_name
  }

  players_query.with(cte_name, db.raw(projected_career_year_cte_select()))
  // LEFT, not inner. A player with no prior REG seasonlog has no row in the
  // grouped relation, and an inner join would drop them from the view; the
  // COALESCE in the read expression is what restores the `1` the correlated
  // form returned for them.
  players_query.leftJoin(cte_name, function () {
    this.on(`${cte_name}.pid`, '=', data_view_options.pid_reference)
  })
  data_view_options.career_year_projection_cte_registered = true
  return cte_name
}

const get_career_year_select_expression = ({
  table_name,
  params = {},
  data_view_options = {}
} = {}) => {
  const row_year = get_projection_row_year({ params, data_view_options })
  if (row_year === null) {
    return `${table_name}.career_year`
  }
  const projected = projected_career_year_from_cte({
    cte_alias: ensure_career_year_projection_cte(data_view_options)
  })
  return `COALESCE(${table_name}.career_year, CASE WHEN ${row_year} = ${current_season.year} THEN ${projected} END)`
}

export default {
  player_career_year: {
    column_name: 'career_year',
    table_alias: player_seasonlogs_table_alias,
    source: player_seasonlogs_source,
    main_select: ({ column_index, table_name, params, data_view_options }) => [
      `${get_career_year_select_expression({
        table_name,
        params,
        data_view_options
      })} as career_year_${column_index}`
    ],
    main_where: ({ table_name }) => `${table_name}.career_year`,
    main_group_by: ({ table_name, params, data_view_options }) => [
      get_career_year_select_expression({
        table_name,
        params,
        data_view_options
      })
    ],
    column_params: {
      year: single_year,
      seas_type
    },
    get_cache_info: get_cache_info_for_player_seasonlogs
  }
}
