import db from '#db'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_rate_type_denominator_params, {
  get_play_level_params_hash_suffix
} from '#libs-shared/get-rate-type-denominator-params.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import * as identity_bridge_registry from '#libs-server/data-views/identity-bridge-registry.mjs'
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

  const play_level_params_suffix = get_play_level_params_hash_suffix({ params })

  return get_table_hash(
    `per_team_play${play_type_suffix}${group_by_suffix}${team_type_suffix}${matchup_opponent_suffix}${play_level_params_suffix}_nfl_week_${nfl_week.join('_')}`
  )
}

export const add_per_team_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
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
  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_plays.year')
      cte_query.groupBy('nfl_plays.year')
      year_grouped = true
    } else if (split === 'week') {
      cte_query.select('nfl_plays.week')
      cte_query.groupBy('nfl_plays.week')
    }
  }

  // Wrap-mode requires (off, year) grain so the wrap CTE can join the
  // year-of-stat to that year's team and that year's team-pass-play total.
  // Without this the wrap collapses the per-year denominator to a single
  // total-across-years number and the historical-team-mode attribution is
  // lost. Idempotent against the splits-year branch above.
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
  splits,
  group_by = null,
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
  // Skipped for matchup_opponent_type (joins against upstream opponents CTE).
  const player_cell =
    query_context &&
    query_context.identity_id &&
    query_context.identity_id.startsWith('player')
  if (player_cell && !matchup_opponent_type) {
    identity_bridge_registry.apply_bridge({
      query_context,
      from: 'player_year',
      to: 'team_year',
      mode: 'default',
      params
    })
  }

  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    if (matchup_opponent_type) {
      switch (matchup_opponent_type) {
        case 'current_week_opponent_total':
          this.on(
            `${rate_type_table_name}.${team_unit}`,
            'current_week_opponents.opponent'
          )
          break
        case 'next_week_opponent_total':
          this.on(
            `${rate_type_table_name}.${team_unit}`,
            'next_week_opponents.opponent'
          )
          break

        default:
          console.log(`Unknown matchup_opponent_type: ${matchup_opponent_type}`)
          break
      }
    } else {
      const team_join_target = player_cell
        ? 'player_year_teams.team'
        : 'player.current_nfl_team'
      this.on(`${rate_type_table_name}.${team_unit}`, team_join_target)
    }

    if (splits.includes('year')) {
      if (has_year_offset_range) {
        const min_offset = Math.min(...year_offset)
        const max_offset = Math.max(...year_offset)
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN ${data_view_options.year_reference} + ? AND ${data_view_options.year_reference} + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(
            `${rate_type_table_name}.year = ${data_view_options.year_reference} + ?`,
            [offset]
          )
        )
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

    if (splits.includes('week')) {
      this.on(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }

    // TODO review this

    if (group_by) {
      switch (group_by) {
        case 'half':
          this.on(
            db.raw(
              `${rate_type_table_name}.half = CASE WHEN player_games.qtr <= 2 THEN 1 ELSE 2 END`
            )
          )
          break
        case 'quarter':
          this.on(`${rate_type_table_name}.qtr`, 'player_games.qtr')
          break
        case 'drive':
          this.on(`${rate_type_table_name}.drive_seq`, 'player_games.drive_seq')
          break
        case 'series':
          this.on(
            `${rate_type_table_name}.series_seq`,
            'player_games.series_seq'
          )
          break
      }
    }
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
  'rate_type_column_params'
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
    splits: query_context.splits,
    play_type: dispatch_params.play_type ?? null,
    group_by: dispatch_params.group_by ?? null,
    team_unit: resolve_team_unit(column_def, dispatch_params),
    query_context,
    force_year_grain: wrap_mode
  })
  query_context.applied_output_ctes.add(cte_name)
}

// Legacy parity: rate_type_handlers wired join_cte directly to
// join_per_team_play_cte without dispatch params; the group_by-branch join
// conditions (drive_seq / series_seq / qtr / half) were never emitted on the
// JOIN even though add_cte emits them on the CTE.
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
    splits: query_context.splits,
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
