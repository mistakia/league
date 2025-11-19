/**
 * Fields that are exclusively populated by nflfastR and not available
 * from other data sources (Sportradar, FTN Charting, NGS/NFL v1, PlayerProfiler)
 *
 * These fields can be safely overwritten when re-importing nflfastR data
 * without risking data quality from other sources.
 */
export const NFLFASTR_EXCLUSIVE_FIELDS = new Set([
  // Play Characteristics
  'incomp',
  'fg_att',
  'oob',
  'drive_yds_penalized',
  'punt_att',

  // Core EPA Metrics
  'ep', // Expected Points pre-play
  'epa', // Expected Points Added
  'ep_succ', // Expected Points success indicator

  // EPA Home/Away Team Totals
  'total_home_epa',
  'total_away_epa',
  'total_home_rush_epa',
  'total_away_rush_epa',
  'total_home_pass_epa',
  'total_away_pass_epa',

  // EPA Component Metrics
  'qb_epa', // QB-specific EPA
  'air_epa', // EPA from air yards
  'yac_epa', // EPA from yards after catch
  'comp_air_epa', // EPA on completed air yards
  'comp_yac_epa', // EPA on completed YAC
  'xyac_epa', // Expected YAC EPA

  // EPA Home/Away Team Completion-Based
  'total_home_comp_air_epa',
  'total_away_comp_air_epa',
  'total_home_comp_yac_epa',
  'total_away_comp_yac_epa',
  'total_home_raw_air_epa',
  'total_away_raw_air_epa',
  'total_home_raw_yac_epa',
  'total_away_raw_yac_epa',

  // Core Win Probability Metrics
  'wp', // Win probability pre-play
  'wpa', // Win Probability Added
  'home_wp', // Home team win probability
  'away_wp', // Away team win probability
  'vegas_wpa', // Vegas-adjusted WPA
  'vegas_home_wpa', // Vegas-adjusted WPA for home team
  'home_wp_post', // Post-play home win probability
  'away_wp_post', // Post-play away win probability
  'vegas_wp', // Vegas-adjusted win probability
  'vegas_home_wp', // Vegas-adjusted home win probability

  // WPA Component Metrics
  'air_wpa', // WPA from air yards
  'yac_wpa', // WPA from yards after catch
  'comp_air_wpa', // WPA on completed air yards
  'comp_yac_wpa', // WPA on completed YAC

  // WPA Home/Away Team Totals
  'total_home_rush_wpa',
  'total_away_rush_wpa',
  'total_home_pass_wpa',
  'total_away_pass_wpa',

  // WPA Home/Away Team Completion-Based
  'total_home_comp_air_wpa',
  'total_away_comp_air_wpa',
  'total_home_comp_yac_wpa',
  'total_away_comp_yac_wpa',
  'total_home_raw_air_wpa',
  'total_away_raw_air_wpa',
  'total_home_raw_yac_wpa',
  'total_away_raw_yac_wpa',

  // Expected Yardage (XYAC) Metrics
  'xyac_mean_yds', // Expected mean yards after catch
  'xyac_median_yds', // Expected median yards after catch
  'xyac_succ_prob', // Expected YAC success probability
  'xyac_fd_prob', // Expected probability of first down with YAC

  // Scoring Probability Metrics
  'no_score_prob', // Probability of no score on drive
  'opp_fg_prob', // Probability opponent scores field goal
  'opp_safety_prob', // Probability opponent scores safety
  'opp_td_prob', // Probability opponent scores touchdown
  'fg_prob', // Probability of field goal
  'safety_prob', // Probability of safety
  'td_prob', // Probability of touchdown
  'extra_point_prob', // Probability of successful extra point
  'two_conv_prob', // Probability of successful two-point conversion

  // Play Type Probability Metrics
  'xpass_prob', // Expected pass play probability (pass over run decision value)
  'pass_oe', // Pass play over expected

  // Completion Probability Metrics
  'cp', // Completion probability
  'cpoe', // Completion percentage over expected

  // Series Data
  'series_seq', // Series sequence number
  'series_suc', // Series success indicator
  'series_result' // How series ended (FIELD_GOAL, TOUCHDOWN, TURNOVER, etc.)
])

/**
 * Check if a field is exclusively populated by nflfastR
 * @param {string} field_name - Field name to check
 * @returns {boolean} True if field is nflfastR-exclusive
 */
export const is_nflfastr_exclusive_field = (field_name) => {
  return NFLFASTR_EXCLUSIVE_FIELDS.has(field_name)
}
