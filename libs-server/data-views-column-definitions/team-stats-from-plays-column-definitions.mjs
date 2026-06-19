import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/data-views/add-team-stats-play-by-play-with-statement.mjs'
import { resolve_team_join_target } from '#libs-server/data-views/resolve-team-join-target.mjs'
import { get_team_stats_wrap_decision } from '#libs-server/data-views/team-stats-from-plays-wrap.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import {
  nfl_plays_team_column_params,
  nfl_plays_column_params
} from '#libs-shared'
import { derive_measure } from '#libs-server/data-views/measure-contract.mjs'

// Every key apply_play_by_play_column_params_to_query may read from the
// column's params. Declared as consumes_params_extra so the output-aggregator
// group_key / cte_name hashes reflect per-column filter divergence and
// prevent silent batching of differently-filtered team-stat columns.
const play_by_play_filter_param_keys = Object.keys(nfl_plays_column_params)

const generate_table_alias = ({ params = {} } = {}) => {
  const additional_keys = Object.keys(nfl_plays_team_column_params).sort()
  const key = get_stats_column_param_key({ params, additional_keys })
  return get_table_hash(`team_stats_from_plays__${key}`)
}

// Two shapes: player-identity (force_player_active=true) joins the
// *_player_team_stats CTE by pid; team-identity joins the *_team_stats CTE
// by team. Year and week predicates are emitted only when the bucket's
// splits projected those columns onto the CTE. References are sourced
// from data_view_options when available (FROM-table-aware) and fall back
// to the identity-derived query_context defaults; player_year_teams_cte_name
// lives only on query_context (set by the identity bridge).
const apply_team_stats_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  splits = [],
  force_player_active
}) => {
  const dv = query_context.data_view_options
  const { players_query } = query_context
  const pid_reference = dv?.pid_reference ?? query_context.pid_reference
  const year_reference = dv?.year_reference ?? query_context.year_reference
  const week_reference = dv?.week_reference ?? query_context.week_reference
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

  // Wrap-mode `_team_stats` is keyed by pid (see
  // add-team-stats-play-by-play-with-statement.mjs), not by nfl_team. Join
  // on pid 1:1 and skip the team / year / week predicates.
  const wrap_mode =
    join_on_team &&
    get_team_stats_wrap_decision({
      query_context,
      params,
      force_player_active
    }).wrap_mode

  if (wrap_mode) {
    players_query[join_method](target, function () {
      this.on(`${target}.pid`, '=', pid_reference)
    })
    return
  }

  const team_join_target = join_on_team
    ? resolve_team_join_target({ query_context, params })
    : null
  const matchup_branch =
    team_join_target === 'current_week_opponents.opponent' ||
    team_join_target === 'next_week_opponents.opponent'

  players_query[join_method](target, function () {
    if (join_on_team) {
      this.on(`${target}.nfl_team`, '=', team_join_target)
      // Matchup-opponent joins are point-in-time (no week predicate); the
      // own-team / per-season-team branches carry through the week predicate
      // alongside the team key.
      if (!matchup_branch && join_week && week_reference) {
        this.andOn(db.raw(`${target}.week = ${week_reference}`))
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
  // Non-is_rate columns that are nonetheless pooled as a quotient in a
  // multi-year year_offset RANGE (the AVG carve-outs PROE / CPOE). They keep
  // their raw `select_string` season render (e.g. AVG(cpoe)) in every
  // non-range path, and only emit numerator/denominator selects when the
  // request is a year_offset range so the window can pool SUM(num)/SUM(den)
  // instead of summing per-season means. is_rate columns already carry their
  // num/den as rate_with_selects in all paths and ignore these.
  numerator_select = null,
  denominator_select = null,
  force_player_active = false,
  measure = null,
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

  // Measure-first contract: a rate-capable single-aggregate column declares an
  // explicit `measure: { kind, expr, decimals }`; derive_measure produces the
  // season render, numerator measure_expr, period aggregate (sum or
  // count_distinct), supports_output, and decimals rounding from it. is_rate
  // numerator/denominator columns and AVG carve-outs declare no measure and
  // pass supported_rate_types: [].
  const derived = measure
    ? derive_measure({ stat_name, measure, supported_rate_types })
    : null

  // Fail-fast invariant (scoped to this factory): a non-rate column advertising
  // any rate type MUST declare a measure; an is_rate or raw-select column MUST
  // pass supported_rate_types: []. Throws at module load.
  if (
    !is_rate &&
    !derived &&
    supported_rate_types &&
    supported_rate_types.length > 0
  ) {
    throw new Error(
      `team_stat_from_plays: '${stat_name}' advertises rate types but declares no measure -- declare measure: { kind, expr } or set supported_rate_types: []`
    )
  }

  const season_select = derived ? derived.with_select : select_string
  const final_supports_output = derived ? derived.supports_output : null
  const final_measure_expr =
    measure_expr || (derived ? derived.measure_expr : null)
  const final_aggregate = derived ? derived.aggregate : null
  const final_decimals = derived ? derived.decimals : null
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

  // A column whose multi-year year_offset RANGE value is a pooled quotient:
  // is_rate columns (num/den in every path) or AVG carve-outs that supply an
  // explicit numerator/denominator pair (num/den only in the range path).
  const has_numerator_denominator_pair = Boolean(
    numerator_select && denominator_select
  )
  const uses_numerator_denominator = is_rate || has_numerator_denominator_pair

  return {
    table_alias: generate_table_alias,
    column_name: stat_name,
    with_select: ({ params = {} } = {}) => {
      if (is_rate) {
        return rate_with_selects
      }
      // AVG carve-out in a year_offset range: emit the numerator/denominator
      // pair so the base CTE carries the components the range correlated
      // subquery pools, instead of a per-season mean that cannot be re-pooled.
      if (has_numerator_denominator_pair && is_year_offset_range(params)) {
        return [
          `${numerator_select} as ${stat_name}_numerator`,
          `${denominator_select} as ${stat_name}_denominator`
        ]
      }
      return [`${season_select} AS ${stat_name}`]
    },
    // Consumed by add_clauses_for_table to fold the AVG carve-outs into
    // rate_columns when (and only when) the request is a year_offset range, so
    // the team-stats CTE builder projects their summed num/den components.
    // is_rate columns are already in rate_columns via column_definition.is_rate.
    ...(has_numerator_denominator_pair
      ? { requires_numerator_denominator_in_year_offset: true }
      : {}),
    // Self-contained year_offset-range correlated subquery for the displayed
    // value. The final stats CTE collapses to pid-grain for the player variant
    // (`_player_team_stats`) and for the team variant whenever wrap mode fires
    // (multi-year player-subject view); only a team-subject view stays
    // nfl_team-grained. Correlate on the matching key and pool num/den
    // (raw quotient, matching the raw-fraction season render) or SUM the
    // additive measure across the window.
    main_select_string_year_offset_range: ({
      table_name,
      params = {},
      data_view_options = {},
      query_context = null
    }) => {
      const active = resolve_active(params)
      const wrap_mode =
        !active && query_context
          ? get_team_stats_wrap_decision({
              query_context,
              params,
              force_player_active: false
            }).wrap_mode
          : false
      const pid_keyed = active || wrap_mode
      const correlation_key = pid_keyed ? 'pid' : 'nfl_team'
      const correlation_ref = pid_keyed
        ? (data_view_options.pid_reference ?? query_context?.pid_reference)
        : resolve_team_join_target({
            query_context: query_context || { data_view_options },
            params
          })

      if (uses_numerator_denominator) {
        return `(SELECT SUM(${table_name}.${stat_name}_numerator) / NULLIF(SUM(${table_name}.${stat_name}_denominator), 0) FROM ${table_name} WHERE ${table_name}.${correlation_key} = ${correlation_ref})`
      }

      return `(SELECT SUM(${table_name}.${stat_name}) FROM ${table_name} WHERE ${table_name}.${correlation_key} = ${correlation_ref})`
    },
    with_where: ({ table_name }) => {
      if (is_rate) {
        return `sum(${table_name}.${stat_name}_numerator) / NULLIF(sum(${table_name}.${stat_name}_denominator), 0)`
      }

      return `sum(${table_name}.${stat_name})`
    },
    main_where: () => null,
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
    // attach reads splits to decide whether to emit year/week predicates.
    // Using 'team_year' / 'player_year' would require the team-to-team-year
    // bridge which mandates a non-empty year_range -- not provided for
    // no-splits team-subject fixtures.
    //
    // supports_splits is declared explicitly because the `with` builder
    // (add_team_stats_play_by_play_with_statement) DOES project year/week
    // onto the CTE when those splits are active; without this override,
    // group_tables_by_supported_splits would intersect the request splits
    // against grain's [] and drop year/week before forwarding to with_func.
    source: {
      grain: force_player_active ? 'player' : 'team',
      supports_splits: ['year', 'week'],
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
    measure: { kind: 'additive', expr: `pass_yds` },
    stat_name: 'team_pass_yds_from_plays'
  },
  team_pass_rate_over_expected_from_plays: {
    select_string: `AVG(pass_oe)`,
    // AVG(pass_oe) re-expressed as SUM(pass_oe)/COUNT(non-null) so a multi-year
    // year_offset range pools the dropbacks rather than averaging per-season
    // means. Only emitted in the range path; the season render stays AVG.
    numerator_select: `SUM(pass_oe)`,
    denominator_select: `SUM(CASE WHEN pass_oe IS NOT NULL THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_rate_over_expected_from_plays',
    supported_rate_types: []
  },
  team_completion_percentage_over_expected_from_plays: {
    select_string: `AVG(cpoe)`,
    numerator_select: `SUM(cpoe)`,
    denominator_select: `SUM(CASE WHEN cpoe IS NOT NULL THEN 1 ELSE 0 END)`,
    stat_name: 'team_completion_percentage_over_expected_from_plays',
    supported_rate_types: []
  },
  team_pass_attempts_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END`
    },
    stat_name: 'team_pass_att_from_plays'
  },
  team_pass_completions_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN comp = true THEN 1 ELSE 0 END`
    },
    stat_name: 'team_pass_comp_from_plays'
  },
  team_pass_touchdowns_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN pass_td = true THEN 1 ELSE 0 END`
    },
    stat_name: 'team_pass_td_from_plays'
  },
  team_pass_air_yards_from_plays: {
    measure: { kind: 'additive', expr: `dot` },
    stat_name: 'team_pass_air_yds_from_plays'
  },
  team_yards_after_catch_from_plays: {
    measure: { kind: 'additive', expr: `yards_after_catch` },
    stat_name: 'team_yards_after_catch_from_plays'
  },
  team_rush_yards_from_plays: {
    measure: { kind: 'additive', expr: `rush_yds` },
    stat_name: 'team_rush_yds_from_plays'
  },
  team_rush_attempts_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END`
    },
    stat_name: 'team_rush_att_from_plays'
  },
  team_rush_touchdowns_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN rush_td = true THEN 1 ELSE 0 END`
    },
    stat_name: 'team_rush_td_from_plays'
  },
  team_expected_points_added_from_plays: {
    measure: { kind: 'additive', expr: `epa` },
    stat_name: 'team_ep_added_from_plays'
  },
  team_win_percentage_added_from_plays: {
    measure: { kind: 'additive', expr: `wpa` },
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
    measure: { kind: 'additive', expr: `1` },
    stat_name: 'team_play_count_from_plays'
  },
  team_series_count_from_plays: {
    // esbid is qualified because the numerator CTE scans nfl_plays JOIN
    // nfl_games (both carry esbid); bare esbid is ambiguous there. nfl_plays is
    // present in the season with-CTE too, so the qualified ref is valid in both
    // the season render and the numerator.
    measure: {
      kind: 'distinct_count',
      expr: `CONCAT(nfl_plays.esbid, '_', series_seq)`
    },
    stat_name: 'team_series_count_from_plays'
  },
  team_drive_count_from_plays: {
    measure: {
      kind: 'distinct_count',
      expr: `CONCAT(nfl_plays.esbid, '_', drive_seq)`
    },
    stat_name: 'team_drive_count_from_plays'
  },
  team_offensive_play_count_from_plays: {
    measure: {
      kind: 'additive',
      expr: `CASE WHEN play_type IN ('PASS', 'RUSH') THEN 1 ELSE 0 END`
    },
    stat_name: 'team_offensive_play_count_from_plays'
  },
  team_yards_created_from_plays: {
    measure: { kind: 'additive', expr: `yards_created` },
    stat_name: 'team_yards_created_from_plays'
  },
  team_yards_blocked_from_plays: {
    measure: { kind: 'additive', expr: `yards_blocked` },
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
