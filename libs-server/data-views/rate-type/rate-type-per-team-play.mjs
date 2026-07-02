import db from '#db'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_rate_type_denominator_params, {
  get_play_level_params_hash_suffix
} from '#libs-shared/get-rate-type-denominator-params.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import * as identity_bridge_registry from '#libs-server/data-views/identity-bridge-registry.mjs'
import {
  resolve_team_join_target,
  get_team_attribution
} from '#libs-server/data-views/resolve-team-join-target.mjs'
import {
  requires_wrap,
  register_wrap,
  get_wrap_cte_name
} from './per-team-play-wrap.mjs'

// Cache-key contract: the returned name is a within-query dedup identifier
// (see `applied_output_ctes` in add_cte below), NOT a cross-query result-cache
// key. The hash inputs are column-side params (team_unit, play_type, group_by,
// matchup_opponent_type, output_column_params, and the year/seas_type/nfl_week
// expansion via resolve_nfl_week_id_from_year_param). The actual CTE filter
// is the intersection of column params and view scope -- computed at emit time
// by apply_scope_to_query against query_context.nfl_week_ids -- which is not
// reflected in the name. Within a single query the view scope is constant, so
// two columns with the same column-side params always resolve to the same
// effective scope; dedup is correct. Do NOT reuse this name as a result-cache
// key across queries without first folding query_context.nfl_week_ids (or the
// effective_scope from compute_effective_scope) into the hash, or the cached
// result will leak across views with different view scopes.
export const get_per_team_play_cte_table_name = ({
  params = {},
  play_type = null,
  group_by = null,
  team_unit = 'off'
} = {}) => {
  team_unit = params.team_unit || team_unit

  const nfl_week = resolve_nfl_week_id_from_year_param(params)

  const play_type_suffix = play_type ? `_${play_type.toLowerCase()}` : ''
  const group_by_suffix = group_by ? `_${group_by}` : ''
  const team_type_suffix = team_unit === 'def' ? '_def' : '_off'
  const matchup_opponent_type = params.matchup_opponent_type || null
  const matchup_opponent_suffix = matchup_opponent_type
    ? `_${matchup_opponent_type}`
    : ''

  // team_attribution changes the CTE BODY, not just the join: 'current' forces
  // the flat (no-wrap) denominator, while 'historical' multi-year-no-split takes
  // the year-grain wrap path (force_year_grain). Two columns differing only in
  // team_attribution must therefore NOT share this CTE. Suffix is empty for the
  // 'historical' default so existing CTE names stay byte-identical.
  const team_attribution_suffix =
    get_team_attribution(params) === 'current'
      ? '_team_attribution_current'
      : ''

  const play_level_params_suffix = get_play_level_params_hash_suffix({ params })

  return get_table_hash(
    `per_team_play${play_type_suffix}${group_by_suffix}${team_type_suffix}${matchup_opponent_suffix}${team_attribution_suffix}${play_level_params_suffix}_nfl_week_${nfl_week.join('_')}`
  )
}

export const add_per_team_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  row_axes,
  play_type = null,
  group_by = null,
  team_unit = 'off',
  data_view_options = {},
  query_context = null,
  force_year_grain = false
}) => {
  team_unit = params.team_unit || team_unit

  const cte_query = db('nfl_plays')
    .select(`nfl_plays.${team_unit}`)
    .whereNot('play_type', 'NOPL')
    .groupBy(`nfl_plays.${team_unit}`)

  let count_expression = 'COUNT(*)'
  if (group_by) {
    switch (group_by) {
      case 'half':
        count_expression =
          'COUNT(DISTINCT CONCAT(nfl_plays.esbid, CASE WHEN qtr <= 2 THEN 1 ELSE 2 END))'
        break
      case 'quarter':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, qtr))'
        break
      case 'drive':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, drive_seq))'
        break
      case 'series':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, series_seq))'
        break
    }
  }

  cte_query.select(db.raw(`${count_expression} as rate_type_total_count`))

  if (play_type) {
    cte_query.where('play_type', play_type)
  } else {
    cte_query.whereIn('play_type', ['PASS', 'RUSH'])
  }

  let year_grouped = false
  for (const row_axis of row_axes) {
    if (row_axis === 'year') {
      cte_query.select('nfl_plays.year')
      cte_query.groupBy('nfl_plays.year')
      year_grouped = true
    } else if (row_axis === 'week') {
      cte_query.select('nfl_plays.week')
      cte_query.groupBy('nfl_plays.week')
    }
  }

  // Wrap-mode requires (off, year) grain so the wrap CTE can join the
  // year-of-stat to that year's team and that year's team-pass-play total.
  // Without this the wrap collapses the per-year denominator to a single
  // total-across-years number and the historical-team-mode attribution is
  // lost. Idempotent against the row_axes-year branch above.
  if (force_year_grain && !year_grouped) {
    cte_query.select('nfl_plays.year')
    cte_query.groupBy('nfl_plays.year')
  }

  const denominator_params = get_rate_type_denominator_params({ params })
  delete denominator_params.year_offset

  apply_play_by_play_column_params_to_query({
    query: cte_query,
    params: denominator_params,
    query_context
  })

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on.
  players_query.withMaterialized(rate_type_table_name, cte_query)
}

