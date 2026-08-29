import {
  get_per_game_cte_table_name,
  join_per_game_cte
} from '#libs-server/data-views/period-denominator/per-game.mjs'
import { register_per_game_cte } from '#libs-server/data-views/register-per-game-cte.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const nfl_week_id = resolve_nfl_week_id_from_year_param(params)

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) career_year = [career_year]

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) career_game = [career_game]

  return { nfl_week_id, career_year, career_game }
}

const should_use_cte = ({ params = {}, row_axes = [] } = {}) => {
  const { nfl_week_id, career_year, career_game } = get_default_params({
    params
  })
  return (
    nfl_week_id.length > 0 ||
    career_year.length > 0 ||
    career_game.length > 0 ||
    row_axes.length > 0 ||
    is_year_offset_range(params)
  )
}

const get_cache_info = create_static_cache_info()

export default {
  player_nfl_teams: {
    is_where_column_array: ({ params = {}, row_axes = [] } = {}) =>
      should_use_cte({ params, row_axes }),
    select_as: () => 'player_nfl_teams',
    table_alias: ({ params = {}, row_axes = [] } = {}) => {
      if (should_use_cte({ params, row_axes })) {
        return get_per_game_cte_table_name({ params })
      }
      return 'player'
    },
    main_select: ({ table_name, params, column_index, row_axes }) => {
      if (should_use_cte({ params, row_axes })) {
        return [`${table_name}.teams as player_nfl_teams_${column_index}`]
      }
      return [`player.current_nfl_team as player_nfl_teams_${column_index}`]
    },
    main_where: ({ table_name, params, column_index, row_axes }) => {
      if (should_use_cte({ params, row_axes })) {
        return `${table_name}.teams`
      }
      return 'player.current_nfl_team'
    },
    main_group_by: ({ table_name, params, column_index, row_axes }) => {
      if (should_use_cte({ params, row_axes })) {
        return [`${table_name}.teams`]
      }
      return ['player.current_nfl_team']
    },
    // Set of all teams the player was on in any year of the window.
    //
    // This is the last correlated per-row subquery in the data-view column
    // family, and it is EXPENSIVE -- measured 2026-08-29 on production, not
    // estimated. It emits two different shapes and only one of them has to be
    // this way.
    //
    // WITH a year_reference (row_axes: ['year']), the predicate correlates on
    // the outer row's YEAR as well as its pid, so the value genuinely moves per
    // row and a pid-keyed relation cannot express it. That shape is correct as
    // written.
    //
    // WITHOUT one (no row_axes), the CTE groups by pid alone and carries no
    // `year` column, so the subquery reduces to re-deriving
    // `array_agg(DISTINCT t)` over `unnest(teams)` for the single matching row
    // -- a value the CTE ALREADY computed as `array_agg(distinct nfl_team)`.
    // Proven equivalent on production over all 28,807 players: zero rows where
    // the correlated form and a direct read of `teams` disagree.
    //
    // The cost of that redundancy is quadratic, because a MATERIALIZED CTE has
    // no index and the filter is a full scan of it per outer row. On a 500-row
    // view sorted on the column -- sorted deliberately, since a bare paged view
    // lets the LIMIT short-circuit it -- the planner puts the SubPlan at
    // 7,178,000 against the CTE's own 137,660, and EXPLAIN ANALYZE on the real
    // 28,807-row shape does not finish inside the statement timeout. Bounded to
    // a 1,000-player outer set it completes at 2,720ms, with the CTE Scan
    // reporting loops=1000 and `Rows Removed by Filter: 14502` on every one:
    // 14,503 CTE rows scanned to find the 1 that matches. Per-row cost is
    // ~0.92ms, which extrapolates to roughly 26 SECONDS of subquery work on the
    // full view.
    //
    // Note BUFFERS is the wrong meter here and reads as a false negative. The
    // CTE is a tuplestore, so re-scanning it costs no shared buffers beyond the
    // one-time materialization; the 572,453 buffers the CTE Scan node reports
    // are the CTE's own build, attributed to its first scan. The per-row cost
    // shows up in TIME and in loop count, not in buffers -- unlike the other
    // four in this family, which probed real indexes and so did show up there.
    //
    // NOT fixed here, and the reason is architectural rather than effort. The
    // only thing that removes a per-row scan of an unindexed CTE is joining it,
    // and this path deliberately has NO join: `get-data-view-results.mjs`
    // (group_needs_join_alias / group_offset_range_applies) DROPS the source
    // join precisely because a `main_select_string_year_offset_range` override
    // exists, on the contract that such an override is self-contained and
    // re-scans the source itself. Reading `teams` off a joined alias means
    // changing that contract for every column that declares an override -- the
    // same logic whose comments already record two regressions, dangling
    // aliases and invalid SQL. That is an operator-gated motion, not a
    // loose end. Surfaced with these numbers rather than started.
    main_select_string_year_offset_range: ({
      table_name,
      params,
      data_view_options
    }) => {
      const min_year_offset = Math.min(...params.year_offset)
      const max_year_offset = Math.max(...params.year_offset)
      const year_clause = data_view_options.year_reference
      const year_predicate = year_clause
        ? ` AND ${table_name}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset}`
        : ''
      return `(SELECT array_agg(DISTINCT t) FROM (SELECT unnest(${table_name}.teams) AS t FROM ${table_name} WHERE ${table_name}.pid = ${data_view_options.pid_reference}${year_predicate}) sub)`
    },
    register_ctes: ({ query, params, row_axes, data_view_options }) => {
      if (should_use_cte({ params, row_axes })) {
        register_per_game_cte({ query, params, row_axes, data_view_options })
      }
    },
    join: ({ query, table_name, params, row_axes, data_view_options }) => {
      if (
        data_view_options.query_context?.applied_output_ctes?.has(table_name)
      ) {
        return
      }
      if (should_use_cte({ params, row_axes })) {
        register_per_game_cte({ query, params, row_axes, data_view_options })
        join_per_game_cte({
          players_query: query,
          rate_type_table_name: table_name,
          row_axes,
          params,
          data_view_options
        })
      }
    },
    get_cache_info,
    source: { grain: 'player_year' }
  }
}
