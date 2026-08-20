import { nfl_plays_column_params } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { add_player_stats_play_by_play_with_statement } from '#libs-server/data-views/add-player-stats-play-by-play-with-statement.mjs'
import { apply_plays_join } from '#libs-server/data-views/source-attach/apply-plays-join.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import { derive_measure } from '#libs-server/data-views/measure/measure-contract.mjs'
import { FACT_SOURCES } from '#libs-server/data-views/measure/fact-source-registry.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'

// Every key apply_play_by_play_column_params_to_query may read from the
// column's params. Declared as consumes_params_extra so the output-aggregator
// group_key / cte_name hashes reflect per-column filter divergence (e.g.
// two rush_yards_from_plays instances where only one carries yards_gained
// must materialize into distinct CTEs rather than batching into one).
const play_by_play_filter_param_keys = Object.keys(nfl_plays_column_params)

const should_recombine_in_main = ({ params, is_combined }) => {
  // Equal-endpoint offsets ([k,k]) are a single-year shift, NOT a range: the
  // CTE stays collapsed and the source join correlates the single year. Only a
  // genuine multi-year range (is_year_offset_range) recombines the
  // accumulators in the main SELECT. See year-offset-range.mjs for the
  // canonical predicate.
  return is_year_offset_range(params) && is_combined
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
  // ORDER-SENSITIVE, deliberately. The role list is emitted as an ORDERED
  // COALESCE, and the order decides which player a fact is credited to:
  // measured against production over 2023+, `passer_pid` and `target_pid` are
  // both non-null and different on 60,547 plays. Hashing the list as a SET made
  // two columns declaring the same roles in different orders share one alias
  // and therefore one CTE, whose single COALESCE was decided by whichever
  // column came second in the request -- so one of the two was always
  // mis-attributed. `player_opportunities_from_plays` (receiver-first) and
  // `player_total_expected_points_added_from_plays` (passer-first) were that
  // pair. Sorting the DECLARATIONS instead would have been the wrong repair: it
  // silently re-credits every pass opportunity to the quarterback.
  const pid_columns_string = pid_columns.join('_')
  return get_table_hash(`${type}_${pid_columns_string}_${key}`)
}

