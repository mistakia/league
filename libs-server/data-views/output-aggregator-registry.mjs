import aggregator_count from './output-aggregator/aggregator-count.mjs'
import aggregator_rate from './output-aggregator/aggregator-rate.mjs'
import { numerator_via_cte } from './rate-type/emit-rate-outer-select.mjs'
import plugin_per_game from './rate-type/rate-type-per-game.mjs'
import plugin_per_team_play from './rate-type/rate-type-per-team-play.mjs'
import plugin_per_player from './rate-type/rate-type-per-player.mjs'
import plugin_per_player_play from './rate-type/rate-type-per-player-play.mjs'
import plugin_per_player_route from './rate-type/rate-type-per-player-route.mjs'

const COUNT_PERIODS = ['game', 'season']

const registry = new Map()

const register = (period, aggregation, plugin) => {
  if (!registry.has(period)) registry.set(period, new Map())
  registry.get(period).set(aggregation, plugin)
}

// Adapter binds a plugin instance to a fixed set of dispatch_params (captured
// from the registration site) and exposes the plain plugin interface.
const adapt = (plugin, dispatch_params) => ({
  consumes_params: plugin.consumes_params,
  get_cte_name: (args) => plugin.get_cte_name({ ...args, dispatch_params }),
  add_cte: (args) => plugin.add_cte({ ...args, dispatch_params }),
  join_cte: (args) => plugin.join_cte({ ...args, dispatch_params }),
  emit_outer_select: (args) =>
    plugin.emit_outer_select({ ...args, dispatch_params }),
  // Optional hook: when defined and returning true for the current dispatch,
  // the standard aggregator_rate numerator path is skipped because the
  // plugin's own CTE materialization owns the numerator (e.g.
  // rate-type-per-team-play's multi-year-no-split wrap CTE inlines its own
  // (pid, year) numerator subquery).
  handles_numerator: plugin.handles_numerator
    ? (args) => plugin.handles_numerator({ ...args, dispatch_params })
    : null
})

// 19 (period, 'rate') tuples — module-keyed not token-keyed; dispatch params
// captured in the registry closure mirror the legacy `rate_type_handlers` map
// in `libs-server/data-views/rate-type/index.mjs`.
register('game', 'rate', adapt(plugin_per_game, {}))

register('team_play', 'rate', adapt(plugin_per_team_play, {}))
register(
  'team_pass_play',
  'rate',
  adapt(plugin_per_team_play, { play_type: 'PASS' })
)
register(
  'team_rush_play',
  'rate',
  adapt(plugin_per_team_play, { play_type: 'RUSH' })
)
register('team_half', 'rate', adapt(plugin_per_team_play, { group_by: 'half' }))
register(
  'team_quarter',
  'rate',
  adapt(plugin_per_team_play, { group_by: 'quarter' })
)
register(
  'team_drive',
  'rate',
  adapt(plugin_per_team_play, { group_by: 'drive' })
)
register(
  'team_series',
  'rate',
  adapt(plugin_per_team_play, { group_by: 'series' })
)

register(
  'player_rush_attempt',
  'rate',
  adapt(plugin_per_player, { stat_type: 'rush_attempt' })
)
register(
  'player_pass_attempt',
  'rate',
  adapt(plugin_per_player, { stat_type: 'pass_attempt' })
)
register(
  'player_target',
  'rate',
  adapt(plugin_per_player, { stat_type: 'target' })
)
register(
  'player_catchable_target',
  'rate',
  adapt(plugin_per_player, {
    stat_type: 'target',
    rate_type_params: { catchable_ball: true }
  })
)
register(
  'player_deep_target',
  'rate',
  adapt(plugin_per_player, {
    stat_type: 'target',
    rate_type_params: { dot: [20, 99] }
  })
)
register(
  'player_catchable_deep_target',
  'rate',
  adapt(plugin_per_player, {
    stat_type: 'target',
    rate_type_params: { dot: [20, 99], catchable_ball: true }
  })
)
register(
  'player_reception',
  'rate',
  adapt(plugin_per_player, { stat_type: 'reception' })
)
register(
  'player_touch',
  'rate',
  adapt(plugin_per_player, { stat_type: 'touch' })
)
register(
  'player_opportunity',
  'rate',
  adapt(plugin_per_player, { stat_type: 'opportunity' })
)

register('player_play', 'rate', adapt(plugin_per_player_play, {}))
register(
  'player_pass_play',
  'rate',
  adapt(plugin_per_player_play, { play_type: 'PASS' })
)
register(
  'player_rush_play',
  'rate',
  adapt(plugin_per_player_play, { play_type: 'RUSH' })
)

register('player_route', 'rate', adapt(plugin_per_player_route, {}))

for (const period of COUNT_PERIODS) register(period, 'count', aggregator_count)

