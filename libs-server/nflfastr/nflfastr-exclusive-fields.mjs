/**
 * Fields that are exclusively populated by nflfastR and not available
 * from other data sources (Sportradar, FTN Charting, NGS/NFL v1, PlayerProfiler)
 *
 * These fields can be safely overwritten when re-importing nflfastR data
 * without risking data quality from other sources.
 */
export const NFLFASTR_EXCLUSIVE_FIELDS = new Set([
  // Play Description
  'play_description_nflfastr', // nflfastr play description (complete, unlike NGS truncated desc)

  // Play Characteristics
  // Note: 'is_incompletion' is shared with Sportradar - both pipelines report physical outcome
  'is_field_goal_attempt',
  'is_out_of_bounds',
  'drive_yds_penalized',
  'is_punt_attempt',
  'is_qb_scramble', // nflfastR is authoritative - parses "scrambles" from play description; Sportradar over-reports (marks designed runs/sacks as scrambles)

  // Core EPA Metrics
  'expected_points', // Expected Points pre-play
  'epa', // Expected Points Added
  'is_epa_successful', // Expected Points success indicator

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
  'win_probability', // Win probability pre-play
  'win_probability_added', // Win Probability Added
  'home_win_probability', // Home team win probability
  'away_win_probability', // Away team win probability
  'vegas_wpa', // Vegas-adjusted WPA
  'vegas_home_wpa', // Vegas-adjusted WPA for home team
  'home_win_probability_post', // Post-play home win probability
  'away_win_probability_post', // Post-play away win probability
  'vegas_win_probability', // Vegas-adjusted win probability
  'vegas_home_win_probability', // Vegas-adjusted home win probability

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
  'xyac_success_prob', // Expected YAC success probability
  'xyac_first_down_prob', // Expected probability of first down with YAC

  // Scoring Probability Metrics
  'no_score_prob', // Probability of no score on drive
  'opp_fg_prob', // Probability opponent scores field goal
  'opp_safety_prob', // Probability opponent scores safety
  'opp_td_prob', // Probability opponent scores touchdown
  'fg_prob', // Probability of field goal
  'safety_prob', // Probability of safety
  'td_prob', // Probability of touchdown
  'extra_point_prob', // Probability of successful extra point
  'two_conversion_prob', // Probability of successful two-point conversion

  // Play Type Probability Metrics
  'xpass_prob', // Expected pass play probability (pass over run decision value)
  'pass_over_expected', // Pass play over expected

  // Completion Probability Metrics
  'completion_probability', // Completion probability
  'completion_percentage_over_expected', // Completion percentage over expected

  // Series Data
  'series_sequence', // Series sequence number
  'is_series_successful', // Series success indicator
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
