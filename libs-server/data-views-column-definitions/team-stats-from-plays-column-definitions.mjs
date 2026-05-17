import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/data-views/add-team-stats-play-by-play-with-statement.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import { nfl_plays_team_column_params } from '#libs-shared'
import {
  strip_outer_sum,
  derive_periods_from_rate_types
} from '#libs-server/data-views/strip-outer-sum.mjs'

const generate_table_alias = ({ params = {} } = {}) => {
  const additional_keys = Object.keys(nfl_plays_team_column_params).sort()
  const key = get_stats_column_param_key({ params, additional_keys })
  return get_table_hash(`team_stats_from_plays__${key}`)
}

// Mirrors data_view_join_function with join_year_on_year_split=true. Two
// shapes: player-identity (force_player_active=true) joins the *_player_team_
// stats CTE by pid; team-identity joins the *_team_stats CTE by team. Year
// and week predicates are emitted only when the bucket's splits projected
// those columns onto the CTE.
const apply_team_stats_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  splits = [],
  force_player_active
}) => {
  const dv = query_context.data_view_options || {}
  const { players_query } = query_context
  const pid_reference = dv.pid_reference ?? query_context.pid_reference
  const team_reference = dv.team_reference ?? query_context.team_reference
  const year_reference = dv.year_reference ?? query_context.year_reference
  const week_reference = dv.week_reference ?? query_context.week_reference
  const player_year_teams_cte_name =
    dv.player_year_teams_cte_name ?? query_context.player_year_teams_cte_name
  const limit_to_player_active_games =
    force_player_active || params?.limit_to_player_active_games || false
  const join_on_team = !limit_to_player_active_games
  const suffix = limit_to_player_active_games
    ? '_player_team_stats'
    : '_team_stats'
  const target = `${table_alias}${suffix}`
  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const join_year = splits.includes('year')
  const join_week = splits.includes('week')

  players_query[join_method](target, function () {
    if (join_on_team) {
      const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
        ? params.matchup_opponent_type[0] &&
          typeof params.matchup_opponent_type[0] === 'object'
          ? null
          : params.matchup_opponent_type[0]
        : params.matchup_opponent_type
      if (matchup_opponent_type === 'current_week_opponent_total') {
        this.on(`${target}.nfl_team`, '=', 'current_week_opponents.opponent')
      } else if (matchup_opponent_type === 'next_week_opponent_total') {
        this.on(`${target}.nfl_team`, '=', 'next_week_opponents.opponent')
      } else {
        // Team-identity cells expose team_reference directly (no
        // player_year_teams indirection); player-identity cells route through
        // player_year_teams when historical-team mode is active, else
        // player.current_nfl_team.
        let team_join_target
        if (team_reference) {
          team_join_target = team_reference
        } else if (player_year_teams_cte_name) {
          team_join_target = `${player_year_teams_cte_name}.team`
        } else {
          team_join_target = 'player.current_nfl_team'
        }
        this.on(`${target}.nfl_team`, '=', team_join_target)
        if (join_week && week_reference) {
          this.andOn(db.raw(`${target}.week = ${week_reference}`))
        }
      }
    } else {
      this.on(`${target}.pid`, '=', pid_reference)
    }

    if (join_year && year_reference) {
      this.andOn(db.raw(`${target}.year = ${year_reference}`))
    }
    if (join_week && week_reference && !join_on_team) {
      this.andOn(db.raw(`${target}.week = ${week_reference}`))
    }
  })
}