export const resolve = ({ period, aggregation, column_def }) => {
  // Per-column override: columns whose value lives in a denominator-shaped
  // CTE (player-routes, player-snaps) cannot use the legacy per-family
  // plugin's `SUM(measure_expr)/rate_type_total_count` emit shape (no outer
  // measure source exists). They declare `output_aggregator` directly on the
  // column-def and bypass the registry; their measure is materialized via
  // `build_period_cte` so `aggregator-rate` / `aggregator-count` produce the
  // correct `SUM(measure_total)/COUNT(period_key)` emission.
  if (column_def?.output_aggregator) {
    const overrides = column_def.output_aggregator
    const plugin =
      typeof overrides === 'function'
        ? overrides
        : overrides[aggregation] || overrides.default || overrides
    if (plugin?.add_cte && plugin?.emit_outer_select) return plugin
  }
  const plugin = registry.get(period)?.get(aggregation)
  if (!plugin) {
    throw new Error(
      `No output aggregator for (period=${period}, aggregation=${aggregation})`
    )
  }
  return plugin
}

export const has_aggregator = ({ period, aggregation }) =>
  Boolean(registry.get(period)?.get(aggregation))

export const get_cte_name = ({ column_def, params, identity_id }) => {
  const { period, aggregation } = params.output
  const plugin = resolve({ period, aggregation, column_def })
  return plugin.get_cte_name({ column_def, params, identity_id, period })
}

export const apply_output_aggregator = async ({
  query_context,
  column_def,
  params,
  identity_id,
  column_index
}) => {
  const { period, aggregation } = params.output
  const plugin = resolve({ period, aggregation, column_def })
  const cte_name = plugin.get_cte_name({
    column_def,
    params,
    identity_id,
    period
  })
  await plugin.add_cte({
    query_context,
    column_def,
    params,
    cte_name,
    identity_id,
    period
  })
  // Plugin-owned numerator: when the plugin's `handles_numerator` hook
  // returns true for this dispatch, the plugin materializes the numerator
  // itself (e.g. inlined inside a wrap CTE) and the standard
  // aggregator_rate numerator add_cte/join_cte pair would either duplicate
  // work or, worse, attach a (pid, year)-grain numerator CTE to the outer
  // query and cross-multiply player rows. Skip both.
  const plugin_handles_numerator =
    plugin.handles_numerator &&
    plugin.handles_numerator({ query_context, params, identity_id })
  // When the plugin handles its own numerator, each column instance needs
  // its own outer join (the wrap CTE is per-column, even though the
  // denominator CTE may be shared). Bypass the `joined_output_ctes` dedup
  // so the plugin's join_cte runs once per column.
  if (
    plugin_handles_numerator ||
    !query_context.joined_output_ctes.has(cte_name)
  ) {
    plugin.join_cte({
      query_context,
      cte_name,
      identity_id,
      params,
      column_def,
      column_index
    })
    query_context.joined_output_ctes.add(cte_name)
  }
  // Numerator CTE: legacy denominator-style plugins (per_game / per_player /
  // per_team_play / per_player_play / per_player_route) only materialize the
  // denominator. Columns whose measure isn't an inline expression over
  // nfl_plays / player_gamelogs (e.g. `plays_role_union` for fantasy points,
  // `snaps` for snap counts, `plays_receiver` for routes) need a separately
  // materialized numerator CTE; emit_rate_outer_select reads from it. Skipped
  // when the chosen plugin is aggregator_rate itself (it already materializes
  // the canonical period CTE).
  if (
    plugin !== aggregator_rate &&
    numerator_via_cte() &&
    !plugin_handles_numerator
  ) {
    // period='aggregate' collapses the numerator CTE to (pid|team_code,
    // year) grain so it joins 1:1 with the outer query. Without this,
    // multi-column rate queries cross-multiply via per-period rows in each
    // numerator CTE, inflating SUM(measure_total) by the cardinality of
    // sibling numerator CTEs. See emit-rate-outer-select.mjs for the
    // corresponding outer SELECT shape.
    const num_cte_name = aggregator_rate.get_cte_name({
      column_def,
      params,
      identity_id,
      period: 'aggregate'
    })
    await aggregator_rate.add_cte({
      query_context,
      column_def,
      params,
      cte_name: num_cte_name,
      identity_id,
      period: 'aggregate'
    })
    if (!query_context.joined_output_ctes.has(num_cte_name)) {
      aggregator_rate.join_cte({
        query_context,
        cte_name: num_cte_name,
        identity_id,
        params
      })
      query_context.joined_output_ctes.add(num_cte_name)
    }
  }
  return plugin.emit_outer_select({
    query_context,
    column_def,
    cte_name,
    column_index,
    params,
    identity_id
  })
}

export { registry }
