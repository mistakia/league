import db from '#db'
import { nfl_plays_column_params, data_views_constants } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { add_player_stats_play_by_play_with_statement } from '#libs-server/data-views/add-player-stats-play-by-play-with-statement.mjs'
import { apply_plays_join } from '#libs-server/data-views/source-attach/apply-plays-join.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { derive_measure } from '#libs-server/data-views/measure/measure-contract.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'

// Every key apply_play_by_play_column_params_to_query may read from the
// column's params. Declared as consumes_params_extra so the output-aggregator
// group_key / cte_name hashes reflect per-column filter divergence (e.g.
// two rush_yards_from_plays instances where only one carries yards_gained
// must materialize into distinct CTEs rather than batching into one).
const play_by_play_filter_param_keys = Object.keys(nfl_plays_column_params)

const should_use_main_where = ({ params, has_numerator_denominator }) => {
  // Equal-endpoint offsets ([k,k]) are a single-year shift, NOT a range: the
  // CTE stays collapsed and the source join correlates the single year. Only a
  // genuine multi-year range (is_year_offset_range) reduces num/den in the
  // main SELECT. See year-offset-range.mjs for the canonical predicate.
  return is_year_offset_range(params) && has_numerator_denominator
}

const plays_source = {
  grain: 'player_year',
  // Grain narrowed to player_year (not player_year_week) so the team-to-
  // team-year bridge path doesn't get exercised by week row_axes. The `with`
  // builder (add_player_stats_play_by_play_with_statement) projects year
  // AND week onto the CTE; declare supports_row_axes so the dispatcher
  // forwards both to with_func instead of intersecting against grain's
  // ['year'] and dropping week.
  supports_row_axes: ['year', 'week'],
  attach: apply_plays_join
}

const generate_table_alias = ({ type, params = {}, pid_columns } = {}) => {
  if (!type) {
    throw new Error('type is required')
  }

  if (!pid_columns || !Array.isArray(pid_columns) || pid_columns.length === 0) {
    throw new Error('pid_columns must be a non-empty array')
  }

  const key = get_stats_column_param_key({ params })
  const pid_columns_string = [...pid_columns].sort().join('_')
  return get_table_hash(`${type}_${pid_columns_string}_${key}`)
}

