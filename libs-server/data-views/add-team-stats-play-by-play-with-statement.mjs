import db from '#db'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'
import { get_team_stats_wrap_decision } from '#libs-server/data-views/team-stats-from-plays-wrap.mjs'
import { apply_bridge } from '#libs-server/data-views/identity-bridge-registry.mjs'
import {
  decompose_nfl_weeks,
  is_full_year_seas_type_coverage
} from '#libs-shared/nfl-week-identifier.mjs'

// Cross the resolved year basis with a year_offset range to the explicit
// year-set the range covers: (min(year)+min(offset)) .. (max(year)+max(offset)).
// Used to keep the base play-by-play CTE and the downstream player_team_stats
// gamelogs join filtered to the same window. A no-op outside a range or when a
// year split is active (the split anchors each row's year individually).
const expand_years_for_offset_range = ({ years, params, row_axes }) => {
  if (
    !is_year_offset_range(params) ||
    row_axes.includes('year') ||
    !years.length
  ) {
    return years
  }
  const year_offset = params.year_offset
  const min_y = Math.min(...years) + Math.min(...year_offset)
  const max_y = Math.max(...years) + Math.max(...year_offset)
  const expanded = []
  for (let y = min_y; y <= max_y; y++) expanded.push(y)
  return expanded
}

export const add_team_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  row_axes = [],
  select_column_names = [],
  rate_columns = [],
  data_view_options
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const limit_to_player_active_games =
    params.limit_to_player_active_games || false
  const team_unit = params.team_unit || 'off'

  const query_context = data_view_options?.query_context
  const wrap_decision = query_context
    ? get_team_stats_wrap_decision({
        query_context,
        params,
        force_player_active: limit_to_player_active_games
      })
    : { wrap_mode: false, years: null }
  const wrap_mode = wrap_decision.wrap_mode

  const with_query = db('nfl_plays')
    .select(`nfl_plays.${team_unit} as nfl_team`)
    .whereNot('play_type', 'NOPL')

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = get_play_by_play_default_params({ params })
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    query_context: data_view_options.query_context
  })

  // Add groupBy clause before having
  with_query.groupBy(`nfl_plays.${team_unit}`)

  // The player variant ALWAYS joins this base CTE to nfl_games on (year, week)
  // in create_player_team_stats_query, so year AND week must be projected onto
  // the base CTE for the player variant in EVERY path -- single-year no-split,
  // multi-year LIST, and offset range alike -- otherwise the join references
  // columns the GROUP BY off-only CTE never emitted (invalid SQL: `column
  // t<hash>.year does not exist`). The team variant in a range goes through
  // wrap mode (which forces year just below) or stays team-grained and pools
  // across the window with no year projection.
  const player_variant_projection = limit_to_player_active_games

  // In wrap mode, force year into the base CTE so each team-year is
  // addressable for the wrap-CTE join even when no `year` split is active.
  if (row_axes.includes('year') || wrap_mode || player_variant_projection) {
    with_query.select('nfl_plays.year')
    with_query.groupBy('nfl_plays.year')
  }

  if (row_axes.includes('week') || player_variant_projection) {
    with_query.select('nfl_plays.week')
    with_query.groupBy('nfl_plays.week')
  }

  const view_scope_emitted =
    data_view_options.query_context &&
    data_view_options.query_context.nfl_week_ids &&
    data_view_options.query_context.nfl_week_ids.length
  if (!params.nfl_week_id && !view_scope_emitted) {
    // When year_offset spans a range and the data view has no year split,
    // the outer correlated subquery in select-string.mjs cannot anchor a per-
    // row year reference, so it collapses across the offset range. Expand the
    // CTE's year filter to cover (min(year)+min(offset)) .. (max(year)+max(offset))
    // so the pre-aggregate sees the right data; otherwise the CTE is restricted
    // to params.year only and offset windows beyond the explicit year are empty.
    const effective_years = expand_years_for_offset_range({
      years: get_effective_years({ params, data_view_options }),
      params,
      row_axes
    })
    if (effective_years.length) {
      with_query.whereIn('nfl_plays.year', effective_years)
    }
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would let the planner inline the
  // CTE into a nested-loop that re-executes it per outer row.
  query.withMaterialized(with_table_name, with_query)

  let stats_query
  if (limit_to_player_active_games) {
    stats_query = create_player_team_stats_query({
      with_table_name,
      select_column_names,
      rate_columns,
      row_axes,
      params,
      having_clauses,
      data_view_options
    })
  } else if (wrap_mode) {
    // Register `player_year_teams` BEFORE the `_team_stats` CTE that
    // references it -- PostgreSQL forbids forward references between sibling
    // CTEs. with_func runs before the dispatcher's join_func, so we apply
    // the bridge here; the later source-attach pass is a no-op via
    // `applied_bridges`. params.year is overridden with the wrap's resolved
    // years so the bridge doesn't fall back to current_season.year when the
    // multi-year scope came from view-level nfl_week_ids rather than from
    // params.year.
    apply_bridge({
      query_context,
      from: 'player_year',
      to: 'team_year',
      mode: 'default',
      params: { ...params, year: wrap_decision.years },
      source: null
    })
    stats_query = create_player_year_team_stats_wrap_query({
      with_table_name,
      select_column_names,
      rate_columns,
      having_clauses,
      params
    })
  } else {
    stats_query = create_team_stats_query({
      with_table_name,
      select_column_names,
      rate_columns,
      row_axes,
      params,
      having_clauses,
      data_view_options
    })
  }

  const with_stats_table_postfix = limit_to_player_active_games
    ? '_player_team_stats'
    : '_team_stats'
  const final_stats_table_name = `${with_table_name}${with_stats_table_postfix}`

  // TODO review this code
  // Check if this final table is the from table - if so, make sure it has pid and row-axis columns
  if (
    data_view_options &&
    final_stats_table_name === data_view_options.from_table_name
  ) {
    // Ensure the stats query includes pid and row-axis columns for from table compatibility
    if (limit_to_player_active_games) {
      // Player team stats already includes pid
      if (
        row_axes.includes('year') &&
        !stats_query.toString().includes(`${with_table_name}.year`)
      ) {
        stats_query.select(`${with_table_name}.year`)
        stats_query.groupBy(`${with_table_name}.year`)
      }
      if (
        row_axes.includes('week') &&
        !stats_query.toString().includes(`${with_table_name}.week`)
      ) {
        stats_query.select(`${with_table_name}.week`)
        stats_query.groupBy(`${with_table_name}.week`)
      }
    }
  }

  // MATERIALIZED for the same reason as the base stats CTE above.
  query.withMaterialized(final_stats_table_name, stats_query)
}

