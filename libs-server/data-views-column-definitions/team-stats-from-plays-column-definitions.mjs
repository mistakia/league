import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/data-views/add-team-stats-play-by-play-with-statement.mjs'
import { resolve_team_join_target } from '#libs-server/data-views/resolve-team-join-target.mjs'
import { get_team_stats_wrap_decision } from '#libs-server/data-views/team-stats-from-plays-wrap.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import {
  nfl_plays_team_column_params,
  nfl_plays_column_params
} from '#libs-shared'
import { derive_measure } from '#libs-server/data-views/measure/measure-contract.mjs'

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
// row_axes projected those columns onto the CTE. References are sourced
// from data_view_options when available (FROM-table-aware) and fall back
// to the identity-derived query_context defaults; player_year_teams_cte_name
// lives only on query_context (set by the identity bridge).
const apply_team_stats_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  row_axes = [],
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
  const join_year = row_axes.includes('year')
  const join_week = row_axes.includes('week')

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
  force_player_active = false,
  measure = null,
  measure_expr = null,
  supports_periods = [
    'team_half',
    'team_quarter',
    'team_play',
    'team_pass_play',
    'team_rush_play',
    'team_drive',
    'team_series'
  ]
}) => {
  // Player-identity variant always limits to the player's active games.
  // For team variant, the legacy `params.limit_to_player_active_games`
  // branch still applies; it is removed when the saved-view migrator
  // ships and the team variant becomes strictly team-keyed.
  const resolve_active = (params) =>
    force_player_active || params?.limit_to_player_active_games || false

  // Measure-first contract: a column declares an explicit
  // `measure: { accumulators, combine_accumulators }`, and derive_measure
  // produces the season render, the accumulator projection, the recombination,
  // the numerator measure_expr, the period aggregate, supports_output and the
  // rounding from it. There is no second ratio vocabulary here any more: the
  // four `is_rate` columns and the two AVG carve-outs are two-accumulator
  // measures like every other ratio in the registry.
  const derived = measure
    ? derive_measure({ stat_name, measure, supports_periods })
    : null

  // Fail-fast invariant (scoped to this factory): a column advertising any
  // denominator period MUST declare a measure; a column left on a raw
  // select_string MUST pass supports_periods: []. Throws at module load.
  if (!derived && supports_periods && supports_periods.length > 0) {
    throw new Error(
      `team_stat_from_plays: '${stat_name}' advertises output periods but declares no measure -- declare measure: { accumulators, combine_accumulators } or set supports_periods: []`
    )
  }

  const season_select = derived ? derived.with_select : select_string
  // The `force_player_active` variant advertises NOTHING, and that is a repair
  // rather than a restriction. Its value is a TEAM statistic pooled over the
  // games one PLAYER was active for, which only the `_player_team_stats` CTE
  // knows how to build -- it joins `player_gamelogs`. The output aggregator has
  // no notion of that join: it groups the fact scan by the column's own subject
  // id, and a `plays` source names no player, so it emitted `nfl_plays.pid AS
  // pid` and every aggregation request on a `player_team_*` column answered
  // `column nfl_plays.pid does not exist`. Measured at 95a949c6e on the ADDITIVE
  // variants, so it predates the ratio conversion and is not something it
  // introduced; withholding the capability is what stops the conversion from
  // widening a live 500 onto twelve more columns.
  const final_supports_output =
    derived && !force_player_active ? derived.supports_output : null
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

  // A COMBINED measure's CTE carries its ACCUMULATORS rather than its value,
  // in EVERY path -- not only in a year_offset range. The team-stats CTE is
  // finer-grained than the outer row (it projects year and week when those row
  // axes are active), so the outer expression pools ACROSS its rows: for an
  // additive measure that is a SUM, and for a combined one it has to sum each
  // accumulator and combine after. The AVG carve-outs did this only in the
  // range path and summed a per-period MEAN everywhere else, which is the
  // sum-of-per-period-ratios class this contract makes unrepresentable.
  const is_combined = Boolean(derived?.is_combined)

  return {
    table_alias: generate_table_alias,
    column_name: stat_name,
    with_select: () =>
      is_combined
        ? derived.accumulator_selects
        : [`${season_select} AS ${stat_name}`],
    // The accumulator COLUMNS this measure's CTE carries, which is what the
    // team-stats CTE builder projects through its wrap and pooling stages. It
    // replaces the `is_rate` / `requires_numerator_denominator_in_year_offset`
    // pair plus the builder's hardcoded `_numerator` / `_denominator`
    // suffixes: a measure declares its own accumulator names, so a future
    // four-accumulator team column needs nothing new here.
    ...(is_combined
      ? {
          accumulator_columns: Object.keys(measure.accumulators).map(
            (name) => `${stat_name}_${name}`
          ),
          recombine_accumulators: derived.recombine,
          // Read by the multi-year team-play wrap, which projects accumulators
          // and recombines one grain coarser rather than summing a per-year
          // combined value.
          accumulator_selects: derived.accumulator_selects,
          // The declaration the output aggregator needs to render the combine
          // at PERIOD grain. Without it the period CTE reaches for a
          // `measure_expr` a combined measure does not have, and every
          // count / mean / rate request on a team ratio column throws.
          combined_measure: derived.combined_measure
        }
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

      if (is_combined) {
        return `(SELECT ${derived.recombine({ table_name })} FROM ${table_name} WHERE ${table_name}.${correlation_key} = ${correlation_ref})`
      }

      return `(SELECT SUM(${table_name}.${stat_name}) FROM ${table_name} WHERE ${table_name}.${correlation_key} = ${correlation_ref})`
    },
    with_where: ({ table_name }) =>
      is_combined
        ? derived.recombine({ table_name })
        : `sum(${table_name}.${stat_name})`,
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
    // attach reads row_axes to decide whether to emit year/week predicates.
    // Using 'team_year' / 'player_year' would require the team-to-team-year
    // bridge which mandates a non-empty year_range -- not provided for
    // no-row-axes team-subject fixtures.
    //
    // supports_row_axes is declared explicitly because the `with` builder
    // (add_team_stats_play_by_play_with_statement) DOES project year/week
    // onto the CTE when those row_axes are active; without this override,
    // group_tables_by_supported_row_axes would intersect the request row_axes
    // against grain's [] and drop year/week before forwarding to with_func.
    source: {
      grain: force_player_active ? 'player' : 'team',
      supports_row_axes: ['year', 'week'],
      attach: (attach_args) =>
        apply_team_stats_join({ ...attach_args, force_player_active })
    },
    week_select: ({ table_name, column_params = {} }) => {
      const active = resolve_active(column_params)
      const table_suffix = active ? '_player_team_stats' : '_team_stats'
      return `${table_name}${table_suffix}.week`
    },
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
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `pass_yards` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_pass_yds_from_plays'
  },
  // The two AVG carve-outs. `AVG(x)` is `SUM(x) / COUNT(x)`, so the pair below
  // reproduces it exactly at the CTE's own grain -- the declared denominator IS
  // the AVG's implicit one, a count of NON-NULL values rather than a count of
  // plays. What it changes is the pooling ACROSS CTE rows: the outer expression
  // summed a per-period mean everywhere outside a year_offset range, and now
  // sums the components and divides after.
  team_pass_rate_over_expected_from_plays: {
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `pass_over_expected` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN pass_over_expected IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_pass_rate_over_expected_from_plays'
  },
  team_completion_percentage_over_expected_from_plays: {
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `completion_percentage_over_expected`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN completion_percentage_over_expected IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_completion_percentage_over_expected_from_plays'
  },
  team_pass_attempts_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_pass_att_from_plays'
  },
  team_pass_completions_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_pass_comp_from_plays'
  },
  team_pass_touchdowns_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_passing_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_pass_td_from_plays'
  },
  team_pass_air_yards_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `depth_of_target` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_pass_air_yds_from_plays'
  },
  team_yards_after_catch_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_after_catch` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_yards_after_catch_from_plays'
  },
  team_rush_yards_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `rush_yards` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_rush_yds_from_plays'
  },
  team_rush_attempts_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_rush_att_from_plays'
  },
  team_rush_touchdowns_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN is_rushing_touchdown = true THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_rush_td_from_plays'
  },
  team_expected_points_added_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `epa` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_ep_added_from_plays'
  },
  team_win_percentage_added_from_plays: {
    measure: {
      accumulators: {
        value: { aggregate: 'sum', expr: `win_probability_added` }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_wp_added_from_plays'
  },
  team_success_rate_from_plays: {
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_successful_play = true THEN 1 ELSE 0 END`
        },
        denominator: { aggregate: 'count', expr: `*` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_success_rate_from_plays'
  },
  team_expected_points_success_rate_from_plays: {
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_epa_successful = true THEN 1 ELSE 0 END`
        },
        denominator: { aggregate: 'count', expr: `*` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_expected_points_success_rate_from_plays'
  },
  team_explosive_play_rate_from_plays: {
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN pass_yards >= 20 OR rush_yards >= 10 THEN 1 ELSE 0 END`
        },
        denominator: { aggregate: 'count', expr: `*` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_explosive_play_rate_from_plays'
  },
  team_play_count_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `1` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_play_count_from_plays'
  },
  team_series_count_from_plays: {
    // esbid is qualified because the numerator CTE scans nfl_plays JOIN
    // nfl_games (both carry esbid); bare esbid is ambiguous there. nfl_plays is
    // present in the season with-CTE too, so the qualified ref is valid in both
    // the season render and the numerator.
    measure: {
      accumulators: {
        value: {
          aggregate: 'count_distinct',
          expr: `CONCAT(nfl_plays.esbid, '_', series_sequence)`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_series_count_from_plays'
  },
  team_drive_count_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'count_distinct',
          expr: `CONCAT(nfl_plays.esbid, '_', drive_sequence)`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_drive_count_from_plays'
  },
  team_offensive_play_count_from_plays: {
    measure: {
      accumulators: {
        value: {
          aggregate: 'sum',
          expr: `CASE WHEN play_type IN ('PASS', 'RUSH') THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_offensive_play_count_from_plays'
  },
  team_yards_created_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_created` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_yards_created_from_plays'
  },
  team_yards_blocked_from_plays: {
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_blocked` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'team_yards_blocked_from_plays'
  },
  // Both accumulators are count_distinct, which the closed set admits only
  // because the distinct key is `esbid`-prefixed and so nested inside every
  // partition the measure can be evaluated at (see accumulator.mjs). The
  // combine's NULLIF is what closes the live `division by zero` this column
  // raised on a preseason group, whose denominator counts zero series.
  team_series_conversion_rate_from_plays: {
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'count_distinct',
          expr: `CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(nfl_plays.esbid, '_', series_sequence) END`
        },
        denominator: {
          aggregate: 'count_distinct',
          expr: `CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(nfl_plays.esbid, '_', series_sequence) END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator })
    },
    stat_name: 'team_series_conversion_rate_from_plays'
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
