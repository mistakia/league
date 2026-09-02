import player from './row-grains/player.mjs'
import team from './row-grains/team.mjs'
import { invalid_data_view_request } from '#libs-server/data-views/invalid-data-view-request.mjs'

const row_grains = { player, team }

export const resolve_row_grain = (row_grain_id) => {
  const row_grain = row_grains[row_grain_id]
  if (!row_grain) {
    throw invalid_data_view_request(`Unknown row_grain: ${row_grain_id}`)
  }
  return row_grain
}

const identity_for_row_grain_row_axes = (row_grain_id, row_axes) => {
  const has_year = row_axes.includes('year')
  const has_week = row_axes.includes('week')
  const has_line = row_axes.includes('line')
  if (row_grain_id === 'player') {
    // The line axis is a REFINEMENT of the week axis, not an alternative to
    // it. A betting line belongs to one game, so a rung with no week to sit in
    // has no meaning -- and the rung CTE is built on player_years_weeks, which
    // only exists when the week bridge attaches. A line request without a week
    // is therefore an under-specified request rather than a coarser one, and
    // answering it at week grain would silently drop the axis the caller asked
    // for; refusing says so.
    if (has_line && !has_week) {
      throw invalid_data_view_request(
        "row_axes 'line' requires 'week': an alternate line belongs to a single game"
      )
    }
    if (has_line) return 'player_year_week_line'
    if (has_week) return 'player_year_week'
    if (has_year) return 'player_year'
    return 'player'
  }
  if (has_line) {
    throw invalid_data_view_request(
      `row_axes 'line' is not supported for row_grain '${row_grain_id}': a line is posted per player selection`
    )
  }
  if (row_grain_id === 'team') {
    if (has_week) return 'team_year_week'
    if (has_year) return 'team_year'
    return 'team'
  }
  throw invalid_data_view_request(`Unknown row_grain: ${row_grain_id}`)
}

export const identity_for = ({ row_grain_id, row_axes = [] }) =>
  identity_for_row_grain_row_axes(row_grain_id, row_axes)

export { row_grains }