// Wrap-mode team-stats CTE: re-shapes the (nfl_team, year)-grain base CTE so
// each year's team-stat lands on the team the player actually played for
// that year (via player_year_teams), then sums to pid. Output schema matches
// the standard `_team_stats` CTE's stat columns so the column-defs'
// `with_where` / main-select expressions reference the same names; only the
// row key changes (pid instead of nfl_team).
function create_player_year_team_stats_wrap_query({
  with_table_name,
  select_column_names,
  rate_columns,
  having_clauses,
  params = {}
}) {
  // In a year_offset range the displayed rate is produced by the column's
  // self-contained `main_select_string_year_offset_range` correlated subquery,
  // which re-pools SUM(num)/NULLIF(SUM(den),0) off the carried components, so
  // the wrap CTE must NOT also emit a bare pre-pooled rate there (it would add
  // an unused column and drift the deployed range-wrap snapshots). Outside a
  // range the non-offset main-select reads the bare `_team_stats.<stat>`
  // column_value, so the wrap CTE must project it.
  const emit_bare_rate = !is_year_offset_range(params)

  const wrap_query = db(with_table_name)
    .select('player_year_teams.pid')
    .groupBy('player_year_teams.pid')
    .innerJoin('player_year_teams', function () {
      this.on('player_year_teams.team', '=', `${with_table_name}.nfl_team`)
      this.andOn('player_year_teams.year', '=', `${with_table_name}.year`)
    })

  const unique_select_column_names = new Set(select_column_names)
  for (const select_column_name of unique_select_column_names) {
    if (rate_columns.includes(select_column_name)) {
      // Carry numerator/denominator through to the outer query so
      // `with_where` (`sum(num)/NULLIF(sum(denom),0)`) keeps working
      // unchanged. The pre-aggregated rate would not be safely sum-able.
      wrap_query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}_numerator) as ${select_column_name}_numerator`
        )
      )
      wrap_query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}_denominator) as ${select_column_name}_denominator`
        )
      )
      // Outside a year_offset range, also project the bare pooled rate (raw
      // fraction, matching the season render scale -- no x100) so the
      // non-offset main-select `column_value` path resolves. sum() of the
      // bigint components is numeric, so this is true division, not integer
      // truncation.
      if (emit_bare_rate) {
        wrap_query.select(
          db.raw(
            `sum(${with_table_name}.${select_column_name}_numerator) / NULLIF(sum(${with_table_name}.${select_column_name}_denominator), 0) as ${select_column_name}`
          )
        )
      }
    } else {
      wrap_query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}) as ${select_column_name}`
        )
      )
    }
  }

  add_having_clauses({ query: wrap_query, having_clauses })

  return wrap_query
}

function create_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  row_axes,
  params,
  having_clauses,
  data_view_options
}) {
  const team_stats_query = db(with_table_name)
    .select(`${with_table_name}.nfl_team`)
    .groupBy(`${with_table_name}.nfl_team`)

  add_select_columns({
    query: team_stats_query,
    with_table_name,
    select_column_names,
    rate_columns,
    emit_numerator_denominator: is_year_offset_range(params)
  })
  add_row_axes({ query: team_stats_query, with_table_name, row_axes })
  add_having_clauses({ query: team_stats_query, having_clauses })

  return team_stats_query
}

function create_player_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  row_axes,
  params,
  having_clauses,
  data_view_options
}) {
  const default_params = get_play_by_play_default_params({ params })
  const player_team_stats_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .groupBy('player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join(`${with_table_name}`, function () {
      this.on('player_gamelogs.nfl_team', '=', `${with_table_name}.nfl_team`)
      this.andOn('nfl_games.season_year', '=', `${with_table_name}.year`)
      this.andOn('nfl_games.week', '=', `${with_table_name}.week`)
    })

  if (default_params.nfl_week_id) {
    const nfl_week = Array.isArray(default_params.nfl_week_id)
      ? default_params.nfl_week_id
      : [default_params.nfl_week_id]
    const { seas_types } = decompose_nfl_weeks({ nfl_weeks: nfl_week })
    if (!is_full_year_seas_type_coverage({ nfl_weeks: nfl_week })) {
      player_team_stats_query.whereIn('nfl_games.nfl_week_id', nfl_week)
    }
    if (seas_types.length) {
      player_team_stats_query.whereIn('nfl_games.season_type', seas_types)
    }
  } else {
    player_team_stats_query.whereIn(
      'nfl_games.season_type',
      default_params.seas_type
    )
  }

  // Match the base CTE's offset-range year window (above) so the gamelogs join
  // selects the same seasons the pre-aggregate covers; without this the games
  // filter stays pinned to params.year and the join is empty for the shifted
  // window.
  const effective_years = expand_years_for_offset_range({
    years: get_effective_years({ params, data_view_options }),
    params,
    row_axes
  })
  if (effective_years.length) {
    player_team_stats_query.whereIn('nfl_games.season_year', effective_years)
    player_team_stats_query.whereIn(
      'player_gamelogs.season_year',
      effective_years
    )
  }

  add_select_columns({
    query: player_team_stats_query,
    with_table_name,
    select_column_names,
    rate_columns,
    emit_numerator_denominator: is_year_offset_range(params)
  })
  add_row_axes({ query: player_team_stats_query, with_table_name, row_axes })
  add_having_clauses({ query: player_team_stats_query, having_clauses })

  return player_team_stats_query
}

function add_select_columns({
  query,
  with_table_name,
  select_column_names,
  rate_columns,
  // In a year_offset range the displayed value is produced by the correlated
  // subquery in select-string.mjs, which pools SUM(num)/SUM(den) itself. Carry
  // the summed numerator/denominator components through (matching the wrap CTE
  // shape) instead of collapsing to a pre-pooled quotient the subquery cannot
  // re-pool across the window.
  emit_numerator_denominator = false
}) {
  const unique_select_column_names = new Set(select_column_names)
  for (const select_column_name of unique_select_column_names) {
    if (rate_columns.includes(select_column_name)) {
      if (emit_numerator_denominator) {
        query.select(
          db.raw(
            `sum(${with_table_name}.${select_column_name}_numerator) as ${select_column_name}_numerator`
          )
        )
        query.select(
          db.raw(
            `sum(${with_table_name}.${select_column_name}_denominator) as ${select_column_name}_denominator`
          )
        )
      } else {
        query.select(
          db.raw(
            `sum(${with_table_name}.${select_column_name}_numerator) / sum(${with_table_name}.${select_column_name}_denominator) as ${select_column_name}`
          )
        )
      }
    } else {
      query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}) as ${select_column_name}`
        )
      )
    }
  }
}

function add_row_axes({ query, with_table_name, row_axes }) {
  if (row_axes.includes('year')) {
    query.select(`${with_table_name}.year`)
    query.groupBy(`${with_table_name}.year`)
  }

  if (row_axes.includes('week')) {
    query.select(`${with_table_name}.week`)
    query.groupBy(`${with_table_name}.week`)
  }
}

// TODO not sure if this is needed
function add_having_clauses({ query, having_clauses }) {
  for (const having_clause of having_clauses) {
    query.havingRaw(having_clause)
  }
}
