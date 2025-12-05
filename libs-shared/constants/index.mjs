/**
 * Constants Index
 *
 * NOTE: For better tree shaking, import directly from specific constant files:
 *
 *   import { current_season } from './constants/season-constants.mjs'
 *   import { all_fantasy_stats } from './constants/stats-constants.mjs'
 */

// Season constants
export {
  current_season,
  current_week,
  current_year,
  current_fantasy_season_week,
  is_offseason,
  is_regular_season,
  league_default_rfa_announcement_hour,
  league_default_rfa_processing_hour,
  nfl_draft_rounds,
  league_defaults,
  ui_color_palette,
  available_years,
  regular_fantasy_weeks,
  fantasy_weeks,
  nfl_weeks,
  game_days,
  nfl_quarters,
  nfl_downs,
  nfl_season_types
} from './season-constants.mjs'

// Stats constants
export {
  fantasy_positions,
  base_fantasy_stats,
  kicker_fantasy_stats,
  defense_fantasy_stats,
  all_fantasy_stats,
  projected_base_stats,
  all_projected_fantasy_stats,
  create_empty_fantasy_stats,
  create_empty_projected_fantasy_stats,
  fantasy_stat_display_names,
  extended_player_stats,
  stat_qualification_thresholds,
  create_empty_extended_stats,
  nfl_team_stats,
  fantasy_team_stats,
  create_empty_fantasy_team_stats
} from './stats-constants.mjs'

// Player status constants
export {
  player_nfl_status,
  player_nfl_injury_status,
  nfl_player_status_abbreviations,
  nfl_player_status_display_names,
  nfl_player_status_descriptions
} from './player-status-constants.mjs'

// NFL teams constants
export { nfl_team_abbreviations } from './nfl-teams-constants.mjs'

// Colleges constants
export {
  ncaa_college_names,
  ncaa_conference_names
} from './colleges-constants.mjs'

// Roster constants
export {
  roster_slot_types,
  starting_lineup_slots,
  practice_squad_slots,
  practice_squad_protected_slots,
  practice_squad_unprotected_slots,
  practice_squad_signed_slots,
  practice_squad_drafted_slots,
  roster_slot_display_names,
  player_availability_statuses
} from './roster-constants.mjs'

// Transaction constants
export {
  matchup_types,
  waiver_types,
  waiver_type_display_names,
  transaction_types,
  transaction_type_display_names,
  player_tag_types,
  player_tag_display_names
} from './transaction-constants.mjs'

// Source constants
export {
  external_data_sources,
  external_data_source_keys,
  external_data_source_display_names,
  keeptradecut_metric_types,
  default_points_added,
  team_id_regex,
  player_id_regex
} from './source-constants.mjs'

// Error constants
export { roster_validation_errors } from './error-constants.mjs'

// Selection constants (for standard selection ID format)
export {
  selection_values,
  season_type_values,
  day_values,
  valid_selection_types,
  valid_season_types,
  valid_day_values
} from './selection-constants.mjs'
