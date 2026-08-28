import { List, Map } from 'immutable'
import { createSelector } from 'reselect'

import { data_view_fields_index } from '#libs-shared'
import { current_season } from '#constants'
import ColumnParamNflWeekSelector from '@components/column-param-nfl-week-selector/column-param-nfl-week-selector.js'
import ColumnParamOutput from '@components/column-param-output/column-param-output.js'
import ColumnParamMonthDay from '@components/column-param-month-day/column-param-month-day.js'
import { resolve_column_fixed } from '@core/data-views/resolve-column-formatter.mjs'

import betting_market_table_fields from './betting-market-table-fields.js'
import espn_score_table_fields from './espn-score-table-fields.js'
import fantasy_league_table_fields from './fantasy-league-table-fields.js'
import league_format_logs_table_fields from './league-format-logs-table-fields.js'
import player_table_fields from './player-table-fields.js'
import team_table_fields from './team-table-fields.js'
import projected_table_fields from './projected-table-fields.js'
import scoring_format_logs_table_fields from './scoring-format-logs-table-fields.js'
import player_stats_from_plays_table_fields from './player-stats-from-plays-table-fields.js'
import fantasy_points_from_plays_table_fields from './fantasy-points-from-plays-table-fields.js'
import team_stats_from_plays_table_fields from './team-stats-from-plays-table-fields.js'
import keeptradecut_table_fields from './keeptradecut-table-fields.js'
import player_games_played_table_fields from './player-games-played-table-fields.js'
import player_contract_table_fields from './player-contract-table-fields.js'
import player_pff_seasonlogs_table_fields from './player-pff-seasonlogs-table-fields.js'
import player_pff_facet_seasonlogs_table_fields from './player-pff-facet-seasonlogs-table-fields.js'
import player_seasonlogs_table_fields from './player-seasonlogs-table-fields.js'
import player_rankings_table_fields from './player-rankings-table-fields.js'
import player_adp_table_fields from './player-adp-table-fields.js'
import player_dfs_salaries_table_fields from './player-dfs-salaries-table-fields.js'
import practice_table_fields from './practice-table-fields.js'
import espn_line_win_rates_table_fields from './espn-line-win-rates-table-fields.js'
import game_table_fields from './game-table-fields.js'
import player_snaps_table_fields from './player-snaps-table-fields.js'
import player_routes_table_fields from './player-routes-table-fields.js'
import team_dvoa_table_fields from './team-dvoa-table-fields.js'
import nfl_team_seasonlogs_table_fields from './nfl-team-seasonlogs-table-fields.js'
import player_pfr_season_value_table_fields from './player-pfr-season-value-table-fields.js'
import pff_team_grades_table_fields from './pff-team-grades-table-fields.js'
import {
  with_row_grains,
  with_row_grains_by_prefix,
  PLAYER_ROW_GRAINS,
  TEAM_ROW_GRAINS
} from './row-grains.js'

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

// The fantasy team filter is keyed on team id and labeled with the team's
// current name. Teams land in the store on auth, so an anonymous session gets
// an empty list -- which is fine, since every fantasy league field is hidden
// when logged out.
const get_fantasy_team_column_values = (teams) =>
  teams
    .valueSeq()
    .map((team) => ({
      value: team.get('team_id'),
      label: team.get('name') || team.get('abbreviation')
    }))
    .sortBy((column_value) => column_value.label)
    .toArray()

export const get_data_views_fields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([current_season.week])).get(0),
  (state) => state.getIn(['app', 'userId']),
  (state) => state.getIn(['teams', current_season.year], new Map()),
  (week, userId, teams) =>
    PlayerTableFields({
      week,
      is_logged_in: Boolean(userId),
      fantasy_teams: get_fantasy_team_column_values(teams)
    })
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
// - opponent_receiving_trg
// - opponent_receiving_rec
// - opponent_receiving_recy
// - opponent_receiving_tdrec

export function PlayerTableFields({
  week,
  is_logged_in,
  fantasy_teams
  // seasonlogs,
  // player_positions,
  // nfl_team_schedule
}) {
  const fields = {
    ...with_row_grains(
      fantasy_league_table_fields({ week, is_logged_in, fantasy_teams }),
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(
      player_pff_seasonlogs_table_fields({ is_logged_in }),
      PLAYER_ROW_GRAINS
    ),
    ...with_row_grains(
      player_pff_facet_seasonlogs_table_fields({ is_logged_in }),
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
    if (value.column_params?.as_of_month_day) {
      fields[key].column_params.as_of_month_day.component = ColumnParamMonthDay
    }
    // Decimals on an output-capable column depend on the params of the
    // instance, so `fixed` becomes a resolver closed over whatever the column
    // declared as its no-output default. Applied here rather than at each of
    // the ~50 declaration sites, and safe to assign because `with_row_grains`
    // hands this loop a fresh clone of every field on each call.
    if (value.column_params?.output) {
      fields[key].column_params.output.component = ColumnParamOutput
      fields[key].fixed = resolve_column_fixed({
        default_fixed: value.fixed ?? null
      })
    }
  }

  return fields
}
