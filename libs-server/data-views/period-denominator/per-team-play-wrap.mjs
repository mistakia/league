// Wrap-CTE materialization for the `per_team_play` rate-type family
// (per_team_play, per_team_pass_play, per_team_rush_play, plus the
// half/quarter/drive/series group_by variants) when the view spans multiple
// years AND no `year` split is active AND the subject is `player`.
//
// Why this exists:
// In the standard path, the denominator CTE is grouped by the team_unit
// column (`nfl_plays.offense_nfl_team`/`defense_nfl_team`, aliased back to
// 'off'/'def') alone and the numerator is grouped by `pid` alone (both
// collapse years).
// The outer join binds them via the player's team for ONE year
// (year_reference = max(year_range)). For a player who switched teams across
// the selected years, that misattributes their multi-year receiving stats to
// a single team's multi-year pass-play count -- and players with no row for
// year_reference return NULL even when they accumulated stats in prior years.
//
// What this does:
// For each per_team_play rate-column instance in multi-year-no-split mode,
// materialize a per-pid wrap CTE that:
//   1) Recomputes the numerator at (pid, year) grain inline.
//   2) INNER JOINs `player_year_teams` on (pid, year) so each year's stats
//      land on the team the player actually played for that year.
//   3) INNER JOINs the (off, year)-grain denominator CTE on (team, year).
//   4) GROUPs back to pid, emitting `numerator_sum` and `denominator_sum`.
// The outer query then LEFT JOINs the wrap on pid (1:1) and divides
// `MAX(numerator_sum) / NULLIF(MAX(denominator_sum), 0)`.
//
// The wrap is registered during the per-column dispatch loop and
// materialized by `flush_per_team_play_wraps` after `flush_measure_batches`
// names the underlying numerator scan (in case future revisions share
// numerator CTEs across columns). Today each wrap inlines its own
// numerator subquery; sharing is left to a future revision.

import db from '#db'

import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { build_period_cte } from '#libs-server/data-views/output-aggregator/build-period-cte.mjs'
import { resolve_source_table } from '#libs-server/data-views/output-aggregator/measure-batch.mjs'
import * as identity_bridge_registry from '#libs-server/data-views/identity-bridge-registry.mjs'
import {
  resolve_effective_years,
  extract_matchup_opponent_type
} from '#libs-server/data-views/wrap-predicates.mjs'
import { get_team_attribution } from '#libs-server/data-views/resolve-team-join-target.mjs'

export const get_wrap_cte_name = ({
  column_def,
  column_index,
  rate_type_table_name
}) =>
  `per_team_play_wrap_${get_table_hash(
    `${column_def.column_id}_${column_index}_${rate_type_table_name}`
  )}`

// Wrap fires only for player subjects with 2+ distinct effective years and
// no `year` split (team-subjects and split row-grains already attribute
// correctly). Matchup-opponent-typed columns use point-in-time opponent CTEs
// attached upstream and aren't multi-year addressable.
export const requires_wrap = ({ query_context, params, identity_id }) => {
  if (!identity_id || !identity_id.startsWith('player')) return false
  // 'current' attribution attaches all volume to player.current_nfl_team
  // regardless of year, so there is no per-(pid, year) team to reattribute --
  // the wrap's entire purpose. Skip it; the plain non-wrap join then correlates
  // on current_nfl_team via resolve_team_join_target.
  if (get_team_attribution(params) === 'current') return false
  if (query_context.row_axes.includes('year')) return false
  const years = resolve_effective_years({ query_context, params })
  const distinct_years = new Set(years.map((y) => parseInt(y, 10)))
  if (distinct_years.size < 2) return false
  if (extract_matchup_opponent_type(params)) return false
  return true
}

// Register a pending wrap CTE during the per-column dispatch loop. The
// wrap CTE is materialized later by `flush_per_team_play_wraps` once the
// denominator CTE name and column-def measure scaffolding are stable.
export const register_wrap = ({
  query_context,
  column_def,
  params,
  identity_id,
  column_index,
  rate_type_table_name,
  team_unit
}) => {
  if (!query_context.per_team_play_wraps) {
    query_context.per_team_play_wraps = new Map()
  }
  // Ensure `player_year_teams` is materialized (the bridge's add_cte is
  // idempotent; we don't want its join_cte, which collapses the CTE to a
  // single year_reference, so call add_cte directly rather than apply_bridge).
  const bridge = identity_bridge_registry.resolve('player_year', 'team_year')
  bridge.add_cte({ query_context, params, source: column_def?.source || null })

  const wrap_cte_name = get_wrap_cte_name({
    column_def,
    column_index,
    rate_type_table_name
  })
  if (query_context.per_team_play_wraps.has(wrap_cte_name)) return wrap_cte_name
  query_context.per_team_play_wraps.set(wrap_cte_name, {
    wrap_cte_name,
    column_def,
    params,
    identity_id,
    column_index,
    rate_type_table_name,
    team_unit
  })
  return wrap_cte_name
}