export const join_per_team_play_cte = ({
  players_query,
  query_context,
  params,
  rate_type_table_name,
  row_axes,
  team_unit = 'off',
  data_view_options = {}
}) => {
  team_unit = params.team_unit || team_unit

  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0] &&
      typeof params.matchup_opponent_type[0] === 'object'
      ? null
      : params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  // For per_team_play denominators we want the player's team for the
  // (pid, year) being aggregated, not their current_nfl_team. Bridge
  // player_year->team_year materializes player_year_teams unconditionally so
  // historical-team-mode is structural rather than a runtime conditional.
  // Skipped for matchup_opponent_type (joins against upstream opponents CTE)
  // and for team_attribution='current' (the in-closure resolver then returns
  // player.current_nfl_team instead of player_year_teams.team).
  const player_cell =
    query_context &&
    query_context.identity_id &&
    query_context.identity_id.startsWith('player')
  if (
    player_cell &&
    !matchup_opponent_type &&
    get_team_attribution(params) !== 'current'
  ) {
    identity_bridge_registry.apply_bridge({
      query_context,
      from: 'player_year',
      to: 'team_year',
      mode: 'default',
      params
    })
  }

  players_query.leftJoin(rate_type_table_name, function () {
    const team_join_target = resolve_team_join_target({
      query_context,
      params
    })
    this.on(`${rate_type_table_name}.${team_unit}`, team_join_target)

    if (row_axes.includes('year')) {
      const offset_range = resolve_year_offset_range(params)
      if (offset_range) {
        // Correlate the rate-type table year to the base-year anchor THROUGH
        // the offset via the shared primitive (single `= ref+k`, range
        // BETWEEN) -- replaces the inline has_year_offset_range /
        // has_single_year_offset reimplementation.
        emit_year_match({
          builder: this,
          db,
          year_reference: data_view_options.year_reference,
          source: {},
          key_columns: { year: 'year' },
          params,
          ref: rate_type_table_name
        })
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(
            `${rate_type_table_name}.year`,
            data_view_options.year_reference
          )
        }
      }
    }

    if (row_axes.includes('week')) {
      this.on(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }

    // No group_by correlation here by design: a group_by period
    // (half/quarter/drive/series) is encapsulated in the denominator's
    // COUNT(DISTINCT CONCAT(esbid, <dim>)) expression in add_per_team_play_cte,
    // which keeps the CTE at team grain. There is no per-dimension column to
    // join against, and correlating one would fan the denominator out.
  })
}

// ---- output-aggregator plugin interface (identity-driven) -----------------

export const consumes_params = [
  'year',
  'nfl_week_id',
  'seas_type',
  'year_offset',
  'matchup_opponent_type',
  'team_unit',
  'output_column_params',
  'rate_type_column_params',
  'team_attribution'
]

const resolve_team_unit = (column_def, dispatch_params) =>
  column_def?.team_unit ?? dispatch_params.team_unit ?? 'off'

export const get_cte_name = ({ column_def, params, dispatch_params = {} }) => {
  return get_per_team_play_cte_table_name({
    params,
    ...dispatch_params,
    team_unit: resolve_team_unit(column_def, dispatch_params)
  })
}

