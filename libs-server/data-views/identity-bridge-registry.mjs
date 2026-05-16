import player_to_player_year from './identity-bridges/player-to-player-year.mjs'
import player_year_to_player_year_week from './identity-bridges/player-year-to-player-year-week.mjs'
import player_year_to_team_year from './identity-bridges/player-year-to-team-year.mjs'
import team_to_team_year from './identity-bridges/team-to-team-year.mjs'
import team_year_to_team_year_week from './identity-bridges/team-year-to-team-year-week.mjs'

// Registry key is `"<from>|<to>|<mode>"` (mode defaults to 'default'). Bridges
// declare mode via `export const mode`; callers omit mode to get the default.
// Identity bridges perform pure row-shape composition; source attachment lives
// in source-attach-registry.mjs (which owns reachability for column-defs).

const bridge_modules = [
  player_to_player_year,
  player_year_to_player_year_week,
  player_year_to_team_year,
  team_to_team_year,
  team_year_to_team_year_week
]

const bridges = new Map()

const key_of = (from, to, mode) => `${from}|${to}|${mode}`

const register_bridge = (bridge) => {
  const mode = bridge.mode || 'default'
  const k = key_of(bridge.from, bridge.to, mode)
  bridges.set(k, bridge)
}

for (const bridge of bridge_modules) {
  register_bridge(bridge)
}

export const resolve = (from, to, mode = 'default') => {
  const bridge = bridges.get(key_of(from, to, mode))
  if (!bridge) {
    throw new Error(`No bridge from ${from} to ${to} (mode=${mode})`)
  }
  return bridge
}

export const has_bridge = (from, to, mode = 'default') =>
  bridges.has(key_of(from, to, mode))

export const apply_bridge = ({
  query_context,
  from,
  to,
  mode = 'default',
  params = {}
}) => {
  const key = `${from}->${to}|${mode}`
  if (query_context.applied_bridges.has(key)) return
  const bridge = resolve(from, to, mode)
  bridge.add_cte({ query_context, params })
  bridge.join_cte({ query_context, params })
  query_context.applied_bridges.add(key)
}

export const register = (bridge) => register_bridge(bridge)

export { bridges }
