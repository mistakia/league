import player_to_player_year from './bridges/player-to-player-year.mjs'
import player_year_to_player_year_week from './bridges/player-year-to-player-year-week.mjs'
import player_year_to_team_year from './bridges/player-year-to-team-year.mjs'
import team_to_team_year from './bridges/team-to-team-year.mjs'
import team_year_to_team_year_week from './bridges/team-year-to-team-year-week.mjs'

const bridge_modules = [
  player_to_player_year,
  player_year_to_player_year_week,
  player_year_to_team_year,
  team_to_team_year,
  team_year_to_team_year_week
]

const bridges = new Map()
for (const bridge of bridge_modules) {
  if (!bridges.has(bridge.from)) bridges.set(bridge.from, new Map())
  bridges.get(bridge.from).set(bridge.to, bridge)
}

export const resolve = (from, to) => {
  const bridge = bridges.get(from)?.get(to)
  if (!bridge) {
    throw new Error(`No bridge from ${from} to ${to}`)
  }
  return bridge
}

export const has_bridge = (from, to) => Boolean(bridges.get(from)?.get(to))

export const apply_bridge = ({ query_context, from, to }) => {
  const key = `${from}->${to}`
  if (query_context.applied_bridges.has(key)) return
  const bridge = resolve(from, to)
  bridge.add_cte({ query_context })
  bridge.join_cte({ query_context })
  query_context.applied_bridges.add(key)
}

export { bridges }