export const add_cte = ({
  query_context,
  column_def,
  params,
  cte_name,
  identity_id,
  dispatch_params = {}
}) => {
  // Idempotent: subsequent column instances sharing the same denominator
  // CTE name skip re-materialization. The wrap CTE (registered per-column
  // in join_cte) is independent of this dedup.
  if (query_context.applied_output_ctes.has(cte_name)) return
  const wrap_mode = requires_wrap({ query_context, params, identity_id })
  add_per_team_play_cte({
    players_query: query_context.players_query,
    params,
    rate_type_table_name: cte_name,
    row_axes: query_context.row_axes,
    play_type: dispatch_params.play_type ?? null,
    group_by: dispatch_params.group_by ?? null,
    team_unit: resolve_team_unit(column_def, dispatch_params),
    query_context,
    force_year_grain: wrap_mode
  })
  query_context.applied_output_ctes.add(cte_name)
}

// dispatch_params (play_type / group_by) intentionally not threaded into the
// standard join: both affect only the CTE body (the play filter and the
// COUNT(DISTINCT) denominator), never the join correlation, which is the team
// unit (+ year/week split). See join_per_team_play_cte. team_unit is the lone
// dispatch field the join needs, and it is resolved explicitly below.
export const join_cte = ({
  query_context,
  column_def,
  cte_name,
  identity_id,
  params,
  column_index,
  dispatch_params = {}
}) => {
  const effective_params = params ?? query_context.params
  if (requires_wrap({ query_context, params: effective_params, identity_id })) {
    // Wrap mode: skip the standard denom-on-team join entirely. The wrap
    // CTE references the denom CTE internally per-(team, year); the only
    // outer-query join we need is wrap -> player on pid, which join_wrap
    // emits below. The wrap itself is materialized later by
    // flush_per_team_play_wraps once measure batches settle.
    join_wrap_cte({
      query_context,
      column_def,
      cte_name,
      params: effective_params,
      identity_id,
      column_index,
      team_unit: resolve_team_unit(column_def, dispatch_params)
    })
    return
  }
  join_per_team_play_cte({
    players_query: query_context.players_query,
    query_context,
    params: effective_params,
    rate_type_table_name: cte_name,
    row_axes: query_context.row_axes,
    team_unit: resolve_team_unit(column_def, dispatch_params),
    data_view_options: query_context.data_view_options
  })
}

const join_wrap_cte = ({
  query_context,
  column_def,
  cte_name,
  params,
  identity_id,
  column_index,
  team_unit
}) => {
  const wrap_cte_name = register_wrap({
    query_context,
    column_def,
    params,
    identity_id,
    column_index,
    rate_type_table_name: cte_name,
    team_unit
  })
  // Forward reference to the wrap CTE -- knex defers SQL emission until the
  // outer query's toString(), by which point flush_per_team_play_wraps has
  // materialized the wrap via withMaterialized.
  query_context.players_query.leftJoin(wrap_cte_name, function () {
    this.on(
      `${wrap_cte_name}.pid`,
      '=',
      query_context.data_view_options.pid_reference
    )
  })
}

export const emit_outer_select = (args) => {
  const {
    query_context,
    column_def,
    cte_name,
    column_index,
    params,
    identity_id
  } = args
  if (requires_wrap({ query_context, params, identity_id })) {
    const wrap_cte_name = get_wrap_cte_name({
      column_def,
      column_index,
      rate_type_table_name: cte_name
    })
    if (!column_def.column_name) {
      throw new Error(
        `per_team_play wrap requires column_def.column_name (column_id=${column_def.column_id})`
      )
    }
    const alias = `${column_def.column_name}_${column_index}`
    return {
      sql: `CAST(MAX(${wrap_cte_name}.numerator_sum) AS DECIMAL) / NULLIF(CAST(MAX(${wrap_cte_name}.denominator_sum) AS DECIMAL), 0) AS ${alias}`,
      bindings: []
    }
  }
  return emit_rate_outer_select(args)
}

// Skip the standard aggregator-rate numerator path when the wrap will
// materialize its own per-(pid, year) numerator subquery internally.
// `apply_output_aggregator` consults this hook to decide whether to invoke
// `aggregator_rate.add_cte` / `aggregator_rate.join_cte` after the plugin's
// own add_cte/join_cte run.
export const handles_numerator = ({ query_context, params, identity_id }) =>
  requires_wrap({ query_context, params, identity_id })

export default {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select,
  handles_numerator
}
