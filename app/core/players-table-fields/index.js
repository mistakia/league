import { List } from 'immutable'
import { createSelector } from 'reselect'

import { constants } from '@libs-shared'

import betting_market_table_fields from './betting-market-table-fields'
import espn_table_fields from './espn-table-fields'
import fantasy_league_table_fields from './fantasy-league-table-fields'
import league_format_logs_table_fields from './league-format-logs-table-fields'
import player_table_fields from './player-table-fields'
import projected_table_fields from './projected-table-fields'
import scoring_format_logs_table_fields from './scoring-format-logs-table-fields'
import stats_from_plays_table_fields from './stats-from-plays-table-fields'
import fantasy_points_from_plays_table_fields from './fantasy-points-from-plays-table-fields'

// Player Column Fields
// header_label - string, required
// column_groups - array, optional

// load - optional

// component - optional
// header_className - optional

// getValue - optional
// player_value_path - optional

// getPercentileKey - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional

export const getPlayerTableFields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([constants.week])).get(0),
  (state) => state.getIn(['app', 'userId']),
  (week, userId) => PlayerTableFields({ week, is_logged_in: Boolean(userId) })
  // (state) => state.get('seasonlogs'),
  // (state) => state.getIn(['players', 'positions'], new List()),
  // (state) => state.getIn(['schedule', 'teams']),
  // (week, seasonlogs, player_positions, nfl_team_schedule) =>
  //   PlayerTableFields({ week, seasonlogs, player_positions, nfl_team_schedule })
)

// TODO fields
// - opponent
// - opponent_strength
// - opponent_pass_pa
// - opponent_pass_pc
// - opponent_pass_py
// - opponent_pass_tdp
// - opponent_pass_ints
// - opponent_rush_ra
// - opponent_rush_ry
// - opponent_rush_tdr
// - opponent_recv_trg
// - opponent_recv_rec
// - opponent_recv_recy
// - opponent_recv_tdrec

export function PlayerTableFields({
  week,
  is_logged_in
  // seasonlogs,
  // player_positions,
  // nfl_team_schedule
}) {
  const fields = {
    ...(is_logged_in ? fantasy_league_table_fields({ week }) : {}),

    ...projected_table_fields({ week }),
    ...player_table_fields({ is_logged_in }),

    ...scoring_format_logs_table_fields,
    ...league_format_logs_table_fields,
    ...stats_from_plays_table_fields,
    ...betting_market_table_fields,
    ...espn_table_fields,
    ...fantasy_points_from_plays_table_fields
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].column_id = key
    // TODO remove - I think this is not used
    fields[key].key_path = value.player_value_path
      ? value.player_value_path.split('.')
      : []
    fields[key].column_name = value.player_value_path
    fields[key].accessorKey = value.player_value_path || key
  }

  return fields
}
