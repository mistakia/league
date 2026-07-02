import { List } from 'immutable'
import { createSelector } from 'reselect'

import { data_view_fields_index } from '@libs-shared'
import { current_season } from '@constants'
import ColumnParamNflWeekSelector from '@components/column-param-nfl-week-selector/column-param-nfl-week-selector.js'

import betting_market_table_fields from './betting-market-table-fields'
import espn_score_table_fields from './espn-score-table-fields'
import fantasy_league_table_fields from './fantasy-league-table-fields'
import league_format_logs_table_fields from './league-format-logs-table-fields'
import player_table_fields from './player-table-fields'
import team_table_fields from './team-table-fields'
import projected_table_fields from './projected-table-fields'
import scoring_format_logs_table_fields from './scoring-format-logs-table-fields'
import player_stats_from_plays_table_fields from './player-stats-from-plays-table-fields'
import fantasy_points_from_plays_table_fields from './fantasy-points-from-plays-table-fields'
import team_stats_from_plays_table_fields from './team-stats-from-plays-table-fields'
import keeptradecut_table_fields from './keeptradecut-table-fields'
import player_games_played_table_fields from './player-games-played-table-fields'
import player_contract_table_fields from './player-contract-table-fields'
import player_pff_seasonlogs_table_fields from './player-pff-seasonlogs-table-fields'
import player_seasonlogs_table_fields from './player-seasonlogs-table-fields'
import player_rankings_table_fields from './player-rankings-table-fields'
import player_adp_table_fields from './player-adp-table-fields'
import player_dfs_salaries_table_fields from './player-dfs-salaries-table-fields'
import practice_table_fields from './practice-table-fields'
import espn_line_win_rates_table_fields from './espn-line-win-rates-table-fields'
import game_table_fields from './game-table-fields'
import player_snaps_table_fields from './player-snaps-table-fields'
import player_routes_table_fields from './player-routes-table-fields'
import team_dvoa_table_fields from './team-dvoa-table-fields'
import nfl_team_seasonlogs_table_fields from './nfl-team-seasonlogs-table-fields'
import player_pfr_season_value_table_fields from './player-pfr-season-value-table-fields'
import pff_team_grades_table_fields from './pff-team-grades-table-fields'
import {
  with_row_grains,
  with_row_grains_by_prefix,
  PLAYER_ROW_GRAINS,
  TEAM_ROW_GRAINS
} from './row-grains'

// Player Column Fields
// header_label - string, required
// column_groups - array, optional

// load - optional

// component - optional
// header_className - optional

// get_player_field_value - optional
// player_value_path - optional

// get_percentile_key - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional

export const get_data_views_fields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([current_season.week])).get(0),
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
    ...with_row_grains(
      fantasy_league_table_fields({ week, is_logged_in }),
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(
      player_pff_seasonlogs_table_fields({ is_logged_in }),
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(player_seasonlogs_table_fields(), PLAYER_ROW_GRAINS),

    ...with_row_grains(projected_table_fields({ week }), PLAYER_ROW_GRAINS),
    ...with_row_grains(
      player_table_fields({ is_logged_in }),
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(team_table_fields, TEAM_ROW_GRAINS),

    ...with_row_grains(scoring_format_logs_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(league_format_logs_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_stats_from_plays_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(betting_market_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(espn_score_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(
      fantasy_points_from_plays_table_fields,
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(team_stats_from_plays_table_fields, TEAM_ROW_GRAINS),
    ...with_row_grains(keeptradecut_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_games_played_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_contract_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_rankings_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_adp_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_dfs_salaries_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(practice_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains_by_prefix(espn_line_win_rates_table_fields),
    ...with_row_grains(game_table_fields, TEAM_ROW_GRAINS),
    ...with_row_grains(player_snaps_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(player_routes_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(team_dvoa_table_fields, TEAM_ROW_GRAINS),
    ...with_row_grains(nfl_team_seasonlogs_table_fields, TEAM_ROW_GRAINS),
    ...with_row_grains(player_pfr_season_value_table_fields, PLAYER_ROW_GRAINS),
    ...with_row_grains(pff_team_grades_table_fields, TEAM_ROW_GRAINS)
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].column_id = key
    // TODO remove - I think this is not used
    fields[key].key_path = value.player_value_path
      ? value.player_value_path.split('.')
      : []
    fields[key].column_name = value.player_value_path
    fields[key].accessorKey = value.player_value_path || key
    fields[key].description = data_view_fields_index[key] || null

    if (value.column_params?.nfl_week_id) {
      fields[key].column_params.nfl_week_id.component =
        ColumnParamNflWeekSelector
    }
    if (value.column_params?.single_nfl_week_id) {
      fields[key].column_params.single_nfl_week_id.component =
        ColumnParamNflWeekSelector
    }
  }

  return fields
}