const player_stat_from_plays = ({
  pid_columns,
  stat_name,
  measure = null,
  measure_expr = null,
  // Which fact source the scan reads, by registry name. `plays` names the
  // subject on the play; `plays_cohort` expands each team play across the
  // players who appeared in that game, which is what a share measures against.
  // The registry supplies the expansion join and the subject-id column, so the
  // only thing a share declares beyond an ordinary column is this one word.
  fact_source_name = 'plays'
}) => {
  const fact_source = FACT_SOURCES[fact_source_name]
  if (!fact_source) {
    throw new Error(
      `player_stat_from_plays: '${stat_name}' names unknown fact source '${fact_source_name}'`
    )
  }
  const alias_type =
    fact_source_name === 'plays'
      ? 'play_by_play'
      : `play_by_play_${fact_source_name}`
  // Measure-first contract: a column declares an explicit
  // `measure: { accumulators, combine_accumulators }`, and derive_measure produces the
  // season render, the offset-window recombination, the numerator measure_expr,
  // the period aggregate, supports_output and the rounding from it. A ratio is
  // a two-accumulator measure whose combine divides; it is not a second
  // vocabulary. There are no raw-string carve-outs left: every column in this
  // factory declares accumulators, which is what the invariant below enforces.
  const derived = measure
    ? derive_measure({ stat_name, measure, subject_grain: 'player' })
    : null
  const is_combined = Boolean(derived?.is_combined)

  // Fail-fast invariant (scoped to this factory): EVERY column declares a
  // measure. It used to be the weaker "a column advertising periods must
  // declare one", because a column could opt out with `supports_periods: []`
  // and stay on a raw with_select_string. There is no opt-out left -- the
  // denominator vocabulary is derived from the subject grain, and every column
  // in this factory carries accumulators -- so the invariant is the strong
  // form, which is what makes the silent-rate-drop class structurally
  // impossible rather than merely declared against.
  if (!derived) {
    throw new Error(
      `player_stat_from_plays: '${stat_name}' declares no measure -- declare measure: { accumulators, combine_accumulators }`
    )
  }

  // The season render is the deriver's with_select for measure columns, else
  // the raw string (the remaining carve-outs).
  const season_select = derived.with_select

  // No is_percentage flag and no invariant policing it. A percentage column
  // writes its own scale inside the one combine that produces its value, so
  // there is nothing for a second declaration to disagree with -- the flag
  // existed only because the value lived in a string the flag had to be
  // asserted to match.
  const final_supports_output = derived ? derived.supports_output : null
  // An explicit table-qualified measure_expr override (e.g.
  // player_receiving_yards_from_plays) wins over the deriver's default.
  const final_measure_expr =
    measure_expr || (derived ? derived.measure_expr : null)
  const final_aggregate = derived ? derived.aggregate : null
  const final_decimals = derived ? derived.decimals : null
  // Mirror `add_player_stats_play_by_play_with_statement` filtering against
  // the aggregator-rate / aggregator-count CTE so cross-period totals match
  // legacy parity. Gated on the column being AGGREGATOR-SERVEABLE rather than
  // merely measure-bearing: both this hook and the `consumes_params_extra` it
  // ships with are read only on the output-aggregator path, so a column that
  // advertises nothing would carry two fields nothing can reach.
  const final_apply_filters = final_supports_output
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
    // The alias keys on the FACT SOURCE as well as the role list, because a
    // cohort scan and a role scan over the same roles are different relations
    // -- sharing an alias would put two incompatible scans behind one CTE, the
    // collapse class `289b88483` repaired for role ORDER. Columns that agree on
    // both DO share one scan, which is the batching every role column already
    // gets and shares now get too: eight share columns over three role lists
    // become three cohort scans rather than eight, and a cohort scan is the
    // expensive one.
    //
    // `plays` keeps the bare `play_by_play` literal deliberately. The alias is
    // a cache key with no other meaning, and qualifying it would move every
    // from-plays CTE name in the registry -- invalidating every cached
    // from-plays result to express something no reader was confused about.
    table_alias: ({ params }) =>
      generate_table_alias({ type: alias_type, params, pid_columns }),
    column_name: stat_name,
    with_select: ({ params = {} }) => {
      // In a multi-year range the CTE carries the ACCUMULATORS, so the outer
      // query can combine after summing them. Anywhere else it carries the
      // combined value directly.
      if (should_recombine_in_main({ params, is_combined })) {
        return derived.accumulator_selects
      }
      return [`${season_select} as ${stat_name}`]
    },
    // The combine applied ONE GRAIN COARSER, over a relation that has already
    // projected one column per accumulator. Two consumers need exactly this:
    // select-string.mjs's year-offset correlated subquery and the multi-year
    // team-play wrap, which each sum the accumulators over their own window and
    // combine after. They share the function rather than each deriving one,
    // because two derivations are two chances to sum per-window ratios.
    ...(is_combined
      ? {
          recombine_accumulators: derived.recombine,
          accumulator_selects: derived.accumulator_selects,
          combined_measure: derived.combined_measure
        }
      : {}),
    with_where: ({ params }) => {
      if (should_recombine_in_main({ params, is_combined })) {
        return null // the WITH statement carries accumulators, not a value
      }
      return season_select
    },
    main_where: ({ params, table_name }) => {
      if (should_recombine_in_main({ params, is_combined })) {
        return derived.recombine({ table_name })
      }
      return null
    },
    main_where_group_by: ({ params, table_name }) => {
      if (should_recombine_in_main({ params, is_combined })) {
        return Object.keys(measure.accumulators).map(
          (name) => `SUM(${table_name}.${stat_name}_${name})`
        )
      }
      return []
    },
    pid_columns,
    with: (args) =>
      add_player_stats_play_by_play_with_statement({ ...args, fact_source }),
    source: plays_source,
    use_having: true,
    // `measure_source` names the FACT SOURCE the aggregator scan reads, so it
    // is the column's own source rather than the literal 'plays'. A share
    // reaching the aggregator on 'plays' would scan without the cohort
    // expansion, and its accumulators name the members alias that expansion
    // binds -- a 42P01 rather than a wrong number, but only because the alias
    // is unresolvable.
    ...(final_supports_output
      ? {
          supports_output: final_supports_output,
          measure_source: fact_source_name
        }
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

export default {
  player_pass_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `pass_yards` } },
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_comp_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_completion_percentage_over_expected_from_plays: player_stat_from_plays(
    {
      pid_columns: ['passer_pid'],
      stat_name: 'pass_comp_pct_over_expected_from_plays',
      // CPOE is a per-dropback mean; a range year_offset must pool the summed
      // completion_percentage_over_expected over the summed qualifying-dropback count, not SUM the per-season
      // averages.
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
          divide({ numerator: a.numerator, denominator: a.denominator }),
        decimals: null
      }
    }
  ),
  player_expected_completion_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    // Expected completion % = mean completion probability x 100. Expressed as
    // SUM(completion_probability)/COUNT(completion_probability) x 100 (mathematically identical to AVG(completion_probability) * 100) so it
    // can pool across a multi-year year_offset range via numerator/denominator
    // instead of summing per-season means; rounded to 2 decimals to match the
    // sibling percentage columns.
    stat_name: 'expected_pass_comp_pct_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `completion_probability` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN completion_probability IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_pass_touchdown_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_td_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_touchdown = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_pass_interception_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_int_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_interception = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_pass_interception_worthy_percentage_from_plays: player_stat_from_plays(
    {
      pid_columns: ['passer_pid'],
      stat_name: 'pass_int_worthy_pct_from_plays',
      measure: {
        accumulators: {
          numerator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_interception_worthy = true THEN 1 ELSE 0 END`
          },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_sack is null or is_sack = false THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({
            numerator: a.numerator,
            denominator: a.denominator,
            scale: '100.0'
          }),
        decimals: 2
      }
    }
  ),
  player_pass_yards_after_catch_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_after_catch` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays:
    player_stat_from_plays({
      pid_columns: ['passer_pid'],
      stat_name: 'pass_yds_after_catch_per_comp_from_plays',
      measure: {
        accumulators: {
          numerator: { aggregate: 'sum', expr: `yards_after_catch` },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        decimals: 2
      }
    }),
  player_pass_yards_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_yds_per_att_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `pass_yards` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  player_pass_depth_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_depth_per_att_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `depth_of_target` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  player_pass_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `depth_of_target` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'comp_air_yds_per_comp_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `depth_of_target` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  // completed air yards / total air yards (a unitless ratio, not a percentage)
  player_passing_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_air_conv_ratio_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN depth_of_target ELSE 0 END`
        },
        denominator: { aggregate: 'sum', expr: `depth_of_target` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 4
    }
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'sacked_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_quarterback_hits_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'qb_hit_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_qb_hit = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_quarterback_pressures_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'qb_press_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_qb_pressure = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_quarterback_hurries_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'qb_hurry_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_qb_hurry = true AND passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  // net yards per passing attempt: (pass yards - sack yards)/(passing attempts + sacks).
  // sacks included in calculation because passer_pid is set on all attempts or sacks
  player_pass_net_yards_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'pass_net_yds_per_att_from_plays',
    // Three accumulators rather than two: the numerator is a difference, and
    // each term of it accumulates on its own so the offset window sums the
    // terms and subtracts after.
    measure: {
      accumulators: {
        pass_yards: { aggregate: 'sum', expr: `pass_yards` },
        sack_yards: {
          aggregate: 'sum',
          expr: `CASE WHEN is_sack = true THEN yards_gained ELSE 0 END`
        },
        dropbacks: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: `(${a.pass_yards} - ${a.sack_yards})`,
          denominator: a.dropbacks
        }),
      decimals: 2
    }
  }),

  player_rush_yards_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `rush_yards` } },
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'rush_yds_per_att_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `rush_yards` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
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
      combine_accumulators: 'identity'
    },
    stat_name: 'rush_atts_from_plays'
  }),
  player_average_box_defenders_per_rush_attempt_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid'],
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
      measure: {
        accumulators: {
          numerator: {
            aggregate: 'sum',
            expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN box_defenders ELSE 0 END`
          },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN ball_carrier_pid IS NOT NULL AND box_defenders IS NOT NULL THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        decimals: 2
      }
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        value: { aggregate: 'sum', expr: `yards_after_any_contact` }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid'],
      stat_name: 'rush_yds_after_contact_per_att_from_plays',
      measure: {
        accumulators: {
          numerator: { aggregate: 'sum', expr: `yards_after_any_contact` },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        decimals: 2
      }
    }),
  player_rush_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'rush_first_down_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_first_down = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
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
      combine_accumulators: 'identity',
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'opportunities_from_plays'
  }),

  player_rush_attempts_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'rush_att_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'count',
          expr: `CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_rush_yards_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'rush_yds_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN nfl_plays.rush_yards ELSE 0 END`
        },
        denominator: { aggregate: 'sum', expr: `nfl_plays.rush_yards` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_rush_first_down_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'rush_first_down_share_from_plays',
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),

  player_opportunity_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'opportunity_share_from_plays',
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    // The subject's opportunities are carries plus targets, so each counts as
    // its own accumulator and the combine adds them after the window sums each.
    measure: {
      accumulators: {
        carries: {
          aggregate: 'count',
          expr: `CASE WHEN nfl_plays.ball_carrier_pid = pg.pid THEN 1 ELSE NULL END`
        },
        targets: {
          aggregate: 'count',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END`
        },
        team_opportunities: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.ball_carrier_pid IS NOT NULL OR nfl_plays.target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: `(${a.carries} + ${a.targets})`,
          denominator: a.team_opportunities,
          scale: '100.0'
        }),
      decimals: 2
    }
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'fumbles_lost_from_plays'
  }),

  player_fumble_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'fumble_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN fumble_lost_pid = ball_carrier_pid THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_positive_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'positive_rush_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN rush_yards > 0 THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_successful_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'succ_rush_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_successful_play = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_broken_tackles_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: {
        value: { aggregate: 'sum', expr: `missed_or_broken_tackle` }
      },
      combine_accumulators: 'identity'
    },
    stat_name: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    stat_name: 'broken_tackles_per_rush_att_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `missed_or_broken_tackle` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    stat_name: 'deep_trg_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN depth_of_target >= 20 THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_air_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    stat_name: 'air_yds_per_trg_from_plays',
    measure: {
      accumulators: {
        numerator: { aggregate: 'sum', expr: `depth_of_target` },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  player_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `depth_of_target` } },
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'recv_first_down_from_plays'
  }),
  player_receiving_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    stat_name: 'recv_first_down_pct_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_first_down = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),

  player_air_yards_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'air_yds_share_from_plays',
    pid_columns: ['target_pid'],
    // A share is a ratio, not additive: a range year_offset must recombine the
    // summed player air yards over the summed team air yards, not SUM the
    // per-season share percentages. Mirrors player_target_share_from_plays.
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END`
        },
        denominator: { aggregate: 'sum', expr: `nfl_plays.depth_of_target` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_target_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'trg_share_from_plays',
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'count',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),
  player_weighted_opportunity_rating_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'weighted_opp_rating_from_plays',
    pid_columns: ['target_pid'],
    // WOPR is the column that broke the two-slot numerator/denominator
    // contract: it is a WEIGHTED SUM OF TWO RATIOS, which one numerator and one
    // denominator cannot express, so it escaped into three independently
    // maintained SQL strings -- the season render, the offset-range CTE
    // projection, and the offset-range recombination. The three were verified
    // to AGREE by execution (0.6033 and 0.6385 for two receivers over 2022-2024
    // REG) before this conversion, so there was no disagreement to adjudicate;
    // the hazard was that nothing could have noticed one.
    //
    // Four accumulators plus a combine expresses it directly, and all three
    // strings derive from the one declaration. Two things are load-bearing in
    // the combine and both are silent when wrong:
    //
    //   - The 1.5 and 0.7 factors sit to the LEFT of their divisions. `1.5 *
    //     COUNT(...) / NULLIF(...)` promotes to numeric before dividing;
    //     `1.5 * (COUNT(...) / NULLIF(...))` is bigint integer division and
    //     collapses WOPR to 0 for every player.
    //   - The value is a 0-1 rating and carries NO percentage scale. There is
    //     no flag saying so -- the combine IS the statement -- which is the
    //     point of deleting `is_percentage`: an author who consulted that flag
    //     would rescale WOPR 100x, from 0.60 to 60.33, and the client would
    //     render it happily.
    measure: {
      accumulators: {
        player_targets: {
          aggregate: 'count',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN 1 ELSE NULL END`
        },
        team_targets: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        },
        player_air_yards: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN nfl_plays.depth_of_target ELSE 0 END`
        },
        team_air_yards: {
          aggregate: 'sum',
          expr: `nfl_plays.depth_of_target`
        }
      },
      combine_accumulators: (a, { divide }) =>
        `(${divide({
          numerator: a.player_targets,
          denominator: a.team_targets,
          scale: '1.5'
        })}) + (${divide({
          numerator: a.player_air_yards,
          denominator: a.team_air_yards,
          scale: '0.7'
        })})`,
      decimals: 4
    }
  }),
  player_receiving_first_down_share_from_plays: player_stat_from_plays({
    fact_source_name: 'plays_cohort',
    stat_name: 'recv_first_down_share_from_plays',
    pid_columns: ['target_pid'],
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.target_pid = pg.pid THEN CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN nfl_plays.is_first_down THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
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
      combine_accumulators: 'identity'
    },
    stat_name: 'rec_yds_after_catch_from_plays'
  }),

  // receiving yards / air yards (a unitless ratio, not a percentage)
  player_receiver_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    stat_name: 'rec_air_conv_ratio_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END`
        },
        denominator: { aggregate: 'sum', expr: `depth_of_target` }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 4
    }
  }),
  player_receiving_yards_per_reception_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    stat_name: 'rec_yds_per_rec_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  player_receiving_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['target_pid'],
    // Divides by TARGETS. Until 2026-08-19 every expression here was
    // byte-identical to player_receiving_yards_per_reception_from_plays above,
    // so the two columns emitted the same number on both the season render and
    // the year-offset range.
    stat_name: 'rec_yds_per_trg_from_plays',
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_completion = true THEN receiving_yards ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: 2
    }
  }),
  player_receiving_yards_after_catch_per_reception_from_plays:
    player_stat_from_plays({
      pid_columns: ['target_pid'],
      stat_name: 'rec_yds_after_catch_per_rec_from_plays',
      measure: {
        accumulators: {
          numerator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_completion = true THEN yards_after_catch ELSE 0 END`
          },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_completion = true THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        decimals: 2
      }
    }),

  player_yards_created_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_created` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'yards_created_from_plays'
  }),

  player_yards_blocked_from_plays: player_stat_from_plays({
    pid_columns: ['ball_carrier_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `yards_blocked` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'yards_blocked_from_plays'
  }),
  player_successful_passing_play_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'successful_passing_play_pct_from_plays',
    // Pool numerator/denominator across a multi-year year_offset range instead
    // of summing per-season percentages (the latent SUM-of-percentages bug).
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN is_successful_play = true THEN 1 ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN passer_pid IS NOT NULL THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({
          numerator: a.numerator,
          denominator: a.denominator,
          scale: '100.0'
        }),
      decimals: 2
    }
  }),

  player_successful_rushing_and_receiving_play_percentage_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid', 'target_pid'],
      stat_name: 'successful_rushing_and_receiving_play_pct_from_plays',
      // Pool numerator/denominator across a multi-year year_offset range instead
      // of summing per-season percentages (the latent SUM-of-percentages bug).
      measure: {
        accumulators: {
          numerator: {
            aggregate: 'sum',
            expr: `CASE WHEN is_successful_play = true THEN 1 ELSE 0 END`
          },
          denominator: {
            aggregate: 'sum',
            expr: `CASE WHEN ball_carrier_pid IS NOT NULL OR target_pid IS NOT NULL THEN 1 ELSE 0 END`
          }
        },
        combine_accumulators: (a, { divide }) =>
          divide({
            numerator: a.numerator,
            denominator: a.denominator,
            scale: '100.0'
          }),
        decimals: 2
      }
    }),

  player_total_expected_points_added_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid', 'ball_carrier_pid', 'target_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `epa` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'total_expected_points_added_from_plays'
  }),

  player_passing_expected_points_added_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `epa` } },
      combine_accumulators: 'identity'
    },
    stat_name: 'passing_expected_points_added_from_plays'
  }),

  player_rushing_and_receiving_expected_points_added_from_plays:
    player_stat_from_plays({
      pid_columns: ['ball_carrier_pid', 'target_pid'],
      measure: {
        accumulators: { value: { aggregate: 'sum', expr: `epa` } },
        combine_accumulators: 'identity'
      },
      stat_name: 'rushing_and_receiving_expected_points_added_from_plays'
    }),

  player_quarterback_epa_from_plays: player_stat_from_plays({
    pid_columns: ['qb_pid'],
    measure: {
      accumulators: { value: { aggregate: 'sum', expr: `quarterback_epa` } },
      combine_accumulators: 'identity'
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
      combine_accumulators: 'identity'
    },
    stat_name: 'quarterback_pressures_from_plays'
  }),

  player_time_to_throw_from_plays: player_stat_from_plays({
    pid_columns: ['passer_pid'],
    stat_name: 'time_to_throw_from_plays',
    // Time-to-throw is a per-dropback mean; a range year_offset must pool the
    // summed time over the summed qualifying-dropback count, not SUM the
    // per-season averages.
    measure: {
      accumulators: {
        numerator: {
          aggregate: 'sum',
          expr: `CASE WHEN time_to_throw IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN time_to_throw ELSE 0 END`
        },
        denominator: {
          aggregate: 'sum',
          expr: `CASE WHEN time_to_throw IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END`
        }
      },
      combine_accumulators: (a, { divide }) =>
        divide({ numerator: a.numerator, denominator: a.denominator }),
      decimals: null
    }
  })
}