// Resolve the measure arguments `build_period_cte` needs for one column-def.
//
// Split out and awaited BEFORE the builder runs because a knex QueryBuilder is
// thenable: returning one from an `async` function makes the awaiting caller
// EXECUTE the query instead of receiving the builder. Keeping the builder
// synchronous is what stops this wrap from firing its own CTE at the database
// mid-construction.
//
// A COMBINED measure projects its ACCUMULATORS rather than its value, because
// the wrap sums the numerator across years -- and summing a per-year combined
// value is the sum-of-per-year-ratios class the contract makes unrepresentable.
//
// A ROLE-UNION measure (`plays_role_union`) has no top-level `measure_expr` at
// all -- its per-play expressions live on the role attributions, one per role,
// and `build_period_cte` dispatches on measure_source to consume them. Calling
// `column_def.measure_expr(...)` unconditionally threw `measure_expr is not a
// function` for every such column, which made fantasy-points-style columns
// unrenderable under a per_team_play rate in multi-year-no-split mode.
// `resolve_source_table` is likewise undefined for that source, so neither call
// may be reached on this branch.
const resolve_measure_args = async ({ column_def, params, identity_id }) => {
  if (column_def.measure_source === 'plays_role_union') {
    return {
      measure_expr: null,
      role_attributions: await column_def.role_attributions({
        params,
        identity_id
      }),
      game_conditional_expr: column_def.game_conditional_expr
        ? await column_def.game_conditional_expr({ params, identity_id })
        : null
    }
  }
  if (column_def.combined_measure) {
    return { accumulator_selects: column_def.accumulator_selects }
  }
  return {
    measure_expr: column_def.measure_expr({
      table_name: resolve_source_table(column_def.measure_source),
      params,
      identity_id
    })
  }
}

// Materialize all pending wrap CTEs. Called once from the dispatcher after
// `flush_measure_batches` (the order matters only when a future revision
// references the shared numerator CTE from inside the wrap; today each wrap
// inlines its own numerator subquery and is order-independent).
//
// Async only to resolve each entry's measure arguments; the builder it calls
// stays synchronous for the thenable reason above.
export const flush_per_team_play_wraps = async ({ query_context }) => {
  if (!query_context.per_team_play_wraps) return
  for (const [, entry] of query_context.per_team_play_wraps) {
    if (query_context.applied_output_ctes.has(entry.wrap_cte_name)) continue
    const measure_args = await resolve_measure_args({
      column_def: entry.column_def,
      params: entry.params,
      identity_id: entry.identity_id
    })
    const cte_query = build_wrap_cte_query({
      query_context,
      entry,
      measure_args
    })
    query_context.players_query.withMaterialized(entry.wrap_cte_name, cte_query)
    query_context.applied_output_ctes.add(entry.wrap_cte_name)
  }
}

const build_wrap_cte_query = ({ query_context, entry, measure_args }) => {
  const { column_def, params, identity_id, rate_type_table_name, team_unit } =
    entry

  // Build the per-(pid, year) numerator subquery using the same scan
  // semantics as the batched aggregator path, with year grain forced on so
  // the wrap can join on year. measure_source defaults to 'plays' for
  // column-defs that omit it (see player-stats-from-plays).
  const numerator_subquery = build_period_cte({
    measure_source: column_def.measure_source,
    ...measure_args,
    measure_predicate: column_def.measure_predicate
      ? column_def.measure_predicate({ params, identity_id })
      : null,
    role_columns: column_def.role_columns,
    apply_filters: column_def.apply_filters
      ? ({ query }) => column_def.apply_filters({ query, params, identity_id })
      : null,
    period: 'aggregate',
    query_context,
    identity_id,
    params,
    force_year_grain: true
  })

  return db
    .from(numerator_subquery.as('num_y'))
    .innerJoin('player_year_teams', function () {
      this.on('player_year_teams.pid', '=', 'num_y.pid').andOn(
        'player_year_teams.year',
        '=',
        'num_y.year'
      )
    })
    .innerJoin(rate_type_table_name, function () {
      this.on(
        `${rate_type_table_name}.${team_unit}`,
        '=',
        'player_year_teams.team'
      ).andOn(`${rate_type_table_name}.year`, '=', 'num_y.year')
    })
    .select('num_y.pid')
    .select(
      db.raw(
        `${
          column_def.combined_measure
            ? column_def.recombine_accumulators({ table_name: 'num_y' })
            : 'SUM(num_y.measure_total)'
        } AS numerator_sum`
      )
    )
    .select(
      db.raw(
        `SUM(${rate_type_table_name}.rate_type_total_count) AS denominator_sum`
      )
    )
    .groupBy('num_y.pid')
}