const team_stat_from_plays = ({
  select_string,
  stat_name,
  is_rate = false,
  rate_with_selects,
  force_player_active = false,
  supports_output = null,
  measure_expr = null,
  supported_rate_types = [
    'per_game',
    'per_team_half',
    'per_team_quarter',
    'per_team_play',
    'per_team_pass_play',
    'per_team_rush_play',
    'per_team_drive',
    'per_team_series'
  ]
}) => {
  // Player-identity variant always limits to the player's active games.
  // For team variant, the legacy `params.limit_to_player_active_games`
  // branch still applies; it is removed when the saved-view migrator
  // ships and the team variant becomes strictly team-keyed.
  const resolve_active = (params) =>
    force_player_active || params?.limit_to_player_active_games || false

  const auto_inner = is_rate ? null : strip_outer_sum(select_string)
  const can_auto_derive =
    !is_rate &&
    auto_inner !== null &&
    supported_rate_types &&
    supported_rate_types.length > 0
  const derived_supports_output = can_auto_derive
    ? {
        periods: [
          'game',
          'season',
          ...derive_periods_from_rate_types(supported_rate_types)
        ],
        aggregations: ['rate', 'count']
      }
    : null
  const derived_measure_expr = can_auto_derive
    ? ({ table_name } = {}) => auto_inner
    : null
  const final_supports_output = supports_output || derived_supports_output
  const final_measure_expr = measure_expr || derived_measure_expr
  const final_apply_filters = can_auto_derive
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
    table_alias: generate_table_alias,
    column_name: stat_name,
    with_select: () =>
      is_rate ? rate_with_selects : [`${select_string} AS ${stat_name}`],
    with_where: ({ table_name, params }) => {
      if (is_rate) {
        return `sum(${table_name}.${stat_name}_numerator) / NULLIF(sum(${table_name}.${stat_name}_denominator), 0)`
      }

      // should be handled in main where
      if (params.rate_type && params.rate_type.length) {
        return null
      }

      return `sum(${table_name}.${stat_name})`
    },
    main_where: ({
      table_name,
      params,
      column_id,
      column_index,
      rate_type_column_mapping
    }) => {
      if (is_rate) {
        return null
      }

      if (params.rate_type && params.rate_type.length) {
        const rate_type_table_name =
          rate_type_column_mapping[`${column_id}_${column_index}`]
        return get_rate_type_sql({
          table_name: `${table_name}_player_team_stats`,
          column_name: stat_name,
          rate_type_table_name
        })
      }

      return null
    },
    with: force_player_active
      ? (args) =>
          add_team_stats_play_by_play_with_statement({
            ...args,
            params: { ...args.params, limit_to_player_active_games: true }
          })
      : add_team_stats_play_by_play_with_statement,
    join_table_name: (args) => {
      const limit_to_player_active_games = resolve_active(args.params)
      return limit_to_player_active_games
        ? `${args.table_name}_player_team_stats`
        : `${args.table_name}_team_stats`
    },
    // grain set to the base identity (no implicit year/week extension): the
    // attach reads splits to decide whether to emit year/week predicates,
    // matching the legacy data_view_join_function shape. Using 'team_year' /
    // 'player_year' would require the team-to-team-year bridge which mandates
    // a non-empty year_range -- not provided for no-splits team-subject
    // fixtures.
    source: {
      grain: force_player_active ? 'player' : 'team',
      attach: (attach_args) =>
        apply_team_stats_join({ ...attach_args, force_player_active })
    },
    year_select: ({ table_name, column_params = {} }) => {
      const active = resolve_active(column_params)
      const table_suffix = active ? '_player_team_stats' : '_team_stats'
      if (!column_params.year_offset) {
        return `${table_name}${table_suffix}.year`
      }

      const year_offset = Array.isArray(column_params.year_offset)
        ? column_params.year_offset[0]
        : column_params.year_offset

      return `${table_name}${table_suffix}.year - ${year_offset}`
    },
    week_select: ({ table_name, column_params = {} }) => {
      const active = resolve_active(column_params)
      const table_suffix = active ? '_player_team_stats' : '_team_stats'
      return `${table_name}${table_suffix}.week`
    },
    use_having: true,
    supported_rate_types,
    is_rate,
    ...(final_supports_output
      ? { supports_output: final_supports_output, measure_source: 'plays' }
      : {}),
    ...(final_measure_expr ? { measure_expr: final_measure_expr } : {}),
    ...(final_apply_filters ? { apply_filters: final_apply_filters } : {}),
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}

