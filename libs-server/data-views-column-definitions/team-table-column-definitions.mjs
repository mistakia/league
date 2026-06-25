import db from '#db'
import { create_immutable_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { team_values_cte_sql } from '#libs-server/data-views/team-values-cte.mjs'
import {
  PLAYER_TEAMS_CTE,
  PLAYER_YEARS_TEAMS_CTE,
  PLAYER_YEARS_WEEKS_TEAMS_CTE,
  player_teams_cte_sql,
  player_years_teams_cte_sql,
  player_years_weeks_teams_cte_sql
} from '#libs-server/data-views/player-team-bridge-cte.mjs'

// Team-identity columns. Sourced from the `team` VALUES CTE registered by
// the team identity's from_source under team row_grain.
//
// Under player row_grain these columns route through a per-grain bridge
// CTE (player_teams / player_years_teams / player_years_weeks_teams) that
// resolves the player's team set, and the column value becomes an
// array_agg over the matching team rows so traded / multi-team players
// carry every team they were associated with in the window.

const team_table_get_cache_info = create_immutable_cache_info()

const get_player_bridge = ({ row_axes = [] } = {}) => {
  if (row_axes.includes('week')) return PLAYER_YEARS_WEEKS_TEAMS_CTE
  if (row_axes.includes('year')) return PLAYER_YEARS_TEAMS_CTE
  return PLAYER_TEAMS_CTE
}

const is_player_row_grain = (query_context) =>
  query_context && query_context.row_grain_id !== 'team'

const ensure_team_values_cte = ({ query, query_context }) => {
  if (!query_context.registered_ctes) query_context.registered_ctes = new Set()
  if (query_context.registered_ctes.has('team')) return
  query.with('team', db.raw(team_values_cte_sql()))
  query_context.registered_ctes.add('team')
}

const ensure_player_bridge_cte = ({ query, query_context, row_axes }) => {
  if (!query_context.registered_ctes) query_context.registered_ctes = new Set()
  const bridge = get_player_bridge({ row_axes })
  if (query_context.registered_ctes.has(bridge)) return
  if (bridge === PLAYER_TEAMS_CTE) {
    query.with(bridge, db.raw(player_teams_cte_sql()))
  } else if (bridge === PLAYER_YEARS_TEAMS_CTE) {
    query.with(
      bridge,
      db.raw(player_years_teams_cte_sql({ year_range: query_context.year_range }))
    )
  } else {
    query.with(
      bridge,
      db.raw(
        player_years_weeks_teams_cte_sql({ year_range: query_context.year_range })
      )
    )
  }
  query_context.registered_ctes.add(bridge)
}

const get_bridge_join_keys = ({ bridge, query_context }) => {
  const keys = [{ left: `${bridge}.pid`, right: 'player.pid' }]
  if (bridge === PLAYER_YEARS_TEAMS_CTE) {
    keys.push({
      left: `${bridge}.year`,
      right: query_context.year_reference || 'player_years.year'
    })
  } else if (bridge === PLAYER_YEARS_WEEKS_TEAMS_CTE) {
    keys.push({
      left: `${bridge}.year`,
      right: query_context.year_reference || 'player_years.year'
    })
    keys.push({
      left: `${bridge}.week`,
      right: query_context.week_reference || 'player_years_weeks.week'
    })
  }
  return keys
}

const join_player_bridge = ({ query, query_context, row_axes, join_type }) => {
  const bridge = get_player_bridge({ row_axes })
  const join_key_set = `joined_player_team_bridges`
  if (!query_context[join_key_set]) query_context[join_key_set] = new Set()
  if (query_context[join_key_set].has(bridge)) return
  const keys = get_bridge_join_keys({ bridge, query_context })
  const fn = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  query[fn](bridge, function () {
    for (const k of keys) this.on(k.left, '=', k.right)
  })
  query_context[join_key_set].add(bridge)
}

const make_column = ({ column_name }) => ({
  table_name: 'team',
  column_name,
  source: { grain: 'team' },
  get_cache_info: team_table_get_cache_info,

  table_alias: ({ row_axes = [], query_context = null } = {}) => {
    if (is_player_row_grain(query_context)) {
      return get_player_bridge({ row_axes })
    }
    return 'team'
  },

  // Under player row_grain, the value is per-player (or per (player,year)):
  // - team_code -> the bridge CTE's `teams` array directly (already text[])
  // - others -> correlated array_agg over the team VALUES CTE for each
  //   team_code in the bridge's `teams` array.
  main_select: ({ table_name, column_index, row_axes, query_context }) => {
    if (is_player_row_grain(query_context)) {
      const bridge = get_player_bridge({ row_axes })
      if (column_name === 'team_code') {
        return [`${bridge}.teams as ${column_name}_${column_index}`]
      }
      return [
        `(SELECT array_agg(team.${column_name} ORDER BY team.team_code) FROM team WHERE team.team_code = ANY(${bridge}.teams)) as ${column_name}_${column_index}`
      ]
    }
    return [`${table_name}.${column_name} as ${column_name}_${column_index}`]
  },

  main_group_by: ({ table_name, row_axes, query_context }) => {
    if (is_player_row_grain(query_context)) {
      const bridge = get_player_bridge({ row_axes })
      return [`${bridge}.teams`]
    }
    return [`${table_name}.${column_name}`]
  },

  // Filters on team-identity columns under player row_grain treat the
  // value as the set of team-attribute values across the player's team
  // membership window. Mirrors player_nfl_teams array semantics.
  is_where_column_array: ({ row_axes = [], query_context = null } = {}) =>
    is_player_row_grain(query_context),

  main_where: ({ table_name, row_axes, query_context }) => {
    if (is_player_row_grain(query_context)) {
      const bridge = get_player_bridge({ row_axes })
      if (column_name === 'team_code') {
        return `${bridge}.teams`
      }
      return `(SELECT array_agg(team.${column_name}) FROM team WHERE team.team_code = ANY(${bridge}.teams))`
    }
    return `${table_name}.${column_name}`
  },

  register_ctes: async ({ query, row_axes, data_view_options }) => {
    const query_context = data_view_options?.query_context
    if (!is_player_row_grain(query_context)) return
    ensure_player_bridge_cte({ query, query_context, row_axes })
    if (column_name !== 'team_code') {
      ensure_team_values_cte({ query, query_context })
    }
  },

  join: async ({ query, row_axes, data_view_options, join_type }) => {
    const query_context = data_view_options?.query_context
    if (!is_player_row_grain(query_context)) return
    ensure_player_bridge_cte({ query, query_context, row_axes })
    if (column_name !== 'team_code') {
      ensure_team_values_cte({ query, query_context })
    }
    join_player_bridge({ query, query_context, row_axes, join_type })
  }
})

export default {
  team_code: make_column({ column_name: 'team_code' }),
  team_name: make_column({ column_name: 'team_name' }),
  team_conference: make_column({ column_name: 'team_conference' }),
  team_division: make_column({ column_name: 'team_division' })
}
