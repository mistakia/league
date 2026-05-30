import player from './row-grains/player.mjs'
import team from './row-grains/team.mjs'

const row_grains = { player, team }

export const resolve_row_grain = (row_grain_id) => {
  const row_grain = row_grains[row_grain_id]
  if (!row_grain) {
    throw new Error(`Unknown row_grain: ${row_grain_id}`)
  }
  return row_grain
}

const identity_for_row_grain_splits = (row_grain_id, splits) => {
  const has_year = splits.includes('year')
  const has_week = splits.includes('week')
  if (row_grain_id === 'player') {
    if (has_week) return 'player_year_week'
    if (has_year) return 'player_year'
    return 'player'
  }
  if (row_grain_id === 'team') {
    if (has_week) return 'team_year_week'
    if (has_year) return 'team_year'
    return 'team'
  }
  throw new Error(`Unknown row_grain: ${row_grain_id}`)
}

export const identity_for = ({ row_grain_id, splits = [] }) =>
  identity_for_row_grain_splits(row_grain_id, splits)

export { row_grains }