const player_stat_from_plays = ({
  pid_columns,
  with_select_string,
  stat_name,
  numerator_select,
  denominator_select,
  has_numerator_denominator = false,
  // Distinguishes a percentage rate (×100 scaling, e.g. completion %) from a
  // plain ratio (×1, e.g. Y/A, aDOT). The season render bakes `100.0 *` in by
  // hand for percentages and omits it for ratios; the generic year-offset
  // paths (main_where here, and the correlated subquery in select-string.mjs)
  // cannot tell them apart from has_numerator_denominator alone, so this flag
  // threads the distinction through. A consistency invariant below fails fast
  // if the flag disagrees with the season render's scaling.
  is_percentage = false,
  measure = null,
  measure_expr = null,
  supports_periods = [
    'team_half',
    'team_quarter',
    'team_play',
    'team_pass_play',
    'team_rush_play',
    'team_drive',
    'team_series',

    'player_rush_attempt',
    'player_pass_attempt',
    'player_target',
    'player_catchable_target',
    'player_catchable_deep_target',
    'player_reception',

    'player_play',
    'player_route',
    'player_pass_play',
    'player_rush_play'
  ]
}) => {
  // Measure-first contract: a rate-capable single-aggregate column declares an
  // explicit `measure: { accumulators, combine }`; derive_measure produces the
  // season render, numerator measure_expr, period aggregate, supports_output,
  // and decimals rounding from it. Non-rate columns (averages, compound ratios,
  // numerator/denominator ratios) declare no measure, keep their raw
  // with_select_string, and pass supports_periods: [].
  const derived = measure
    ? derive_measure({ stat_name, measure, supports_periods })
    : null

  // Fail-fast invariant (scoped to this factory): a column advertising any
  // denominator period MUST declare a measure; a column left on a raw
  // with_select_string MUST pass supports_periods: []. Throws at module load,
  // making the silent-rate-drop class (e.g. time_to_throw) structurally
  // impossible.
  if (!derived && supports_periods && supports_periods.length > 0) {
    throw new Error(
      `player_stat_from_plays: '${stat_name}' advertises output periods but declares no measure -- declare measure: { accumulators, combine } or set supports_periods: []`
    )
  }

  // The season render is the deriver's with_select for measure columns, else
  // the raw string (carve-outs and numerator/denominator ratios).
  const season_select = derived ? derived.with_select : with_select_string

  // Fail-fast invariant: for numerator/denominator columns, the is_percentage
  // flag MUST agree with the season render's scaling. A percentage column bakes
  // `100.0 *` into its with_select_string; a ratio column does not. If they
  // disagree, the year-offset paths would mis-scale by 100x (the latent bug
  // this flag fixes), so catch the misclassification at module load.
  if (has_numerator_denominator) {
    const season_has_percentage_scale = /100\.0\s*\*/.test(
      String(season_select)
    )
    if (season_has_percentage_scale !== Boolean(is_percentage)) {
      throw new Error(
        `player_stat_from_plays: '${stat_name}' is_percentage=${Boolean(
          is_percentage
        )} disagrees with its season render (${
          season_has_percentage_scale ? 'has' : 'lacks'
        } 100.0 * scaling) -- set is_percentage to match the with_select_string`
      )
    }
  }

  const final_supports_output = derived ? derived.supports_output : null
  // An explicit table-qualified measure_expr override (e.g.
  // player_receiving_yards_from_plays) wins over the deriver's default.
  const final_measure_expr =
    measure_expr || (derived ? derived.measure_expr : null)
  const final_aggregate = derived ? derived.aggregate : null
  const final_decimals = derived ? derived.decimals : null
  // Mirror `add_player_stats_play_by_play_with_statement` filtering against
  // the aggregator-rate / aggregator-count CTE so cross-period totals match
  // legacy parity. Measure columns only -- columns with hand-supplied
  // `apply_filters` (e.g. fantasy points) keep their own bypass.
  const final_apply_filters = derived
    ? ({ query, params }) => {
        const defaults = get_play_by_play_default_params({ params })
        const filtered_params = { ...defaults }
        delete filtered_params.career_year
        delete filtered_params.career_game
        query.whereNot('nfl_plays.play_type', 'NOPL')
        apply_play_by_play_column_params_to_query({
          query,
          params: filtered_params,
          table_name: 'nfl_plays'
        })
      }
    : null
  return {
    table_alias: ({ params }) =>
      generate_table_alias({ type: 'play_by_play', params, pid_columns }),
    column_name: stat_name,
    with_select: ({ params = {} }) => {
      if (is_year_offset_range(params) && has_numerator_denominator) {
        return [
          `${numerator_select} as ${stat_name}_numerator`,
          `${denominator_select} as ${stat_name}_denominator`
        ]
      }
      return [`${season_select} as ${stat_name}`]
    },
    has_numerator_denominator,
    // Surfaced on the column definition so the generic year-offset correlated
    // subquery path in select-string.mjs can scale percentages by 100 and
    // leave ratios at 1, consistently with main_where above.
    is_percentage,
    with_where: ({ params }) => {
      if (should_use_main_where({ params, has_numerator_denominator })) {
        return null // No where clause in the WITH statement when using year_offset range with numerator/denominator
      }
      return season_select
    },
    main_where: ({ params, table_name }) => {
      if (should_use_main_where({ params, has_numerator_denominator })) {
        // LIVE year-offset numerator/denominator assembly. Percentage columns
        // scale by 100 (matching their season render); ratio columns do not,
        // and must cast to decimal so the bigint/bigint quotient is not
        // truncated by integer division.
        //
        // An undefined ratio is NULL, not zero: a player with no targets did
        // not have a 0% catch rate. The NULLIF is the whole guard -- the
        // zero-substituting CASE this used to carry made the filter path
        // disagree with the display path, which emits NULL.
        const num_sum = `SUM(${table_name}.${stat_name}_numerator)`
        const den_sum = `SUM(${table_name}.${stat_name}_denominator)`
        return is_percentage
          ? `ROUND(100.0 * ${num_sum} / NULLIF(${den_sum}, 0), 2)`
          : `ROUND(${num_sum}::decimal / NULLIF(${den_sum}, 0), 2)`
      }
      return null
    },
    main_where_group_by: ({ params, table_name }) => {
      if (should_use_main_where({ params, has_numerator_denominator })) {
        const group_by = []
        if (has_numerator_denominator) {
          group_by.push(`SUM(${table_name}.${stat_name}_numerator)`)
          group_by.push(`SUM(${table_name}.${stat_name}_denominator)`)
        } else {
          group_by.push(`${table_name}.${stat_name}`)
        }

        return group_by
      }
      return []
    },
    pid_columns,
    with: add_player_stats_play_by_play_with_statement,
    source: plays_source,
    use_having: true,
    supports_periods,
    ...(final_supports_output
      ? { supports_output: final_supports_output, measure_source: 'plays' }
      : {}),
    ...(final_measure_expr ? { measure_expr: final_measure_expr } : {}),
    ...(final_aggregate ? { aggregate: final_aggregate } : {}),
    ...(final_decimals != null ? { decimals: final_decimals } : {}),
    ...(final_apply_filters
      ? {
          apply_filters: final_apply_filters,
          consumes_params_extra: play_by_play_filter_param_keys
        }
      : {}),
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}

const create_team_share_stat = ({
  column_name,
  pid_columns,
  with_select_string,
  numerator_select,
  denominator_select,
  has_numerator_denominator = false,
  // Team shares are percentages (their season render bakes in `100.0 *`), so
  // this defaults true. Threaded through main_where and onto the column
  // definition so the year-offset paths scale consistently with the season
  // render -- see the matching flag in player_stat_from_plays.
  is_percentage = true,
  with_select_string_year_offset_range,
  main_select_string_year_offset_range
}) => ({
  with: ({
    query,
    with_table_name,
    params,
    having_clauses = [],
    row_axes = [],
    data_view_options = {}
  }) => {
    const { seas_type } = get_play_by_play_default_params({ params })

    const with_query = db('nfl_plays')
      .select('pg.pid')
      .join('player_gamelogs as pg', function () {
        this.on('nfl_plays.esbid', '=', 'pg.esbid').andOn(
          'nfl_plays.offense_nfl_team',
          '=',
          'pg.nfl_team'
        )
      })
      .whereNot('play_type', 'NOPL')
      .where(function () {
        for (const pid_column of pid_columns) {
          this.orWhereNotNull(pid_column)
        }
      })
      .groupBy('pg.pid')

    if (is_year_offset_range(params)) {
      if (has_numerator_denominator) {
        with_query.select(
          db.raw(`${numerator_select} as ${column_name}_numerator`)
        )
        with_query.select(
          db.raw(`${denominator_select} as ${column_name}_denominator`)
        )
      } else if (with_select_string_year_offset_range) {
        with_query.select(db.raw(with_select_string_year_offset_range))
      }
    } else {
      with_query.select(db.raw(`${with_select_string} as ${column_name}`))
    }

    for (const row_axis of row_axes) {
      if (data_views_constants.row_axis_params.includes(row_axis)) {
        const column_param_definition = nfl_plays_column_params[row_axis]
        const table_name =
          (column_param_definition && column_param_definition.table) ||
          'nfl_plays'
        // Grain axis stays 'year' in the row-axis vocabulary; the physical
        // column is season_year post-rename, so alias it back to 'year' at
        // this CTE boundary.
        const physical_row_axis = row_axis === 'year' ? 'season_year' : row_axis
        const row_axis_statement =
          row_axis === 'year'
            ? `${table_name}.${physical_row_axis} as year`
            : `${table_name}.${physical_row_axis}`
        with_query.select(row_axis_statement)
        with_query.groupBy(`${table_name}.${physical_row_axis}`)
      }
    }

    // Handle career_year
    if (params.career_year) {
      with_query.join('player_seasonlogs', function () {
        this.on('nfl_plays.season_year', '=', 'player_seasonlogs.season_year')
          .andOn('nfl_plays.season_type', '=', 'player_seasonlogs.season_type')
          .andOn('pg.pid', '=', 'player_seasonlogs.pid')
      })
      with_query.whereBetween('player_seasonlogs.career_year', [
        Math.min(params.career_year[0], params.career_year[1]),
        Math.max(params.career_year[0], params.career_year[1])
      ])
    }

    // Handle career_game
    if (params.career_game) {
      with_query.whereBetween('pg.career_game', [
        Math.min(params.career_game[0], params.career_game[1]),
        Math.max(params.career_game[0], params.career_game[1])
      ])
    }

    // Remove career_year and career_game from params before applying other filters
    const filtered_params = { ...params, seas_type }
    delete filtered_params.career_year
    delete filtered_params.career_game

    apply_play_by_play_column_params_to_query({
      query: with_query,
      params: filtered_params,
      query_context: data_view_options.query_context
    })

    const unique_having_clauses = new Set(having_clauses)
    for (const having_clause of unique_having_clauses) {
      with_query.havingRaw(having_clause)
    }

    const view_scope_emitted =
      data_view_options.query_context &&
      data_view_options.query_context.nfl_week_ids &&
      data_view_options.query_context.nfl_week_ids.length
    const effective_years = get_effective_years({ params, data_view_options })
    if (effective_years.length) {
      // pg.season_year (player_gamelogs) is always safe to push -- apply_play_by_play
      // does not reach player_gamelogs. Skip nfl_plays.season_year when nfl_week_id is
      // set OR when view scope has already emitted year, to avoid a duplicate.
      if (!params.nfl_week_id && !view_scope_emitted) {
        with_query.whereIn('nfl_plays.season_year', effective_years)
      }
      with_query.whereIn('pg.season_year', effective_years)
    }

    // MATERIALIZED required: predicates are pushed at construction time; planner
    // predicate push-into-CTE is not needed and would let the planner inline the
    // CTE into a nested-loop that re-executes it per outer row.
    query.withMaterialized(with_table_name, with_query)
  },
  column_name,
  use_having: true,
  table_alias: ({ params }) =>
    generate_table_alias({ type: column_name, params, pid_columns }),
  source: plays_source,
  has_numerator_denominator,
  is_percentage,
  main_select_string_year_offset_range,
  with_where: ({ params }) => {
    if (is_year_offset_range(params) && has_numerator_denominator) {
      // No where clause in the WITH statement when using year_offset range with numerator/denominator
      return null
    }
    return with_select_string
  },
  main_where: ({ params, table_name, data_view_options }) => {
    if (is_year_offset_range(params)) {
      if (has_numerator_denominator) {
        // An undefined ratio is NULL, not zero -- see the matching comment in
        // player_stat_from_plays's main_where. The NULLIF is the whole guard.
        const num_sum = `SUM(${table_name}.${column_name}_numerator)`
        const den_sum = `SUM(${table_name}.${column_name}_denominator)`
        return is_percentage
          ? `ROUND(100.0 * ${num_sum} / NULLIF(${den_sum}, 0), 2)`
          : `ROUND(${num_sum}::decimal / NULLIF(${den_sum}, 0), 2)`
      } else if (main_select_string_year_offset_range) {
        return main_select_string_year_offset_range({
          table_name,
          params,
          data_view_options
        })
      }
    }
    return null
  },
  get_cache_info: get_cache_info_for_fields_from_plays
})

export default {
  player_pass_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `pass_yards` } },
      combine: 'identity'
    },
    stat_name: 'pass_yds_from_plays'
  }),
  player_pass_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'pass_atts_from_plays'
  }),
  // TODO prevent from applying rate_type to this
  // TODO set the `qb_pid` for each play
  // player_pass_rate_over_expected_from_plays: player_stat_from_plays({
  //   pid_columns: ['qb_pid'],
  //   with_select_string: `AVG(pass_over_expected)`,
  //   stat_name: 'pass_rate_over_expected_from_plays'
  // }),
  player_pass_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'pass_tds_from_plays'
  }),
  player_pass_interceptions_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_interception = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'pass_ints_from_plays'
  }),
  player_pass_completions_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'pass_comps_from_plays'
  }),
  player_pass_first_downs_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_first_down = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'pass_first_downs_from_plays'
  }),
  player_dropped_passing_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_dropped_pass = true THEN depth_of_target ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END) / SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'pass_comp_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_completion_percentage_over_expected_from_plays: player_stat_from_plays(
    {
      pid_columns: ['passer_pid'],
      with_select_string: `AVG(completion_percentage_over_expected)`,
      stat_name: 'pass_comp_pct_over_expected_from_plays',
      // CPOE is a per-dropback mean; a range year_offset must pool the summed
      // completion_percentage_over_expected over the summed qualifying-dropback count, not SUM the per-season
      // averages.
      numerator_select: `SUM(completion_percentage_over_expected)`,
      denominator_select: `SUM(CASE WHEN completion_percentage_over_expected IS NOT NULL THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      supports_periods: []
    }
  ),
  player_expected_completion_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    // Expected completion % = mean completion probability x 100. Expressed as
    // SUM(completion_probability)/COUNT(completion_probability) x 100 (mathematically identical to AVG(completion_probability) * 100) so it
    // can pool across a multi-year year_offset range via numerator/denominator
    // instead of summing per-season means; rounded to 2 decimals to match the
    // sibling percentage columns.
    with_select_string: `CASE WHEN SUM(CASE WHEN completion_probability IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(completion_probability) / NULLIF(SUM(CASE WHEN completion_probability IS NOT NULL THEN 1 ELSE 0 END), 0), 2) ELSE NULL END`,
    stat_name: 'expected_pass_comp_pct_from_plays',
    numerator_select: `SUM(completion_probability)`,
    denominator_select: `SUM(CASE WHEN completion_probability IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_pass_touchdown_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_touchdown = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_touchdown = true THEN 1 ELSE 0 END) / SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'pass_td_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_touchdown = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_pass_interception_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_interception = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_interception = true THEN 1 ELSE 0 END) / SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'pass_int_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_interception = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_pass_interception_worthy_percentage_from_plays: player_stat_from_plays(
    {
      pid_columns: ['passer_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN is_interception_worthy = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_interception_worthy = true THEN 1 ELSE 0 END) / SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END), 2) ELSE NULL END`,
      stat_name: 'pass_int_worthy_pct_from_plays',
      numerator_select: `SUM(CASE WHEN is_interception_worthy = true THEN 1 ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      is_percentage: true,
      supports_periods: []
    }
  ),
  player_pass_yards_after_catch_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_after_catch` } },
      combine: 'identity'
    },
    stat_name: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays:
    player_stat_from_plays({
      pid_columns: ['passer_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(yards_after_catch)::decimal / SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
      stat_name: 'pass_yds_after_catch_per_comp_from_plays',
      numerator_select: `SUM(yards_after_catch)`,
      denominator_select: `SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      supports_periods: []
    }),
  player_pass_yards_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(pass_yards)::decimal / SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'pass_yds_per_att_from_plays',
    numerator_select: `SUM(pass_yards)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_pass_depth_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(depth_of_target)::decimal / SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'pass_depth_per_att_from_plays',
    numerator_select: `SUM(depth_of_target)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_pass_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `depth_of_target` } },
      combine: 'identity'
    },
    stat_name: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(depth_of_target)::decimal / SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'comp_air_yds_per_comp_from_plays',
    numerator_select: `SUM(depth_of_target)`,
    denominator_select: `SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),

  // completed air yards / total air yards (a unitless ratio, not a percentage)
  player_passing_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(depth_of_target) > 0 THEN CAST(ROUND(SUM(CASE WHEN is_completion = true THEN depth_of_target ELSE 0 END)::decimal / NULLIF(SUM(depth_of_target), 0), 4) AS decimal) ELSE NULL END`,
    stat_name: 'pass_air_conv_ratio_from_plays',
    numerator_select: `SUM(CASE WHEN is_completion = true THEN depth_of_target ELSE 0 END)`,
    denominator_select: `SUM(depth_of_target)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_sacked_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'sacked_from_plays'
  }),
  player_sacked_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack = true THEN yards_gained ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_sack = true THEN 1 ELSE 0 END) / SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'sacked_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_sack = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_quarterback_hits_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_qb_hit = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'qb_hit_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_qb_hit = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_quarterback_pressures_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_qb_pressure = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'qb_press_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_qb_pressure = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_quarterback_hurries_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_qb_hurry = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'qb_hurry_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_qb_hurry = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),

  // net yards per passing attempt: (pass yards - sack yards)/(passing attempts + sacks).
  // sacks included in calculation because passer_pid is set on all attempts or sacks
  player_pass_net_yards_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND((SUM(pass_yards) - SUM(CASE WHEN is_sack = true THEN yards_gained ELSE 0 END))::decimal / SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'pass_net_yds_per_att_from_plays',
    numerator_select: `SUM(pass_yards) - SUM(CASE WHEN is_sack = true THEN yards_gained ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),

  player_rush_yards_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `rush_yards` } },
      combine: 'identity'
    },
    stat_name: 'rush_yds_from_plays'
  }),
  player_rush_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(rush_yards)::decimal / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'rush_yds_per_att_from_plays',
    numerator_select: `SUM(rush_yards)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_rush_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rush_atts_from_plays'
  }),
  player_average_box_defenders_per_rush_attempt_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid'],
      with_select_string: `CAST(ROUND(AVG(CASE WHEN ball_carrier_pid IS NOT NULL THEN box_defenders ELSE NULL END)::decimal, 2) AS decimal)`,
      stat_name: 'average_box_defenders_per_rush_att_from_plays',
      // The numerator/denominator pair must decompose the SEASON RENDER's AVG,
      // not the column's NAME. AVG(box_defenders) is SUM(box_defenders) over
      // COUNT(box_defenders), so the denominator counts rows carrying a
      // box_defenders reading -- NOT rush attempts. The two differ: 14,680
      // against 14,687 for 2024 REG.
      //
      // The previous declaration paired an AVG numerator with a rush-attempt
      // denominator, so every year_offset-range recombination divided a MEAN
      // (~6.7) by an attempt COUNT -- measured 0.000460 against a true pooled
      // 6.760 for 2022-2024 REG, and reproduced on seeded data at 1.83 against
      // a true 7.33 by
      // test/data-view-queries/player-box-defenders-range-offset-pooled-result-equivalence.json.
      numerator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN box_defenders ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL AND box_defenders IS NOT NULL THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      supports_periods: []
    }),
  player_rush_first_downs_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_first_down = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rush_first_downs_from_plays'
  }),
  player_positive_rush_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN rush_yards > 0 THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: { aggregate: 'sum', expr: `yards_after_any_contact` }
      },
      combine: 'identity'
    },
    stat_name: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(yards_after_any_contact)::decimal / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
      stat_name: 'rush_yds_after_contact_per_att_from_plays',
      numerator_select: `SUM(yards_after_any_contact)`,
      denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      supports_periods: []
    }),
  player_rush_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_first_down = true THEN 1 ELSE 0 END) / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'rush_first_down_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_first_down = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_weighted_opportunity_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.yard_line_100 <= 20 AND ball_carrier_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.yard_line_100 <= 20 AND target_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.yard_line_100 > 20 AND ball_carrier_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.yard_line_100 > 20 AND target_pid IS NOT NULL THEN 1.43 ELSE 0 END`
        }
      },
      combine: 'identity',
      decimals: 2
    },
    stat_name: 'weighted_opportunity_from_plays'
  }),
  player_high_value_touches_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN (ball_carrier_pid IS NOT NULL AND yard_line_100 <= 10) OR (target_pid IS NOT NULL AND is_completion = true) THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'high_value_touches_from_plays'
  }),
  player_touches_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL OR (target_pid IS NOT NULL AND is_completion = true) THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'touches_from_plays'
  }),

  player_opportunities_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid', 'passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL OR target_pid IS NOT NULL OR (passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false)) THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'opportunities_from_plays'
  }),

  player_rush_attempts_share_from_plays: create_team_share_stat({
    column_name: 'rush_att_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    with_select_string:
      'ROUND(100.0 * COUNT(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `COUNT(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_rush_yards_share_from_plays: create_team_share_stat({
    column_name: 'rush_yds_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    with_select_string:
      'CASE WHEN SUM(nfl_plays.rush_yards) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN nfl_plays.rush_yards ELSE 0 END) / NULLIF(SUM(nfl_plays.rush_yards), 0), 2) ELSE NULL END',
    numerator_select: `SUM(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN nfl_plays.rush_yards ELSE 0 END)`,
    denominator_select: `SUM(nfl_plays.rush_yards)`,
    has_numerator_denominator: true
  }),
  player_rush_first_down_share_from_plays: create_team_share_stat({
    column_name: 'rush_first_down_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    with_select_string:
      'CASE WHEN SUM(CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END), 0), 2) ELSE NULL END',
    numerator_select: `SUM(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_opportunity_share_from_plays: create_team_share_stat({
    column_name: 'opportunity_share_from_plays',
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    with_select_string: `ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.ball_carrier_pid IS NOT NULL OR nfl_plays.target_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2)`,
    numerator_select: `COUNT(CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.ball_carrier_pid IS NOT NULL OR nfl_plays.target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_fumbles_from_plays: player_stat_from_plays({
    pid_columns: ['fumble_lost_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN fumble_lost_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'fumbles_from_plays'
  }),

  player_fumbles_lost_from_plays: player_stat_from_plays({
    pid_columns: ['fumble_lost_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN fumble_lost_pid IS NOT NULL AND is_fumble_lost = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'fumbles_lost_from_plays'
  }),

  player_fumble_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN fumble_lost_pid = ball_carrier_pid THEN 1 ELSE 0 END) / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'fumble_pct_from_plays',
    numerator_select: `SUM(CASE WHEN fumble_lost_pid = ball_carrier_pid THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_positive_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN rush_yards > 0 THEN 1 ELSE 0 END) / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'positive_rush_pct_from_plays',
    numerator_select: `SUM(CASE WHEN rush_yards > 0 THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_successful_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END) / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'succ_rush_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_broken_tackles_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: {
        value: { aggregate: 'sum', expr: `missed_or_broken_tackle` }
      },
      combine: 'identity'
    },
    stat_name: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(missed_or_broken_tackle)::decimal / SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'broken_tackles_per_rush_att_from_plays',
    numerator_select: `SUM(missed_or_broken_tackle)`,
    denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_receptions_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'recs_from_plays'
  }),
  player_receiving_yards_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rec_yds_from_plays',
    measure_expr: ({ table_name }) =>
      `CASE WHEN ${table_name}.is_completion = true THEN ${table_name}.receiving_yards ELSE 0 END`
  }),
  player_receiving_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true AND is_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rec_tds_from_plays'
  }),
  player_receiving_or_rushing_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid', 'ball_carrier_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rec_or_rush_tds_from_plays'
  }),
  player_drops_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_dropped_pass = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'drops_from_plays'
  }),
  player_dropped_receiving_yards_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_dropped_pass = true THEN depth_of_target ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'drop_rec_yds_from_plays'
  }),
  player_targets_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'trg_from_plays'
  }),
  player_deep_targets_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN depth_of_target >= 20 THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN depth_of_target >= 20 THEN 1 ELSE 0 END) / SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'deep_trg_pct_from_plays',
    numerator_select: `SUM(CASE WHEN depth_of_target >= 20 THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),
  player_air_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(depth_of_target)::decimal / SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'air_yds_per_trg_from_plays',
    numerator_select: `SUM(depth_of_target)`,
    denominator_select: `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `depth_of_target` } },
      combine: 'identity'
    },
    stat_name: 'air_yds_from_plays'
  }),
  player_receiving_first_down_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_first_down = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'recv_first_down_from_plays'
  }),
  player_receiving_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_first_down = true THEN 1 ELSE 0 END) / SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE NULL END`,
    stat_name: 'recv_first_down_pct_from_plays',
    numerator_select: `SUM(CASE WHEN is_first_down = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),

  player_air_yards_share_from_plays: create_team_share_stat({
    column_name: 'air_yds_share_from_plays',
    pid_columns: ['target_pid'],
    with_select_string:
      'CASE WHEN SUM(nfl_plays.depth_of_target) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END) / NULLIF(SUM(nfl_plays.depth_of_target), 0), 2) ELSE NULL END',
    // A share is a ratio, not additive: a range year_offset must recombine the
    // summed player air yards over the summed team air yards, not SUM the
    // per-season share percentages. Mirrors player_target_share_from_plays.
    numerator_select: `SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END)`,
    denominator_select: `SUM(nfl_plays.depth_of_target)`,
    has_numerator_denominator: true
  }),
  player_target_share_from_plays: create_team_share_stat({
    column_name: 'trg_share_from_plays',
    pid_columns: ['target_pid'],
    with_select_string:
      'ROUND(100.0 * COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END)`,
    denominator_select: `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_weighted_opportunity_rating_from_plays: create_team_share_stat({
    column_name: 'weighted_opp_rating_from_plays',
    pid_columns: ['target_pid'],
    with_select_string:
      'ROUND((1.5 * COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END) / NULLIF(SUM(nfl_plays.depth_of_target), 0)), 4)',
    with_select_string_year_offset_range:
      'COUNT(CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END) as player_targets, SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END) as team_targets, SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END) as player_air_yards, SUM(nfl_plays.depth_of_target) as team_air_yards',
    main_select_string_year_offset_range: ({
      table_name,
      params,
      data_view_options = {}
    }) => {
      // The CTE only projects `year` when a year split exposes a
      // year_reference to correlate against; without one it groups to pid
      // grain and is already scoped to the offset window by its own effective
      // years, so the window predicate is both invalid and redundant. Mirrors
      // the year_reference guard in player-team-column-definition.
      const year_reference = data_view_options.year_reference
      const year_predicate = year_reference
        ? ` AND ${table_name}.year BETWEEN ${year_reference} + ${Math.min(...params.year_offset)} AND ${year_reference} + ${Math.max(...params.year_offset)}`
        : ''
      return `(SELECT ROUND((1.5 * SUM(${table_name}.player_targets) / NULLIF(SUM(${table_name}.team_targets), 0)) + (0.7 * SUM(${table_name}.player_air_yards) / NULLIF(SUM(${table_name}.team_air_yards), 0)), 4) FROM ${table_name} WHERE ${table_name}.pid = ${data_view_options.pid_reference}${year_predicate})`
    }
  }),
  player_receiving_first_down_share_from_plays: create_team_share_stat({
    column_name: 'recv_first_down_share_from_plays',
    pid_columns: ['target_pid'],
    with_select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `SUM(CASE WHEN nfl_plays.target_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_receiving_yards_after_catch_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN yards_after_catch ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'rec_yds_after_catch_from_plays'
  }),

  // receiving yards / air yards (a unitless ratio, not a percentage)
  player_receiver_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    with_select_string: `CASE WHEN SUM(depth_of_target) > 0 THEN CAST(ROUND(SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)::decimal / NULLIF(SUM(depth_of_target), 0), 4) AS decimal) ELSE NULL END`,
    stat_name: 'rec_air_conv_ratio_from_plays',
    numerator_select: `SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)`,
    denominator_select: `SUM(depth_of_target)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_receiving_yards_per_reception_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)::decimal / SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'rec_yds_per_rec_from_plays',
    numerator_select: `SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_receiving_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    // Divides by TARGETS. Until 2026-08-19 every expression here was
    // byte-identical to player_receiving_yards_per_reception_from_plays above,
    // so the two columns emitted the same number on both the season render and
    // the year-offset range.
    with_select_string: `CASE WHEN SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)::decimal / SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
    stat_name: 'rec_yds_per_trg_from_plays',
    numerator_select: `SUM(CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  }),
  player_receiving_yards_after_catch_per_reception_from_plays:
    player_stat_from_plays({
      pid_columns: ['target_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN is_completion = true THEN yards_after_catch ELSE 0 END)::decimal / SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE NULL END`,
      stat_name: 'rec_yds_after_catch_per_rec_from_plays',
      numerator_select: `SUM(CASE WHEN is_completion = true THEN yards_after_catch ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN is_completion = true THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      supports_periods: []
    }),

  player_yards_created_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_created` } },
      combine: 'identity'
    },
    stat_name: 'yards_created_from_plays'
  }),

  player_yards_blocked_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_blocked` } },
      combine: 'identity'
    },
    stat_name: 'yards_blocked_from_plays'
  }),
  player_successful_passing_play_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) ELSE NULL END`,
    stat_name: 'successful_passing_play_pct_from_plays',
    // Pool numerator/denominator across a multi-year year_offset range instead
    // of summing per-season percentages (the latent SUM-of-percentages bug).
    numerator_select: `SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    is_percentage: true,
    supports_periods: []
  }),

  player_successful_rushing_and_receiving_play_percentage_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid', 'target_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ball_carrier_pid IS NOT NULL OR target_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) ELSE NULL END`,
      stat_name: 'successful_rushing_and_receiving_play_pct_from_plays',
      // Pool numerator/denominator across a multi-year year_offset range instead
      // of summing per-season percentages (the latent SUM-of-percentages bug).
      numerator_select: `SUM(CASE WHEN is_successful_play = true THEN 1 ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN ball_carrier_pid IS NOT NULL OR target_pid IS NOT NULL THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true,
      is_percentage: true,
      supports_periods: []
    }),

  player_total_expected_points_added_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid', 'ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `epa` } },
      combine: 'identity'
    },
    stat_name: 'total_expected_points_added_from_plays'
  }),

  player_passing_expected_points_added_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `epa` } },
      combine: 'identity'
    },
    stat_name: 'passing_expected_points_added_from_plays'
  }),

  player_rushing_and_receiving_expected_points_added_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid', 'target_pid'],
      measure: {
        accumulators: { value: { aggregate: 'sum', expr: `epa` } },
        combine: 'identity'
      },
      stat_name: 'rushing_and_receiving_expected_points_added_from_plays'
    }),

  player_quarterback_epa_from_plays: player_stat_from_plays({
    pid_columns: ['qb_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `quarterback_epa` } },
      combine: 'identity'
    },
    stat_name: 'quarterback_epa_from_plays'
  }),

  player_quarterback_pressures_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_qb_pressure_tracking = true OR is_qb_pressure = true THEN 1 ELSE 0 END`
        }
      },
      combine: 'identity'
    },
    stat_name: 'quarterback_pressures_from_plays'
  }),

  player_time_to_throw_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    with_select_string: `AVG(CASE WHEN time_to_throw IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN time_to_throw ELSE NULL END)`,
    stat_name: 'time_to_throw_from_plays',
    // Time-to-throw is a per-dropback mean; a range year_offset must pool the
    // summed time over the summed qualifying-dropback count, not SUM the
    // per-season averages.
    numerator_select: `SUM(CASE WHEN time_to_throw IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN time_to_throw ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN time_to_throw IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true,
    supports_periods: []
  })
}