// Each stat is exported twice:
//   `team_<stat>_from_plays`          -- team-identity variant (default;
//                                       respects legacy
//                                       `params.limit_to_player_active_games`
//                                       branch until the saved-view migrator
//                                       lands and column-def sweep #9 strips
//                                       the branch).
//   `player_team_<stat>_from_plays`   -- player-identity variant
//                                       (`force_player_active: true`;
//                                       granularity = player_year /
//                                       player_year_week). The saved-view
//                                       migrator rewrites legacy
//                                       `team_<stat>_from_plays` +
//                                       `limit_to_player_active_games: true`
//                                       saved entries onto the new id.
const stat_specs = {
  team_pass_yards_from_plays: {
    select_string: `SUM(pass_yds)`,
    stat_name: 'team_pass_yds_from_plays'
  },
  team_pass_rate_over_expected_from_plays: {
    select_string: `AVG(pass_oe)`,
    stat_name: 'team_pass_rate_over_expected_from_plays',
    supported_rate_types: []
  },
  team_completion_percentage_over_expected_from_plays: {
    select_string: `AVG(cpoe)`,
    stat_name: 'team_completion_percentage_over_expected_from_plays',
    supported_rate_types: []
  },
  team_pass_attempts_from_plays: {
    select_string: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_att_from_plays'
  },
  team_pass_completions_from_plays: {
    select_string: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_comp_from_plays'
  },
  team_pass_touchdowns_from_plays: {
    select_string: `SUM(CASE WHEN pass_td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_td_from_plays'
  },
  team_pass_air_yards_from_plays: {
    select_string: `SUM(dot)`,
    stat_name: 'team_pass_air_yds_from_plays'
  },
  team_yards_after_catch_from_plays: {
    select_string: `SUM(yards_after_catch)`,
    stat_name: 'team_yards_after_catch_from_plays'
  },
  team_rush_yards_from_plays: {
    select_string: `SUM(rush_yds)`,
    stat_name: 'team_rush_yds_from_plays'
  },
  team_rush_attempts_from_plays: {
    select_string: `COUNT(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE NULL END)`,
    stat_name: 'team_rush_att_from_plays'
  },
  team_rush_touchdowns_from_plays: {
    select_string: `SUM(CASE WHEN rush_td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_rush_td_from_plays'
  },
  team_expected_points_added_from_plays: {
    select_string: `SUM(epa)`,
    stat_name: 'team_ep_added_from_plays'
  },
  team_win_percentage_added_from_plays: {
    select_string: `SUM(wpa)`,
    stat_name: 'team_wp_added_from_plays'
  },
  team_success_rate_from_plays: {
    rate_with_selects: [
      `SUM(CASE WHEN successful_play = true THEN 1 ELSE 0 END) as team_success_rate_from_plays_numerator`,
      `COUNT(*) as team_success_rate_from_plays_denominator`
    ],
    stat_name: 'team_success_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  },
  team_expected_points_success_rate_from_plays: {
    rate_with_selects: [
      `SUM(CASE WHEN ep_succ = true THEN 1 ELSE 0 END) as team_expected_points_success_rate_from_plays_numerator`,
      `COUNT(*) as team_expected_points_success_rate_from_plays_denominator`
    ],
    stat_name: 'team_expected_points_success_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  },
  team_explosive_play_rate_from_plays: {
    rate_with_selects: [
      `SUM(CASE WHEN pass_yds >= 20 OR rush_yds >= 10 THEN 1 ELSE 0 END) as team_explosive_play_rate_from_plays_numerator`,
      `COUNT(*) as team_explosive_play_rate_from_plays_denominator`
    ],
    stat_name: 'team_explosive_play_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  },
  team_play_count_from_plays: {
    select_string: `COUNT(*)`,
    stat_name: 'team_play_count_from_plays'
  },
  team_series_count_from_plays: {
    select_string: `COUNT(DISTINCT CONCAT(esbid, '_', series_seq))`,
    stat_name: 'team_series_count_from_plays'
  },
  team_drive_count_from_plays: {
    select_string: `COUNT(DISTINCT CONCAT(esbid, '_', drive_seq))`,
    stat_name: 'team_drive_count_from_plays'
  },
  team_offensive_play_count_from_plays: {
    select_string: `COUNT(CASE WHEN play_type IN ('PASS', 'RUSH') THEN 1 ELSE NULL END)`,
    stat_name: 'team_offensive_play_count_from_plays'
  },
  team_yards_created_from_plays: {
    select_string: `SUM(yards_created)`,
    stat_name: 'team_yards_created_from_plays'
  },
  team_yards_blocked_from_plays: {
    select_string: `SUM(yards_blocked)`,
    stat_name: 'team_yards_blocked_from_plays'
  },
  team_series_conversion_rate_from_plays: {
    rate_with_selects: [
      `COUNT(DISTINCT CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_numerator`,
      `COUNT(DISTINCT CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_denominator`
    ],
    stat_name: 'team_series_conversion_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  }
}

const definitions = {}
for (const [team_id, spec] of Object.entries(stat_specs)) {
  definitions[team_id] = team_stat_from_plays(spec)
  const player_id = team_id.replace(/^team_/, 'player_team_')
  definitions[player_id] = team_stat_from_plays({
    ...spec,
    force_player_active: true
  })
}

export default definitions
