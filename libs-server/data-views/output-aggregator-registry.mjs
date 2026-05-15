import aggregator_count from './output-aggregator/aggregator-count.mjs'
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
    plugin.emit_outer_select({ ...args, dispatch_params })
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

export const apply_output_aggregator = ({
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
  plugin.add_cte({
    query_context,
    column_def,
    params,
    cte_name,
    identity_id,
    period
  })
  if (!query_context.joined_output_ctes.has(cte_name)) {
    plugin.join_cte({ query_context, cte_name, identity_id })
    query_context.joined_output_ctes.add(cte_name)
  }
  return plugin.emit_outer_select({
    column_def,
    cte_name,
    column_index,
    params,
    identity_id
  })
}

export { registry }
