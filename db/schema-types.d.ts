// GENERATED FILE -- do not edit.
//
// Source: db/schema.postgres.sql
// Regenerate: node db/tools/generate-schema-types.mjs
// Currency gate: yarn check:types (runs this generator with --check)
//
// One row type per table, for the incremental `//@ts-check` tier. A checked
// producer annotates its return as a row type (or a Pick of one) and every
// consumer destructure is then resolved against the real schema.
//
// A NULLABLE column is typed `| null`. That is deliberate even though the
// config runs with strictNullChecks off today: the information is recorded
// now so turning the flag on later is a config change rather than a
// regeneration of every annotation.

export type AdpSourceId = 'SLEEPER' | 'ESPN' | 'YAHOO' | 'MFL' | 'NFL' | 'CBS' | 'UNDERDOG' | 'DRAFTKINGS' | 'RTS'
export type CoverageType = 'COVER_0' | 'COVER_1' | 'COVER_2' | 'COVER_2_MAN' | 'COVER_3' | 'COVER_4' | 'COVER_5' | 'COVER_6' | 'COVER_9' | 'COMBINATION'
export type DfsSourceId = 'DRAFTKINGS' | 'FANDUEL'
export type DraftRankingType = 'BIG_BOARD' | 'MOCK_DRAFT'
export type EspnWinRateType = 'PASS_RUSH' | 'PASS_BLOCK' | 'RUN_STOP' | 'RUN_BLOCK'
export type GameResult = 'WIN' | 'LOSS' | 'TIE'
export type HashPosition = 'LEFT' | 'MIDDLE' | 'RIGHT'
export type MarketSourceId = 'BETONLINE' | 'BETMGM' | 'BETRIVERS' | 'BOVADA' | 'CAESARS' | 'DRAFTKINGS' | 'FANDUEL' | 'GAMBET' | 'PRIZEPICKS' | 'PINNACLE' | 'FANATICS'
export type MockDraftSourceId = 'NFLMOCKDRAFTDATABASE_CONSENSUS' | '33RD_TEAM' | 'BLEACHER_REPORT' | 'NFL_DRAFT_BUZZ' | 'CBS' | 'DRAFTTEK' | 'ESPN' | 'PFF' | 'TANKATHON' | 'USA' | 'WALTER_FOOTBALL' | 'GRINDINGTHEMOCKS' | 'FOX' | 'THE_DRAFT_NETWORK' | 'NBC_ROTOWORLD' | 'NFL' | 'PRO_FOOTBALL_FOCUS' | 'PRO_FOOTBALL_NETWORK' | 'THE_RINGER' | 'SB_NATION' | 'SPORTS_ILLUSTRATED' | 'SPORTS_INFO_SOLUTIONS' | 'USA_DRAFT_WIRE' | 'YAHOO'
export type MotionType = 'BEFORE_SNAP' | 'DURING_SNAP'
export type NflFgResultDetail = 'blocked' | 'hit_crossbar' | 'hit_left_upright' | 'hit_right_upright' | 'short' | 'wide_left' | 'wide_right'
export type NflGamesRoof = 'dome' | 'outdoors' | 'closed' | 'open'
export type NflGamesSurf = 'grass' | 'astroturf' | 'fieldturf' | 'dessograss' | 'astroplay' | 'matrixturf' | 'sportturf' | 'a_turf'
export type NflIncompletePassType = 'thrown_away' | 'defended' | 'dropped' | 'spike' | 'poorly_thrown'
export type NflKickResult = 'made' | 'missed' | 'blocked' | 'aborted'
export type NflPassRoute = 'GO' | 'SLANT' | 'CURL' | 'OUT' | 'IN' | 'CROSS' | 'POST' | 'FLAT' | 'COMEBACK' | 'SCREEN' | 'CORNER' | 'DIG' | 'HITCH' | 'SEAM' | 'WHEEL' | 'ANGLE' | 'OTHER'
export type NflPlayType = 'CONV' | 'FGXP' | 'KOFF' | 'NOPL' | 'PASS' | 'PUNT' | 'RUSH' | 'FREE'
export type NflPocketLocation = 'middle' | 'scramble_left' | 'scramble_right' | 'rollout_left' | 'rollout_right' | 'boot_left' | 'boot_right'
export type NflScoreType = 'TD' | 'FG' | 'PAT' | 'PAT2' | 'SFTY'
export type NflTwoPointResult = 'success' | 'failure'
export type PlacedWagersBookId = 'DRAFTKINGS' | 'FANDUEL' | 'FANATICS'
export type PlacedWagersWagerType = 'SINGLE' | 'PARLAY' | 'ROUND_ROBIN'
export type PlayDirection = 'LEFT' | 'MIDDLE' | 'RIGHT'
export type QbPosition = 'UNDER_CENTER' | 'SHOTGUN' | 'PISTOL'
export type RankingType = 'STANDARD_REDRAFT' | 'PPR_REDRAFT' | 'STANDARD_SUPERFLEX_REDRAFT' | 'PPR_SUPERFLEX_REDRAFT' | 'STANDARD_DYNASTY' | 'PPR_DYNASTY' | 'STANDARD_SUPERFLEX_DYNASTY' | 'PPR_SUPERFLEX_DYNASTY' | 'STANDARD_ROOKIE' | 'PPR_ROOKIE' | 'STANDARD_SUPERFLEX_ROOKIE' | 'PPR_SUPERFLEX_ROOKIE' | 'HALF_PPR_REDRAFT' | 'HALF_PPR_SUPERFLEX_REDRAFT' | 'HALF_PPR_DYNASTY' | 'HALF_PPR_SUPERFLEX_DYNASTY' | 'HALF_PPR_ROOKIE' | 'HALF_PPR_SUPERFLEX_ROOKIE'
export type RankingsSourceId = 'FANTASYPROS' | 'SLEEPER' | 'ESPN' | 'RTS' | 'MFL' | 'YAHOO' | 'NFL' | 'CBS' | 'UNDERDOG'
export type ReadThrownType = 'FIRST' | 'SECOND' | 'DESIGNED' | 'CHECKDOWN' | 'SCRAMBLE_DRILL'
export type ReceiverSeparation = 'OPEN' | 'TIGHT_COVERAGE' | 'ONE_STEP_OPEN' | 'WIDE_OPEN' | 'CLOSING_COVERAGE'
export type RunGap = 'LEFT_END' | 'LEFT_TACKLE' | 'LEFT_GUARD' | 'LEFT_MIDDLE' | 'RIGHT_GUARD' | 'RIGHT_TACKLE' | 'RIGHT_END' | 'RIGHT_MIDDLE' | 'MIDDLE'
export type SeasonType = 'PRE' | 'REG' | 'POST'
export type SelectionType = 'OVER' | 'UNDER' | 'YES' | 'NO'
export type SeriesResult = 'END_OF_HALF' | 'FIELD_GOAL' | 'FIRST_DOWN' | 'MISSED_FIELD_GOAL' | 'OPP_TOUCHDOWN' | 'PUNT' | 'QB_KNEEL' | 'SAFETY' | 'TOUCHDOWN' | 'TURNOVER' | 'TURNOVER_ON_DOWNS'
export type TeamUnit = 'OFFENSE' | 'DEFENSE' | 'SPECIAL_TEAMS'
export type TimeType = 'OPEN' | 'CLOSE'
export type WagerStatus = 'OPEN' | 'WON' | 'LOST' | 'PUSH' | 'CANCELLED' | 'CASHED_OUT'

export interface AdmissionVoteBallotPreferencesRow {
  admission_vote_id: number
  team_id: number
  admission_vote_candidate_id: number
  preference_rank: number
}

export interface AdmissionVoteBallotsRow {
  admission_vote_id: number
  team_id: number
  submitted_at: Date
  commissioner_entered_reason: string | null
}

export interface AdmissionVoteCandidateSponsorsRow {
  admission_vote_candidate_id: number
  team_id: number
}

export interface AdmissionVoteCandidatesRow {
  admission_vote_candidate_id: number
  admission_vote_id: number
  candidate_name: string
  submission_id: number | null
  points_total: number | null
}

export interface AdmissionVoteEligibleTeamsRow {
  admission_vote_id: number
  team_id: number
  recorded_at: Date
  recorded_reason: string | null
}

export interface AdmissionVotesRow {
  admission_vote_id: number
  league_id: number
  season_year: number
  opened_at: Date
  closes_at: Date
  closed_at: Date | null
  maximum_ranked_candidates: number
  vote_status: string
  decision_due_at: Date | null
  decision_outcome: string | null
  decided_admission_vote_candidate_id: number | null
  decided_at: Date | null
  decision_reason: string | null
}

export interface AdpFormatRow {
  id: string
  scoring_class: string | null
  scoring_format_id: string | null
  number_quarterback: number
  number_teams: number | null
  duration: string | null
  draft_pool: string
  contest_style: string
}

export interface AuctionBlockOptInsRow {
  opt_in_id: number
  lid: number
  season_year: number
  block_at: Date
  tid: number
  user_id: number
  opted_in_at: Date
  withdrawn_at: Date | null
}

export interface AuctionBlocksRow {
  block_id: number
  lid: number
  season_year: number
  block_at: Date
  end_at: Date
  finalized_at: Date
  eligible_team_count: number
}

export interface AuctionElectionsRow {
  election_id: number
  lid: number
  season_year: number
  pid: string
  tid: number
  user_id: number
  maximum_bid: number | null
  submitted_at: Date
  amount_set_at: Date
  withdrawn_at: Date | null
  settled_at: Date | null
  outcome: string | null
  outcome_detail: string | null
}

export interface BidChangelogRow {
  change_id: number
  bid_type: string
  bid_id: number
  league_id: number
  team_id: number
  player_id: string | null
  season_year: number | null
  change_type: string
  change_source: string
  changed_by_user_id: number | null
  changed_at: Date
  bid_amount: number | null
  bid_user_id: number | null
  cancelled_at: Date | null
  processed_at: Date | null
  is_successful: boolean | null
  outcome: string | null
  outcome_detail: string | null
  conditional_release_player_ids: string[] | null
}

export interface CompositeMarketValueBlendWeightsRow {
  version_id: number
  format_category: number | null
  effective_from: Date
  ktc_weight: number
  average_draft_position_weight: number
  rankings_weight: number
  props_weight: number
  draft_pick_model_weight: number
  notes: string | null
}

export interface CompositeMarketValueCalibrationRow {
  source: number
  format_category: number
  date: Date
  scale_factor: number
  intercept: number
  overlap_sample_size: number
  r_squared: number | null
  fallback_reason: string | null
}

export interface CompositeMarketValueDailyRow {
  composite_market_value_row_id: number
  format_category: number
  asset_type: number
  player_id: string | null
  pick_year: number | null
  pick_round: number | null
  pick_original_owner_tid: number | null
  date: Date
  ktc_value: number | null
  average_draft_position_value: number | null
  rankings_value: number | null
  props_value: number | null
  draft_pick_model_value: number | null
  composite_value: number
  composite_coverage_score: number
  blend_weights_version_id: number
}

export interface ConfigRow {
  key: string
  config_value: any | null
  updated_at: Date | null
}

export interface ContributionAnswersRow {
  answer_id: string
  question_id: string
  answer_body: string
  answered_at: Date
}

export interface ContributionEventsRow {
  event_id: string
  submission_id: string
  contribution_event_type: string
  previous_submission_status: string | null
  new_submission_status: string | null
  event_context: any | null
  occurred_at: Date
}

export interface ContributionQuestionsRow {
  question_id: string
  submission_id: string
  question_template_key: string
  question_text: string
  asked_at: Date
  expires_at: Date
}

export interface ContributionScreenshotsRow {
  submission_id: string
  image_data: Buffer
  image_format: string
  image_size: number
  captured_at: Date
}

export interface ContributionSubmissionsRow {
  submission_id: string
  submitter_user_id: number | null
  submission_kind: string
  submission_trust_tier: string
  submission_title: string
  submission_body: string
  captured_context: any | null
  screenshot_reference: string | null
  claim_token_hash: string | null
  submission_status: string
  autonomy_class: string | null
  base_task_uri: string | null
  pull_request_number: number | null
  submitted_at: Date
  updated_at: Date
  purged_at: Date | null
}

export interface ContributionTrustOverridesRow {
  submitter_user_id: number
  submission_trust_tier: string
  override_reason: string
  created_at: Date
}

export interface DataViewGenerationJobsRow {
  generation_id: string
  principal_key: string
  user_id: number | null
  instruction: string
  input_table_state: any | null
  status: string
  thread_id: string | null
  queued_at: Date
  dispatched_at: Date | null
  started_at: Date | null
  completed_at: Date | null
  deadline_at: Date
  result: any | null
  error_code: string | null
  error_message: string | null
  generation_branch: string | null
  tool_call_count: number | null
  total_tokens: number | null
  duration_milliseconds: number | null
  inference_provider: string | null
  session_termination_requested_at: Date | null
}

export interface DataViewQueriesRow {
  query_id: string
  sql_text: string
  column_annotations: any
  created_at: Date
}

export interface DataViewSqlAuditRow {
  audit_id: number
  created_at: Date
  user_id: number | null
  outcome: string
  outcome_detail: string | null
  statement_text: string
  result_row_count: number | null
  duration_milliseconds: number | null
}

export interface DfsContestsRow {
  source_contest_id: string
  source_id: DfsSourceId
  source_draft_group_id: string | null
  contest_name: string | null
  entry_fee: number | null
  entry_count: number | null
  max_entries: number | null
  game_type: string | null
  sport: string | null
  season_year: number | null
  week: number | null
  start_date: Date | null
  is_guaranteed: boolean | null
  is_ownership_imported: boolean | null
  ownership_imported_at: Date | null
  ownership_entry_sample_size: number | null
  created_at: Date | null
}

export interface DraftRow {
  draft_pick_id: number
  pid: string | null
  round: number
  is_compensatory: boolean
  pick: number | null
  pick_string: string | null
  tid: number
  original_team_id: number
  lid: number
  season_year: number | null
  selection_timestamp: Date | null
  expired_at: Date | null
}

export interface DraftkingsCategoryActivityRow {
  category_id: number
  subcategory_id: number
  category_name: string | null
  subcategory_name: string | null
  last_seen_with_offers: Date | null
  last_checked: Date | null
  total_checks: number | null
  total_offers_found: number | null
}

export interface DvoaTeamDriveSeasonlogsRow {
  season_year: number
  week: number
  nfl_team: string
  team_unit: TeamUnit
  observed_at: Date
  drives: number | null
  yards_per_drive: number | null
  points_per_drive: number | null
  touchdowns_per_drive: number | null
  field_goals_per_drive: number | null
  punts_per_drive: number | null
  turnovers_per_drive: number | null
  interceptions_per_drive: number | null
  fumbles_per_drive: number | null
  line_of_scrimmage_per_drive: number | null
  stops_per_drive: number | null
  three_and_outs_per_drive: number | null
  plays_per_drive: number | null
  scores_per_drive: number | null
  time_of_possession_per_drive_seconds: number | null
  drive_success_rate: number | null
  touchdown_to_field_goal_ratio: number | null
  line_of_scrimmage_after_kickoff_return: number | null
  points_per_red_zone_trip: number | null
  touchdowns_per_red_zone_trip: number | null
  predicted_points: number | null
  predicted_points_per_drive: number | null
  average_lead: number | null
}

export interface DvoaTeamGamelogsRow {
  season_year: number
  week: number
  nfl_team: string
  total_dvoa: number | null
  offense_dvoa: number | null
  defense_dvoa: number | null
  special_teams_dvoa: number | null
  observed_at: Date
  pass_offense_dvoa: number | null
  pass_defense_dvoa: number | null
  rush_offense_dvoa: number | null
  rush_defense_dvoa: number | null
}

export interface DvoaTeamSeasonlogsHistoryRow {
  season_year: number
  week: number
  nfl_team: string
  total_dvoa_rank: number | null
  total_dvoa: number | null
  last_week_dvoa: number | null
  non_adjusted_total_voa: number | null
  offense_dvoa: number | null
  defense_dvoa: number | null
  special_teams_dvoa: number | null
  offense_voa_unadjusted: number | null
  defense_voa_unadjusted: number | null
  special_voa_unadjusted: number | null
  estimated_wins: number | null
  estimated_wins_rank: number | null
  total_weighted_dvoa: number | null
  total_weighted_dvoa_rank: number | null
  past_schedule: number | null
  past_schedule_rank: number | null
  future_schedule: number | null
  future_schedule_rank: number | null
  total_variance: number | null
  total_variance_rank: number | null
  observed_at: Date
  offense_weighted_dvoa: number | null
  offense_weighted_dvoa_rank: number | null
  pass_offense_dvoa: number | null
  rush_offense_dvoa: number | null
  non_adjusted_total_offense: number | null
  non_adjusted_pass_offense: number | null
  non_adjusted_rush_offense: number | null
  offense_variance: number | null
  offense_variance_rank: number | null
  offense_schedule: number | null
  offense_schedule_rank: number | null
  defense_dvoa_rank: number | null
  last_week_defense_dvoa: number | null
  defense_weighted_dvoa: number | null
  defense_weighted_dvoa_rank: number | null
  pass_defense_dvoa: number | null
  rush_defense_dvoa: number | null
  non_adjusted_total_defense: number | null
  non_adjusted_pass_defense: number | null
  non_adjusted_rush_defense: number | null
  defense_variance: number | null
  defense_variance_rank: number | null
  defense_schedule: number | null
  defense_schedule_rank: number | null
  special_teams_dvoa_rank: number | null
  last_week_special_teams_dvoa: number | null
  special_teams_weighted_dvoa: number | null
  special_teams_weighted_dvoa_rank: number | null
  field_goal_extra_point_dvoa: number | null
  kick_dvoa: number | null
  kick_return_dvoa: number | null
  punt_dvoa: number | null
  punt_return_dvoa: number | null
  no_weather_dvoa: number | null
  variance: number | null
  variance_rank: number | null
  hidden_points: number | null
  hidden_points_rank: number | null
  weather_points: number | null
  weather_points_rank: number | null
  last_week_offense_dvoa: number | null
  pass_defense_dvoa_rank: number | null
  rush_defense_dvoa_rank: number | null
  offense_dvoa_rank: number | null
  pass_offense_dvoa_rank: number | null
  rush_offense_dvoa_rank: number | null
}

export interface DvoaTeamSeasonlogsIndexRow {
  season_year: number
  week: number
  nfl_team: string
  total_dvoa_rank: number | null
  total_dvoa: number | null
  last_week_dvoa: number | null
  non_adjusted_total_voa: number | null
  offense_dvoa: number | null
  defense_dvoa: number | null
  special_teams_dvoa: number | null
  offense_voa_unadjusted: number | null
  defense_voa_unadjusted: number | null
  special_voa_unadjusted: number | null
  estimated_wins: number | null
  estimated_wins_rank: number | null
  total_weighted_dvoa: number | null
  total_weighted_dvoa_rank: number | null
  past_schedule: number | null
  past_schedule_rank: number | null
  future_schedule: number | null
  future_schedule_rank: number | null
  total_variance: number | null
  total_variance_rank: number | null
  offense_weighted_dvoa: number | null
  offense_weighted_dvoa_rank: number | null
  pass_offense_dvoa: number | null
  rush_offense_dvoa: number | null
  non_adjusted_total_offense: number | null
  non_adjusted_pass_offense: number | null
  non_adjusted_rush_offense: number | null
  offense_variance: number | null
  offense_variance_rank: number | null
  offense_schedule: number | null
  offense_schedule_rank: number | null
  defense_dvoa_rank: number | null
  last_week_defense_dvoa: number | null
  defense_weighted_dvoa: number | null
  defense_weighted_dvoa_rank: number | null
  pass_defense_dvoa: number | null
  rush_defense_dvoa: number | null
  non_adjusted_total_defense: number | null
  non_adjusted_pass_defense: number | null
  non_adjusted_rush_defense: number | null
  defense_variance: number | null
  defense_variance_rank: number | null
  defense_schedule: number | null
  defense_schedule_rank: number | null
  special_teams_dvoa_rank: number | null
  last_week_special_teams_dvoa: number | null
  special_teams_weighted_dvoa: number | null
  special_teams_weighted_dvoa_rank: number | null
  field_goal_extra_point_dvoa: number | null
  kick_dvoa: number | null
  kick_return_dvoa: number | null
  punt_dvoa: number | null
  punt_return_dvoa: number | null
  no_weather_dvoa: number | null
  variance: number | null
  variance_rank: number | null
  hidden_points: number | null
  hidden_points_rank: number | null
  weather_points: number | null
  weather_points_rank: number | null
  observed_at: Date
  last_week_offense_dvoa: number | null
  pass_defense_dvoa_rank: number | null
  rush_defense_dvoa_rank: number | null
  offense_dvoa_rank: number | null
  pass_offense_dvoa_rank: number | null
  rush_offense_dvoa_rank: number | null
}

export interface DvoaTeamUnitSeasonlogsHistoryRow {
  season_year: number
  week: number
  nfl_team: string
  team_unit: TeamUnit
  observed_at: Date
  total_dvoa_rank: number | null
  total_dvoa: number | null
  pass_dvoa_rank: number | null
  pass_wide_receiver_1_dvoa: number | null
  pass_wide_receiver_1_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_1: number | null
  pass_yards_allowed_per_game_wide_receiver_1: number | null
  pass_wide_receiver_2_dvoa: number | null
  pass_wide_receiver_2_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_2: number | null
  pass_yards_allowed_per_game_wide_receiver_2: number | null
  pass_wide_receiver_3_dvoa: number | null
  pass_wide_receiver_3_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_3: number | null
  pass_yards_allowed_per_game_wide_receiver_3: number | null
  pass_tight_end_dvoa: number | null
  pass_tight_end_dvoa_rank: number | null
  pass_points_allowed_per_game_tight_end: number | null
  pass_yards_allowed_per_game_tight_end: number | null
  pass_running_back_dvoa: number | null
  pass_running_back_dvoa_rank: number | null
  pass_points_allowed_per_game_running_back: number | null
  pass_yards_allowed_per_game_running_back: number | null
  pass_left_dvoa: number | null
  pass_left_dvoa_rank: number | null
  pass_middle_dvoa: number | null
  pass_middle_dvoa_rank: number | null
  pass_right_dvoa: number | null
  pass_right_dvoa_rank: number | null
  pass_deep_dvoa: number | null
  pass_deep_dvoa_rank: number | null
  pass_short_dvoa: number | null
  pass_short_dvoa_rank: number | null
  pass_deep_left_dvoa: number | null
  pass_deep_middle_dvoa: number | null
  pass_deep_right_dvoa: number | null
  pass_short_left_dvoa: number | null
  pass_short_middle_dvoa: number | null
  pass_short_right_dvoa: number | null
  team_adjusted_line_yards: number | null
  team_adjusted_line_yards_rank: number | null
  team_running_back_yards: number | null
  team_running_back_yards_rank: number | null
  team_power_success: number | null
  team_power_success_rank: number | null
  team_stuffed_rate: number | null
  team_stuffed_rate_rank: number | null
  team_second_level_yards: number | null
  team_second_level_yards_rank: number | null
  team_open_field_yards: number | null
  team_open_field_yards_rank: number | null
  team_sacks: number | null
  team_sacks_rank: number | null
  team_adjusted_sack_rate: number | null
  home_dvoa: number | null
  home_dvoa_rank: number | null
  road_dvoa: number | null
  road_dvoa_rank: number | null
  all_first_down_dvoa: number | null
  all_first_down_dvoa_rank: number | null
  second_and_short_dvoa: number | null
  second_and_short_dvoa_rank: number | null
  second_and_medium_dvoa: number | null
  second_and_medium_dvoa_rank: number | null
  second_and_long_dvoa: number | null
  second_and_long_dvoa_rank: number | null
  all_second_down_dvoa: number | null
  all_second_down_dvoa_rank: number | null
  third_and_short_dvoa: number | null
  third_and_short_dvoa_rank: number | null
  third_and_medium_dvoa: number | null
  third_and_medium_dvoa_rank: number | null
  third_and_long_dvoa: number | null
  third_and_long_dvoa_rank: number | null
  all_third_down_dvoa: number | null
  all_third_down_dvoa_rank: number | null
  all_plays_dvoa: number | null
  all_plays_dvoa_rank: number | null
  back_zone_dvoa: number | null
  back_zone_dvoa_rank: number | null
  deep_zone_dvoa: number | null
  deep_zone_dvoa_rank: number | null
  front_zone_dvoa: number | null
  front_zone_dvoa_rank: number | null
  mid_zone_dvoa: number | null
  mid_zone_dvoa_rank: number | null
  red_zone_dvoa: number | null
  red_zone_dvoa_rank: number | null
  red_zone_pass_dvoa: number | null
  red_zone_pass_dvoa_rank: number | null
  red_zone_rush_dvoa: number | null
  red_zone_rush_dvoa_rank: number | null
  goal_to_go_dvoa: number | null
  goal_to_go_dvoa_rank: number | null
  losing_9_plus_dvoa: number | null
  losing_9_plus_dvoa_rank: number | null
  tie_or_losing_1_to_8_dvoa: number | null
  tie_or_losing_1_to_8_dvoa_rank: number | null
  winning_1_to_8_dvoa: number | null
  winning_1_to_8_dvoa_rank: number | null
  winning_9_plus_dvoa: number | null
  winning_9_plus_dvoa_rank: number | null
  late_and_close_dvoa: number | null
  late_and_close_dvoa_rank: number | null
  first_quarter_dvoa: number | null
  first_quarter_dvoa_rank: number | null
  second_quarter_dvoa: number | null
  second_quarter_dvoa_rank: number | null
  third_quarter_dvoa: number | null
  third_quarter_dvoa_rank: number | null
  fourth_quarter_overtime_dvoa: number | null
  fourth_quarter_overtime_dvoa_rank: number | null
  first_half_dvoa: number | null
  first_half_dvoa_rank: number | null
  second_half_dvoa: number | null
  second_half_dvoa_rank: number | null
  shotgun_dvoa: number | null
  shotgun_dvoa_rank: number | null
  shotgun_yards: number | null
  shotgun_yards_rank: number | null
  not_shotgun_dvoa: number | null
  not_shotgun_dvoa_rank: number | null
  not_shotgun_yards: number | null
  not_shotgun_yards_rank: number | null
  shotgun_difference_dvoa: number | null
  shotgun_difference_dvoa_rank: number | null
  shotgun_yards_difference: number | null
  shotgun_yards_difference_rank: number | null
  shotgun_percentage: number | null
  shotgun_percentage_rank: number | null
  first_down_pass_dvoa: number | null
  first_down_pass_dvoa_rank: number | null
  first_down_rush_dvoa: number | null
  first_down_rush_dvoa_rank: number | null
  first_down_all_dvoa: number | null
  first_down_all_dvoa_rank: number | null
  second_down_pass_dvoa: number | null
  second_down_pass_dvoa_rank: number | null
  second_down_rush_dvoa: number | null
  second_down_rush_dvoa_rank: number | null
  second_down_all_dvoa: number | null
  second_down_all_dvoa_rank: number | null
  third_fourth_down_pass_dvoa: number | null
  third_fourth_down_pass_dvoa_rank: number | null
  third_fourth_down_rush_dvoa: number | null
  third_fourth_down_rush_dvoa_rank: number | null
  third_fourth_down_all_dvoa: number | null
  third_fourth_down_all_dvoa_rank: number | null
  all_downs_pass_dvoa: number | null
  all_downs_pass_dvoa_rank: number | null
  all_downs_rush_dvoa: number | null
  all_downs_rush_dvoa_rank: number | null
  all_downs_dvoa: number | null
  all_downs_dvoa_rank: number | null
  team_rush_left_end_yards: number | null
  team_rush_left_end_yards_rank: number | null
  team_rush_left_tackle_yards: number | null
  team_rush_left_tackle_yards_rank: number | null
  team_rush_middle_guard_yards: number | null
  team_rush_middle_guard_yards_rank: number | null
  team_rush_right_tackle_yards: number | null
  team_rush_right_tackle_yards_rank: number | null
  team_rush_right_end_yards: number | null
  team_rush_right_end_yards_rank: number | null
  team_running_back_carries: number | null
  team_running_back_carries_rank: number | null
  team_rush_left_end_percentage: number | null
  team_rush_left_tackle_percentage: number | null
  team_rush_middle_guard_percentage: number | null
  team_rush_right_tackle_percentage: number | null
  team_rush_right_end_percentage: number | null
  pass_dvoa: number | null
  rush_dvoa: number | null
  rush_dvoa_rank: number | null
  total_dave: number | null
}

export interface DvoaTeamUnitSeasonlogsIndexRow {
  season_year: number
  week: number
  nfl_team: string
  team_unit: TeamUnit
  observed_at: Date
  total_dvoa_rank: number | null
  total_dvoa: number | null
  pass_dvoa_rank: number | null
  pass_wide_receiver_1_dvoa: number | null
  pass_wide_receiver_1_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_1: number | null
  pass_yards_allowed_per_game_wide_receiver_1: number | null
  pass_wide_receiver_2_dvoa: number | null
  pass_wide_receiver_2_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_2: number | null
  pass_yards_allowed_per_game_wide_receiver_2: number | null
  pass_wide_receiver_3_dvoa: number | null
  pass_wide_receiver_3_dvoa_rank: number | null
  pass_points_allowed_per_game_wide_receiver_3: number | null
  pass_yards_allowed_per_game_wide_receiver_3: number | null
  pass_tight_end_dvoa: number | null
  pass_tight_end_dvoa_rank: number | null
  pass_points_allowed_per_game_tight_end: number | null
  pass_yards_allowed_per_game_tight_end: number | null
  pass_running_back_dvoa: number | null
  pass_running_back_dvoa_rank: number | null
  pass_points_allowed_per_game_running_back: number | null
  pass_yards_allowed_per_game_running_back: number | null
  pass_left_dvoa: number | null
  pass_left_dvoa_rank: number | null
  pass_middle_dvoa: number | null
  pass_middle_dvoa_rank: number | null
  pass_right_dvoa: number | null
  pass_right_dvoa_rank: number | null
  pass_deep_dvoa: number | null
  pass_deep_dvoa_rank: number | null
  pass_short_dvoa: number | null
  pass_short_dvoa_rank: number | null
  pass_deep_left_dvoa: number | null
  pass_deep_middle_dvoa: number | null
  pass_deep_right_dvoa: number | null
  pass_short_left_dvoa: number | null
  pass_short_middle_dvoa: number | null
  pass_short_right_dvoa: number | null
  team_adjusted_line_yards: number | null
  team_adjusted_line_yards_rank: number | null
  team_running_back_yards: number | null
  team_running_back_yards_rank: number | null
  team_power_success: number | null
  team_power_success_rank: number | null
  team_stuffed_rate: number | null
  team_stuffed_rate_rank: number | null
  team_second_level_yards: number | null
  team_second_level_yards_rank: number | null
  team_open_field_yards: number | null
  team_open_field_yards_rank: number | null
  team_sacks: number | null
  team_sacks_rank: number | null
  team_adjusted_sack_rate: number | null
  home_dvoa: number | null
  home_dvoa_rank: number | null
  road_dvoa: number | null
  road_dvoa_rank: number | null
  all_first_down_dvoa: number | null
  all_first_down_dvoa_rank: number | null
  second_and_short_dvoa: number | null
  second_and_short_dvoa_rank: number | null
  second_and_medium_dvoa: number | null
  second_and_medium_dvoa_rank: number | null
  second_and_long_dvoa: number | null
  second_and_long_dvoa_rank: number | null
  all_second_down_dvoa: number | null
  all_second_down_dvoa_rank: number | null
  third_and_short_dvoa: number | null
  third_and_short_dvoa_rank: number | null
  third_and_medium_dvoa: number | null
  third_and_medium_dvoa_rank: number | null
  third_and_long_dvoa: number | null
  third_and_long_dvoa_rank: number | null
  all_third_down_dvoa: number | null
  all_third_down_dvoa_rank: number | null
  all_plays_dvoa: number | null
  all_plays_dvoa_rank: number | null
  back_zone_dvoa: number | null
  back_zone_dvoa_rank: number | null
  deep_zone_dvoa: number | null
  deep_zone_dvoa_rank: number | null
  front_zone_dvoa: number | null
  front_zone_dvoa_rank: number | null
  mid_zone_dvoa: number | null
  mid_zone_dvoa_rank: number | null
  red_zone_dvoa: number | null
  red_zone_dvoa_rank: number | null
  red_zone_pass_dvoa: number | null
  red_zone_pass_dvoa_rank: number | null
  red_zone_rush_dvoa: number | null
  red_zone_rush_dvoa_rank: number | null
  goal_to_go_dvoa: number | null
  goal_to_go_dvoa_rank: number | null
  losing_9_plus_dvoa: number | null
  losing_9_plus_dvoa_rank: number | null
  tie_or_losing_1_to_8_dvoa: number | null
  tie_or_losing_1_to_8_dvoa_rank: number | null
  winning_1_to_8_dvoa: number | null
  winning_1_to_8_dvoa_rank: number | null
  winning_9_plus_dvoa: number | null
  winning_9_plus_dvoa_rank: number | null
  late_and_close_dvoa: number | null
  late_and_close_dvoa_rank: number | null
  first_quarter_dvoa: number | null
  first_quarter_dvoa_rank: number | null
  second_quarter_dvoa: number | null
  second_quarter_dvoa_rank: number | null
  third_quarter_dvoa: number | null
  third_quarter_dvoa_rank: number | null
  fourth_quarter_overtime_dvoa: number | null
  fourth_quarter_overtime_dvoa_rank: number | null
  first_half_dvoa: number | null
  first_half_dvoa_rank: number | null
  second_half_dvoa: number | null
  second_half_dvoa_rank: number | null
  shotgun_dvoa: number | null
  shotgun_dvoa_rank: number | null
  shotgun_yards: number | null
  shotgun_yards_rank: number | null
  not_shotgun_dvoa: number | null
  not_shotgun_dvoa_rank: number | null
  not_shotgun_yards: number | null
  not_shotgun_yards_rank: number | null
  shotgun_difference_dvoa: number | null
  shotgun_difference_dvoa_rank: number | null
  shotgun_yards_difference: number | null
  shotgun_yards_difference_rank: number | null
  shotgun_percentage: number | null
  shotgun_percentage_rank: number | null
  first_down_pass_dvoa: number | null
  first_down_pass_dvoa_rank: number | null
  first_down_rush_dvoa: number | null
  first_down_rush_dvoa_rank: number | null
  first_down_all_dvoa: number | null
  first_down_all_dvoa_rank: number | null
  second_down_pass_dvoa: number | null
  second_down_pass_dvoa_rank: number | null
  second_down_rush_dvoa: number | null
  second_down_rush_dvoa_rank: number | null
  second_down_all_dvoa: number | null
  second_down_all_dvoa_rank: number | null
  third_fourth_down_pass_dvoa: number | null
  third_fourth_down_pass_dvoa_rank: number | null
  third_fourth_down_rush_dvoa: number | null
  third_fourth_down_rush_dvoa_rank: number | null
  third_fourth_down_all_dvoa: number | null
  third_fourth_down_all_dvoa_rank: number | null
  all_downs_pass_dvoa: number | null
  all_downs_pass_dvoa_rank: number | null
  all_downs_rush_dvoa: number | null
  all_downs_rush_dvoa_rank: number | null
  all_downs_dvoa: number | null
  all_downs_dvoa_rank: number | null
  team_rush_left_end_yards: number | null
  team_rush_left_end_yards_rank: number | null
  team_rush_left_tackle_yards: number | null
  team_rush_left_tackle_yards_rank: number | null
  team_rush_middle_guard_yards: number | null
  team_rush_middle_guard_yards_rank: number | null
  team_rush_right_tackle_yards: number | null
  team_rush_right_tackle_yards_rank: number | null
  team_rush_right_end_yards: number | null
  team_rush_right_end_yards_rank: number | null
  team_running_back_carries: number | null
  team_running_back_carries_rank: number | null
  team_rush_left_end_percentage: number | null
  team_rush_left_tackle_percentage: number | null
  team_rush_middle_guard_percentage: number | null
  team_rush_right_tackle_percentage: number | null
  team_rush_right_end_percentage: number | null
  pass_dvoa: number | null
  rush_dvoa: number | null
  rush_dvoa_rank: number | null
  total_dave: number | null
}

export interface EspnPlayerWinRatesHistoryRow {
  pid: string | null
  player_name: string
  espn_player_id: number
  nfl_team: string
  line_win_count: number
  total_plays: number
  win_rate: number
  double_team_percentage: number
  espn_win_rate_type: EspnWinRateType
  observed_at: Date
  season_year: number
}

export interface EspnPlayerWinRatesIndexRow {
  pid: string | null
  player_name: string
  espn_player_id: number
  nfl_team: string
  line_win_count: number
  total_plays: number
  win_rate: number
  double_team_percentage: number
  espn_win_rate_type: EspnWinRateType
  observed_at: Date
  season_year: number
}

export interface EspnReceivingMetricsHistoryRow {
  pid: string
  season_year: number
  player_position: string
  season_type: string
  espn_rtm_routes: number | null
  espn_rtm_targets: number | null
  espn_rtm_receiving_yards: number | null
  espn_overall_score: number | null
  espn_open_score: number | null
  espn_catch_score: number | null
  espn_yac_score: number | null
  observed_at: Date | null
}

export interface EspnTeamWinRatesHistoryRow {
  nfl_team: string
  pass_rush_win_rate: number | null
  run_stop_win_rate: number | null
  pass_block_win_rate: number | null
  run_block_win_rate: number | null
  observed_at: Date
  season_year: number
}

export interface EspnTeamWinRatesIndexRow {
  nfl_team: string
  pass_rush_win_rate: number | null
  run_stop_win_rate: number | null
  pass_block_win_rate: number | null
  run_block_win_rate: number | null
  observed_at: Date
  season_year: number
}

export interface ExternalLeagueConnectionsRow {
  connection_id: string
  lid: number
  platform: string
  external_league_id: string
  connection_name: string
  connection_description: string | null
  credentials_encrypted: string | null
  status: string
  last_validated: Date | null
  last_sync: Date | null
  is_auto_sync_enabled: boolean
  sync_components: any
  created_by: number | null
  created_at: Date
  updated_at: Date
}

export interface ExternalLeagueImportJobsRow {
  job_id: string
  connection_id: string
  lid: number
  job_type: string
  sync_components: any
  is_dry_run: boolean
  status: string
  progress_percentage: number
  current_step: string | null
  queued_at: Date
  started_at: Date | null
  completed_at: Date | null
  results: any | null
  error_message: string | null
  error_context: any | null
  players_mapped: number | null
  players_failed: number | null
  rosters_updated: number | null
  transactions_imported: number | null
  transactions_failed: number | null
  raw_data: any | null
  mapped_data: any | null
  initiated_by: number | null
  created_at: Date
  updated_at: Date
}

export interface ExternalLeagueMembershipsRow {
  platform: string
  external_league_id: string
  external_user_id: string
  first_seen_at: Date
  is_owner: boolean | null
}

export interface ExternalLeagueTradeLegsRow {
  platform: string
  external_transaction_id: string
  leg_index: number
  leg_type: string
  from_roster_id: number | null
  to_roster_id: number
  pid: string | null
  external_player_id: string | null
  pick_season_year: number | null
  pick_round: number | null
  pick_original_roster_id: number | null
  free_agent_acquisition_budget_amount: number | null
}

export interface ExternalLeagueTradesRow {
  platform: string
  external_transaction_id: string
  external_league_id: string
  season_year: number
  platform_transaction_bucket: number
  processed_at: Date
  number_sides: number
  imported_at: Date
}

export interface ExternalLeagueUsersRow {
  platform: string
  external_user_id: string
  last_crawled_at: Date | null
  first_seen_at: Date
  display_name: string | null
  is_bot: boolean | null
}

export interface ExternalLeaguesRow {
  platform: string
  external_league_id: string
  season_year: number
  league_name: string | null
  number_teams: number | null
  league_format: string
  is_superflex: boolean
  is_best_ball: boolean
  points_per_reception: number | null
  tight_end_premium: number | null
  passing_touchdown_points: number | null
  taxi_slots: number | null
  roster_positions: any | null
  scoring_settings: any | null
  previous_external_league_id: string | null
  discovered_via: string | null
  last_synced_at: Date | null
  created_at: Date
  member_list_crawled_at: Date | null
  discovered_from_external_user_id: string | null
  has_individual_defensive_players: boolean
  league_status: string | null
  last_message_at: Date | null
  external_draft_id: string | null
  league_settings: any | null
  league_metadata: any | null
  previous_external_league_unavailable_at: Date | null
}

export interface FormatCategorySignalMappingRow {
  format_category: number
  ktc_quarterback_axis: number
  ranking_type: string
  props_scoring_formula_template: string | null
  average_draft_position_format_id: string | null
}

export interface HistoricalInjuryIndexRow {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2009Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2010Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2011Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2012Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2013Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2014Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2015Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2016Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2017Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2018Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2019Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2020Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2021Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2022Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2023Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2024Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2025Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface HistoricalInjuryIndex2026Row {
  pid: string
  season_year: number
  week: number
  esbid: number
  nfl_team: string | null
  is_played: boolean | null
  snap_count: number | null
  snaps_offense: number | null
  snaps_defense: number | null
  snaps_special_teams: number | null
  is_gamelog_active: boolean | null
  is_ruled_out_in_game: boolean | null
  has_practice_listed_injury: boolean | null
  is_practice_questionable_or_worse: boolean | null
  practice_designation: string | null
  has_changelog_injury_event: boolean | null
  is_changelog_unavailable: boolean | null
  has_changelog_nfl_reserve_event: boolean | null
  missed_reason: string | null
  source_concurrence: number | null
  confidence: string | null
  inserted_at: Date
  updated_at: Date
}

export interface InviteCodesRow {
  code: string
  created_by: number
  created_at: Date | null
  expires_at: Date | null
  used_by: number | null
  used_at: Date | null
  is_active: boolean | null
  max_uses: number | null
  uses_count: number | null
}

export interface JobsRow {
  job_id: number
  type: number
  is_successful: boolean
  reason: string | null
  run_at: Date
}

export interface KeeptradecutLiquidityRow {
  pid: string
  is_superflex: boolean
  observed_at: Date
  raw_liquidity: number
  standardized_liquidity: number
  trade_count: number
}

export interface KeeptradecutPickRow {
  pid: string
  ktc_player_id: number
  ktc_player_name: string
  season_year: number
  round: number
  slot: number
  created_at: Date
  updated_at: Date
}

export interface KeeptradecutValuationsRow {
  pid: string
  is_superflex: boolean
  observed_at: Date
  keeptradecut_value: number
  position_rank: number | null
  overall_rank: number | null
}

export interface LeagueBaselinesRow {
  lid: number
  week: number
  season_year: number | null
  pid: string | null
  type: string
  player_position: string
  points: number | null
}

export interface LeagueCutlistRow {
  pid: string | null
  tid: number
  sort_order: number
}

export interface LeagueDivisionsRow {
  lid: number
  season_year: number
  division_name: string
  division_id: number
}

export interface LeagueFormatDraftPickValueRow {
  draft_pick_rank: number
  median_best_season_points_added_per_game: number | null
  median_career_points_added_per_game: number | null
  league_format_id: string
}

export interface LeagueFormatPlayerCareerlogsRow {
  pid: string
  draft_rank: number | null
  startable_games: number | null
  points_added_earned: number | null
  points_added_earned_per_game: number | null
  best_season_points_added_earned_per_game: number | null
  points_added_earned_first_three_seasons: number | null
  points_added_earned_first_four_seasons: number | null
  points_added_earned_first_five_seasons: number | null
  points_added_earned_first_season: number | null
  points_added_earned_second_season: number | null
  points_added_earned_third_season: number | null
  earned_salary: number | null
  best_season_earned_salary: number | null
  points_added_net: number | null
  points_added_net_per_game: number | null
  best_season_points_added_net_per_game: number | null
  points_added_net_first_season: number | null
  points_added_net_second_season: number | null
  points_added_net_third_season: number | null
  points_added_net_first_three_seasons: number | null
  points_added_net_first_four_seasons: number | null
  points_added_net_first_five_seasons: number | null
  league_format_id: string
}

export interface LeagueFormatPlayerGamelogsRow {
  pid: string
  esbid: number
  points_added_earned: number | null
  points_added_net: number | null
  league_format_id: string
}

export interface LeagueFormatPlayerProjectionValuesRow {
  pid: string
  week: number
  season_year: number
  projected_points_added_net: number | null
  league_format_id: string
}

export interface LeagueFormatPlayerProjectionValuesHistoryRow {
  pid: string
  league_format_id: string
  week: number
  season_year: number
  projected_points_added_net: number | null
  is_removed: boolean
  observed_at: Date
}

export interface LeagueFormatPlayerRestOfSeasonProjectionValuesRow {
  pid: string
  league_format_id: string
  season_year: number
  projected_points_added_positive: number | null
  projected_points_added_net: number | null
  market_salary_positive: number | null
  market_salary_net: number | null
}

export interface LeagueFormatPlayerRestOfSeasonProjectionValuesHistoryRow {
  pid: string
  league_format_id: string
  season_year: number
  projected_points_added_positive: number | null
  projected_points_added_net: number | null
  market_salary_positive: number | null
  is_removed: boolean
  observed_at: Date
  market_salary_net: number | null
}

export interface LeagueFormatPlayerSeasonProjectionValuesRow {
  pid: string
  league_format_id: string
  season_year: number
  projected_points_added_positive: number | null
  projected_points_added_net: number | null
  market_salary_net: number | null
  market_salary_positive: number | null
}

export interface LeagueFormatPlayerSeasonlogsRow {
  pid: string
  season_year: number
  startable_games: number | null
  points_added_earned: number | null
  points_added_earned_per_game: number | null
  points_added_earned_rank: number | null
  points_added_earned_position_rank: number | null
  earned_salary: number | null
  points_added_earned_per_game_rank: number | null
  points_added_earned_per_game_position_rank: number | null
  points_added_net: number | null
  points_added_net_per_game: number | null
  league_format_id: string
  points_added_net_rank: number | null
  points_added_net_position_rank: number | null
  points_added_net_per_game_rank: number | null
  points_added_net_per_game_position_rank: number | null
  points_added_net_cap_dollars: number | null
}

export interface LeagueFormatsRow {
  number_teams: number
  starter_slots_quarterback: number
  starter_slots_running_back: number
  starter_slots_wide_receiver: number
  starter_slots_tight_end: number
  starter_slots_running_back_wide_receiver_flex: number
  starter_slots_running_back_wide_receiver_tight_end_flex: number
  starter_slots_superflex: number
  starter_slots_wide_receiver_tight_end_flex: number
  starter_slots_defense_special_teams: number
  starter_slots_kicker: number
  bench_slot_count: number
  practice_squad_slot_count: number
  reserve_short_term_limit: number
  salary_cap: number
  min_bid: number
  format_category: number | null
  id: string
  pricing_model: string
  scoring_format_id: string
}

export interface LeagueMigrationsRow {
  id: number
  name: string | null
  batch: number | null
  migration_time: Date
}

export interface LeagueMigrationsLockRow {
  index: number
  is_locked: number | null
}

export interface LeagueNflTeamSeasonlogsRow {
  nfl_team: string
  stat_key: string
  season_year: number
  lid: number
  points: number | null
  points_rank: number | null
}

export interface LeagueNotificationsRow {
  notification_id: number
  lid: number
  season_year: number
  notification_type: string
  event_timestamp: Date
  sent_timestamp: Date
  message: string | null
  metadata: any | null
  created_at: Date | null
}

export interface LeaguePausesRow {
  pause_id: number
  league_id: number
  paused_at: Date
  resumed_at: Date | null
  pause_reason: string
  paused_by_user_id: number
}

export interface LeaguePlayerProjectionValuesRow {
  pid: string | null
  week: number
  season_year: number | null
  lid: number
  projected_points_added_positive_including_cap_savings: number | null
}

export interface LeaguePlayerRestOfSeasonProjectionValuesRow {
  pid: string | null
  lid: number
  season_year: number | null
  projected_points_added_positive_including_cap_savings: number | null
}

export interface LeaguePlayerSeasonProjectionValuesRow {
  pid: string | null
  lid: number
  season_year: number | null
  projected_points_added_positive_including_cap_savings: number | null
  projected_positive_salary_at_available_cap: number | null
}

export interface LeaguePlayerSeasonlogsRow {
  pid: string
  season_year: number
  lid: number
  start_tid: number | null
  start_acquisition_type: number | null
  end_tid: number | null
  end_acquisition_type: number | null
  salary: number | null
}

export interface LeagueScoringFormatsRow {
  passing_attempts: number
  passing_completions: number
  passing_yards: number
  passing_interceptions: number
  passing_touchdowns: number
  rushing_attempts: number
  rushing_yards: number
  rushing_touchdowns: number
  receptions: number
  running_back_reception: number
  wide_receiver_reception: number
  tight_end_reception: number
  receiving_yards: number
  two_point_conversions: number
  receiving_touchdowns: number
  fumbles_lost: number
  punt_return_touchdowns: number
  kickoff_return_touchdowns: number
  scoring_format_title: string | null
  targets: number
  rushing_first_downs: number
  receiving_first_downs: number
  is_excluding_quarterback_kneels: boolean
  fumble_return_touchdowns: number
  id: string
  field_goal_yards: number
  field_goals_made_0_19_yards: number
  field_goals_made_20_29_yards: number
  field_goals_made_30_39_yards: number
  field_goals_made_40_49_yards: number
  field_goals_made_50_plus_yards: number
  extra_points_made: number
  defensive_sacks: number
  defensive_interceptions: number
  defensive_forced_fumbles: number
  defensive_recovered_fumbles: number
  defensive_three_and_outs: number
  defensive_fourth_down_stops: number
  defensive_blocked_kicks: number
  defensive_safeties: number
  defensive_two_point_returns: number
  defensive_touchdowns: number
  defensive_points_against: number
  defensive_points_against_threshold: number
  defensive_yards_against: number
  defensive_yards_against_threshold: number
  bonuses: any
  tight_end_receiving_first_downs: number
  touchdown_is_first_down: boolean
  config_digest: string | null
}

export interface LeagueSeasonBaselinesRow {
  lid: number
  season_year: number
  pid: string | null
  type: string
  player_position: string
  points: number | null
}

export interface LeagueTeamCareerlogsRow {
  lid: number
  tid: number
  regular_season_wins: number | null
  regular_season_losses: number | null
  regular_season_ties: number | null
  all_play_wins: number | null
  all_play_losses: number | null
  all_play_ties: number | null
  points_for: number | null
  points_against: number | null
  point_differential: number | null
  potential_points: number | null
  potential_wins: number | null
  potential_losses: number | null
  potential_points_percentage: number | null
  highest_weekly_score: number | null
  lowest_weekly_score: number | null
  worst_regular_season_finish: number | null
  best_regular_season_finish: number | null
  best_overall_finish: number | null
  worst_overall_finish: number | null
  first_season_year: number | null
  last_season_year: number | null
  number_seasons: number | null
  weekly_high_scores: number | null
  post_seasons: number | null
  championships: number | null
  championship_rounds: number | null
  regular_season_leader: number | null
  number_byes: number | null
  best_season_win_percentage: number | null
  best_season_all_play_percentage: number | null
  wildcards: number | null
  wildcard_wins: number | null
  wildcard_highest_score: number | null
  wildcard_total_points: number | null
  wildcard_lowest_score: number | null
  championship_highest_score: number | null
  championship_total_points: number | null
  championship_lowest_score: number | null
  division_wins: number | null
}

export interface LeagueTeamDailyValuesRow {
  lid: number
  tid: number
  date: Date
  observed_at: Date
  ktc_value: number | null
  ktc_share: number | null
  pick_value: number | null
  total_value: number | null
  total_share: number | null
}

export interface LeagueTeamForecastRow {
  tid: number
  lid: number
  week: string
  season_year: number | null
  day: number
  playoff_odds: number
  division_odds: number | null
  bye_odds: number
  championship_odds: number
  generated_at: Date
  playoff_odds_with_win: number | null
  division_odds_with_win: number | null
  bye_odds_with_win: number | null
  championship_odds_with_win: number | null
  playoff_odds_with_loss: number | null
  division_odds_with_loss: number | null
  bye_odds_with_loss: number | null
  championship_odds_with_loss: number | null
}

export interface LeagueTeamLineupContributionWeeksRow {
  pid: string | null
  week: number
  season_year: number | null
  tid: number
  lid: number
  is_starter: boolean
  starter_plus_points: number
  bench_plus_points: number
}

export interface LeagueTeamLineupContributionsRow {
  pid: string | null
  season_year: number | null
  tid: number
  lid: number
  starts: number
  starter_plus_points: number
  bench_plus_points: number
}

export interface LeagueTeamLineupStartersRow {
  pid: string | null
  week: number
  season_year: number | null
  tid: number
  lid: number
}

export interface LeagueTeamLineupsRow {
  week: number
  season_year: number | null
  tid: number
  lid: number
  optimal_total: number | null
  baseline_total: number | null
}

export interface LeagueTeamPlayerSeasonlogsRow {
  lid: number
  tid: number
  pid: string
  season_year: number
  weeks_rostered: number
  weeks_started: number
  realized_points_added_positive_rostered: number | null
  realized_points_added_net_rostered: number | null
  realized_points_added_positive_started: number | null
  realized_points_added_net_started: number | null
  realized_points_added_positive_optimal: number | null
  realized_points_added_net_optimal: number | null
  salary_paid: number | null
  acquisition_type: number | null
  is_start_team: boolean
  is_end_team: boolean
  league_format_id: string
}

export interface LeagueTeamSeasonlogsRow {
  lid: number
  tid: number
  division: number | null
  season_year: number
  regular_season_wins: number | null
  regular_season_losses: number | null
  regular_season_ties: number | null
  all_play_wins: number | null
  all_play_losses: number | null
  all_play_ties: number | null
  points_for: number | null
  points_against: number | null
  point_differential: number | null
  potential_points: number | null
  potential_points_penalty: number | null
  potential_wins: number | null
  potential_losses: number | null
  potential_points_percentage: number | null
  highest_weekly_score: number | null
  lowest_weekly_score: number | null
  weekly_score_deviation: number | null
  draft_order_index: number | null
  starter_slot_1_points: number | null
  starter_slot_2_points: number | null
  starter_slot_3_points: number | null
  starter_slot_4_points: number | null
  starter_slot_5_points: number | null
  starter_slot_6_points: number | null
  starter_slot_7_points: number | null
  starter_slot_8_points: number | null
  starter_slot_9_points: number | null
  starter_slot_10_points: number | null
  starter_slot_11_points: number | null
  starter_slot_12_points: number | null
  starter_slot_13_points: number | null
  starter_slot_14_points: number | null
  starter_slot_15_points: number | null
  starter_slot_16_points: number | null
  starter_slot_17_points: number | null
  starter_points_quarterback: number | null
  starter_points_running_back: number | null
  starter_points_wide_receiver: number | null
  starter_points_tight_end: number | null
  starter_points_kicker: number | null
  starter_points_defense_special_teams: number | null
  division_finish: number | null
  regular_season_finish: number | null
  post_season_finish: number | null
  overall_finish: number | null
  weekly_high_scores: number | null
  starter_slot_18_points: number | null
}

export interface LeagueUserCareerlogsRow {
  lid: number
  user_id: number
  regular_season_wins: number | null
  regular_season_losses: number | null
  regular_season_ties: number | null
  all_play_wins: number | null
  all_play_losses: number | null
  all_play_ties: number | null
  points_for: number | null
  points_against: number | null
  point_differential: number | null
  potential_points: number | null
  potential_wins: number | null
  potential_losses: number | null
  potential_points_percentage: number | null
  highest_weekly_score: number | null
  lowest_weekly_score: number | null
  worst_regular_season_finish: number | null
  best_regular_season_finish: number | null
  best_overall_finish: number | null
  worst_overall_finish: number | null
  first_season_year: number | null
  last_season_year: number | null
  number_seasons: number | null
  weekly_high_scores: number | null
  post_seasons: number | null
  championships: number | null
  championship_rounds: number | null
  regular_season_leader: number | null
  number_byes: number | null
  best_season_win_percentage: number | null
  best_season_all_play_percentage: number | null
  wildcards: number | null
  wildcard_wins: number | null
  wildcard_highest_score: number | null
  wildcard_total_points: number | null
  wildcard_lowest_score: number | null
  championship_highest_score: number | null
  championship_total_points: number | null
  championship_lowest_score: number | null
  division_wins: number | null
}

export interface LeaguesRow {
  league_id: number
  commissioner_user_id: number
  name: string
  discord_webhook_url: string | null
  is_hosted: boolean | null
  processed_at: Date | null
  archived_at: Date | null
  espn_league_id: number | null
  sleeper_league_id: number | null
  mfl_league_id: number | null
  fleaflicker_league_id: number | null
  salary_attribution_rule: number
  discord_announcements_webhook_url: string | null
}

export interface ManagerWaitlistSubmissionsRow {
  submission_id: number
  questionnaire_version: number
  submitted_at: Date
  candidate_name: string
  contact_email: string
  contact_handle: string | null
  timezone_name: string
  has_affirmed_commitment: boolean
  requested_seat: string | null
  responses: any
  edited_at: Date | null
}

export interface MatchupsRow {
  matchup_id: number
  away_team_id: number
  home_team_id: number
  lid: number
  season_year: number | null
  week: number
  away_points: number
  home_points: number
  away_potential_points: number
  home_potential_points: number
  home_projection: number | null
  away_projection: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  simulation_timestamp: Date | null
}

export interface NflCoachesRow {
  pfr_coach_id: string | null
  full_name: string
  updated_at: Date
  coach_id: string
  date_of_birth: Date | null
}

export interface NflDraftRankingsHistoryRow {
  pid: string
  source_id: MockDraftSourceId
  season_year: number
  overall_rank: number | null
  position_rank: number | null
  player_position: string | null
  observed_at: Date
  draft_ranking_type: DraftRankingType
}

export interface NflDraftRankingsIndexRow {
  pid: string
  source_id: MockDraftSourceId
  season_year: number
  overall_rank: number | null
  position_rank: number | null
  player_position: string | null
  observed_at: Date
  draft_ranking_type: DraftRankingType
}

export interface NflGameCoachesRow {
  nflverse_game_id: string
  nfl_team: string
  ingested_at: Date
  head_coach_id: string | null
  offense_play_caller_id: string | null
  defense_play_caller_id: string | null
}

export interface NflGamesRow {
  esbid: number | null
  gsis_game_id: number | null
  nflverse_game_id: string | null
  espn_game_id: number | null
  ngs_game_id: number | null
  shield_game_id: string | null
  detail_v3_game_id: string | null
  detail_v1_game_id: string | null
  pfr_game_id: string | null
  season_year: number | null
  week: number
  day: string | null
  date: string | null
  time_eastern: string | null
  time_start: string | null
  time_end: string | null
  kickoff_at: Date | null
  away_nfl_team: string
  home_nfl_team: string
  season_type: string
  is_overtime: boolean | null
  is_division_game: boolean | null
  home_team_id: string | null
  away_team_id: string | null
  home_ngs_team_id: string | null
  away_ngs_team_id: string | null
  home_score: number | null
  away_score: number | null
  stadium_name: string | null
  nfl_stadium_id: string | null
  ngs_stadium_id: number | null
  game_clock: string | null
  status: string | null
  away_rest: number | null
  home_rest: number | null
  home_moneyline: number | null
  away_moneyline: number | null
  spread_line: number | null
  total_line: number | null
  roof: NflGamesRoof | null
  playing_surface: NflGamesSurf | null
  temperature_fahrenheit: number | null
  wind_speed_mph: number | null
  away_coach: string | null
  home_coach: string | null
  referee: string | null
  week_type: string | null
  away_qb_pid: string | null
  home_qb_pid: string | null
  away_play_caller: string | null
  home_play_caller: string | null
  sportradar_game_id: string | null
  sportradar_season_id: string | null
  nfl_week_id: string | null
  pff_game_id: number | null
  finalized_plays_updated_at: Date | null
  prizepicks_game_id: string | null
}

export interface NflGamesChangelogRow {
  id: number
  esbid: string
  column_name: string
  previous_value: string | null
  new_value: string | null
  source: string
  reason: string | null
  changed_at: Date
}

export interface NflMatchupStatsRow {
  esbid: number
  offense_player_id: string
  defense_player_id: string
  matchup_type: string
  total_matchup_snaps: number | null
  receiving_routes: number | null
  receiving_targets: number | null
  receiving_receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  receiving_yards_after_catch: number | null
  receiving_target_rate: number | null
  receiving_catch_rate: number | null
  receiving_yards_per_route: number | null
  receiving_epa: number | null
  defense_pass_breakups: number | null
  defense_press_coverage_rate: number | null
  defense_nonpress_coverage_rate: number | null
  defense_interceptions: number | null
  pressure_allowed_count: number | null
  pressure_allowed_rate: number | null
  sacks_allowed: number | null
  sack_allowed_rate: number | null
  defense_average_time_to_pressure: number | null
  defense_fumbles_forced: number | null
  double_team_count: number | null
  offense_impact_plays: number | null
  defense_impact_plays: number | null
}

export interface NflPlayStatsRow {
  esbid: number
  play_id: number
  nfl_team: string | null
  player_name: string | null
  stat_id: number
  stat_yards: number | null
  gsis_player_id: string | null
  smart_player_id: string | null
  nfl_team_id: string | null
  is_valid: boolean | null
}

export interface NflPlayStatsCurrentWeekRow {
  esbid: number
  play_id: number
  nfl_team: string | null
  player_name: string | null
  stat_id: number
  stat_yards: number | null
  gsis_player_id: string | null
  smart_player_id: string | null
  nfl_team_id: string | null
  is_valid: boolean | null
}

export interface NflPlayerPlayChartingRow {
  esbid: number
  nfl_team: string
  source_row_index: number
  sumer_player_id: string
  pid: string | null
  jersey_number: number | null
  alignment: string | null
  alignment_side: string | null
  snap_role: string | null
  defender_technique: string | null
  is_box_alignment: boolean | null
  route_run: string | null
  route_release: string | null
  route_break_depth: number | null
  coverage_responsibility: string | null
  coverage_responsibility_side: string | null
  is_primary_coverage: boolean | null
  gap_assignment: string | null
  gap_assignment_side: string | null
  press_type: string | null
  is_press: boolean | null
  is_pressure: boolean | null
  is_pressure_allowed: boolean | null
  is_hurry: boolean | null
  is_hurry_allowed: boolean | null
  is_sack_allowed: boolean | null
  is_hit: boolean | null
  is_quarterback_hitter: boolean | null
  is_quarterback_scramble: boolean | null
  is_quarterback_designed_run: boolean | null
  is_first_contact: boolean | null
  is_stop: boolean | null
  is_tackle_missed: boolean | null
  is_pass_breakup: boolean | null
  is_reception_allowed: boolean | null
  passing_depth_of_target: number | null
  passing_epa: number | null
  receiving_depth_of_target: number | null
  receiving_receptions: number | null
  receiving_yards_after_catch: number | null
  receiving_epa: number | null
  rushing_epa: number | null
  yards_after_contact: number | null
  defense_solo_tackles: number | null
  defense_assisted_tackles: number | null
  defense_tackles_for_loss: number | null
  defense_sacks: number | null
}

export interface NflPlaysRow {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysCurrentWeekRow {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: string | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: string | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  run_gap: string | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  field_goal_result: string | null
  kick_distance: number | null
  extra_point_result: string | null
  two_point_result: string | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: string | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
}

export interface NflPlaysPasserRow {
  esbid: number
  play_id: number
  season_year: number
  gsis_it_player_id: number
  player_esbid: string | null
  gsis_player_id: string | null
  passer_speed_at_pass_forward: number | null
  target_speed_at_pass_arrived: number | null
  air_yards_to_sticks: number | null
  snap_time: Date | null
  pass_start_time: Date | null
  pass_end_time: Date | null
  is_completion: boolean | null
  is_turnover_touchdown: boolean | null
  lateral_distance: number | null
  time_to_throw: number | null
  air_time: number | null
  max_passing_speed: number | null
  average_passing_speed: number | null
  pass_location_type: string | null
  passing_zone_three_column_section: string | null
  passing_zone_five_column_section: string | null
  passing_zone_line_of_scrimmage_distance: string | null
  is_tipped: boolean | null
  target_receiver_location: string | null
  is_pass_dropped: boolean | null
  time_in_tackle_box: number | null
  target_separation_at_outcome: number | null
  completion_probability: number | null
  min_separation_from_pass_rusher: number | null
  is_hurry: boolean | null
  time_to_hurry: number | null
  drop_back_distance: number | null
  drop_back_type: string | null
  intended_air_yards: number | null
  intended_air_distance: number | null
  is_pressure: boolean | null
  is_pressure_at_pass_forward: boolean | null
  is_spike: boolean | null
}

export interface NflPlaysPlayerRow {
  esbid: number
  play_id: number
  season_year: number
  gsis_it_player_id: number
  player_esbid: string | null
  first_name: string | null
  gsis_player_id: string | null
  is_ball_carrier: boolean | null
  is_defense_play: boolean | null
  is_interceptor: boolean | null
  is_lined_up_as_quarterback: boolean | null
  is_no_play: boolean | null
  is_offense_play: boolean | null
  is_playtime_play: boolean | null
  is_special_teams_play: boolean | null
  is_target: boolean | null
  jersey_number: number | null
  last_name: string | null
  is_pass_defended: boolean | null
  player_name: string | null
  player_position: string | null
  position_group: string | null
  short_name: string | null
  smart_player_id: string | null
  uniform_number: string | null
  x_at_snap: number | null
  y_at_snap: number | null
  yards_to_go: number | null
  in_play_distance: number | null
  max_speed: number | null
  x_at_end_of_play: number | null
  x_ball_at_snap: number | null
  y_at_end_of_play: number | null
  y_ball_at_snap: number | null
  is_lined_up_in_the_box: boolean | null
  is_blitzing: boolean | null
  has_caused_pressure: boolean | null
  has_pressure_caused_turnover: boolean | null
  separation_to_quarterback: number | null
  is_running_route: boolean | null
  defender_location_type: string | null
  left_or_right_of_center: string | null
  ngs_position: string | null
  ngs_position_group: string | null
  time_to_quarterback_hurry: number | null
  player_get_off: number | null
}

export interface NflPlaysReceiverRow {
  esbid: number
  play_id: number
  season_year: number
  gsis_it_player_id: number | null
  player_esbid: string | null
  gsis_player_id: string
  receiver_location_type: string | null
  cushion: number | null
  charted_route: NflPassRoute | null
  is_isolated: boolean | null
  separation_at_pass_forward: number | null
  separation_at_pass_arrived: number | null
  is_pass_dropped: boolean | null
  air_yards: number | null
  air_distance: number | null
  expected_yards_after_catch: number | null
  touchdown_probability: number | null
  defenders_within_two_yards_of_target_at_pass_arrived: number | null
  x_at_pass_outcome: number | null
  y_at_pass_outcome: number | null
  x_at_pass_forward: number | null
  y_at_pass_forward: number | null
  is_completion: boolean | null
  is_interception: boolean | null
  is_touchdown: boolean | null
  distance_from_sideline: number | null
  distance_from_endzone: number | null
  cushion_charted: number | null
  motion_type: MotionType | null
}

export interface NflPlaysRusherRow {
  esbid: number
  play_id: number
  season_year: number
  gsis_it_player_id: number
  player_esbid: string | null
  gsis_player_id: string | null
  pre_snap_rush_location: string | null
  rush_location: string | null
  contact_time: Date | null
  expected_rush_yards: number | null
  expected_rush_yards_lower: number | null
  expected_rush_yards_upper: number | null
  expected_rush_yards_width: number | null
  first_down_probability: number | null
  speed_at_line_of_scrimmage: number | null
  success_probability: number | null
  time_to_line_of_scrimmage: number | null
  is_touchdown: boolean | null
  touchdown_probability: number | null
  x_at_line_of_scrimmage: number | null
  x_at_past_tackle_box: number | null
  y_at_line_of_scrimmage: number | null
  y_at_past_tackle_box: number | null
  yards_after_contact: number | null
  yards_before_contact: number | null
  yards_gained_after_close_in: number | null
  yards_gained_before_close_in: number | null
}

export interface NflPlaysYear2000Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2001Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2002Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2003Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2004Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2005Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2006Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2007Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2008Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2009Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2010Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2011Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2012Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2013Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2014Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2015Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2016Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2017Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2018Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2019Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2020Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2021Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2022Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2023Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2024Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2025Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflPlaysYear2026Row {
  esbid: number
  play_id: number
  sequence: number | null
  state: string | null
  down_number: number | null
  home_score: number | null
  is_special_teams_play: boolean | null
  play_description: string | null
  play_type_ngs: string | null
  possession_nfl_team: string | null
  possession_nfl_team_id: string | null
  quarter: number | null
  season_year: number
  season_type: string | null
  away_score: number | null
  week: number
  yard_line_number: number | null
  yard_line_side: string | null
  yards_to_go: number | null
  offense_formation: string | null
  offense_personnel: string | null
  box_defenders: number | null
  ngs_pass_rushers: number | null
  defense_personnel: string | null
  game_clock_start: string | null
  drive_sequence: number | null
  yard_line_end: string | null
  yard_line_start: string | null
  is_first_down: boolean | null
  is_goal_to_go: boolean | null
  next_play_type: string | null
  is_penalty: boolean | null
  drive_yards: number | null
  drive_play_count: number | null
  play_clock: number | null
  is_deleted: boolean | null
  review: string | null
  is_scoring_play: boolean | null
  score_type: NflScoreType | null
  score_team: string | null
  special_play_type: string | null
  play_time_of_day: string | null
  play_type_nfl: string | null
  updated: Date
  offense_nfl_team: string | null
  defense_nfl_team: string | null
  play_type: NflPlayType | null
  fumble_lost_pid: string | null
  fumble_lost_gsis_player_id: string | null
  ball_carrier_pid: string | null
  ball_carrier_gsis_player_id: string | null
  passer_pid: string | null
  passer_gsis_player_id: string | null
  target_pid: string | null
  target_gsis_player_id: string | null
  interceptor_pid: string | null
  interceptor_gsis_player_id: string | null
  yards_gained: number | null
  depth_of_target: number | null
  yards_after_catch: number | null
  yards_after_any_contact: number | null
  return_yards: number | null
  is_qb_pressure: boolean | null
  is_qb_hit: boolean | null
  is_qb_hurry: boolean | null
  is_highlight_pass: boolean | null
  is_interception_worthy: boolean | null
  is_dropped_pass: boolean | null
  is_contested_ball: boolean | null
  missed_or_broken_tackle: number | null
  is_fumble_lost: boolean | null
  is_interception: boolean | null
  is_sack: boolean | null
  is_successful_play: boolean | null
  is_completion: boolean | null
  is_touchdown: boolean | null
  is_return_touchdown: boolean | null
  touchdown_nfl_team: string | null
  return_nfl_team: string | null
  yards_from_own_goal: number | null
  true_air_yards: number | null
  is_created_reception: boolean | null
  avoided_sacks: number | null
  is_no_huddle: boolean | null
  is_play_action: boolean | null
  is_trick_look: boolean | null
  is_trick_play: boolean | null
  is_qb_rush: boolean | null
  is_qb_sneak: boolean | null
  is_qb_scramble: boolean | null
  is_hindered_pass: boolean | null
  is_zero_blitz: boolean | null
  is_stunt: boolean | null
  is_out_of_pocket_pass: boolean | null
  is_physical_ball: boolean | null
  is_catchable_ball: boolean | null
  is_throw_away: boolean | null
  is_shovel_pass: boolean | null
  is_sideline_pass: boolean | null
  is_batted_pass: boolean | null
  is_screen_pass: boolean | null
  is_pain_free_play: boolean | null
  is_qb_fault_sack: boolean | null
  ttscrm: number | null
  time_to_pass: number | null
  time_to_sack: number | null
  time_to_pressure: number | null
  backfield_player_count: number | null
  extra_men_on_line: number | null
  defensive_back_count: number | null
  box_defenders_charted: number | null
  defensive_backs_in_box: number | null
  pass_rushers: number | null
  blitzers: number | null
  defensive_back_blitzers: number | null
  out_of_pocket_details: string | null
  coverage_on_target: number | null
  coverage_type_charted: string | null
  receiver_separation: string | null
  yard_line_100: number | null
  drive_result: string | null
  drive_top: string | null
  drive_first_downs: number | null
  is_drive_inside_20: boolean | null
  is_drive_score: boolean | null
  drive_start_quarter: number | null
  drive_end_quarter: number | null
  drive_yards_penalized: number | null
  drive_start_transition: string | null
  drive_end_transition: string | null
  drive_game_clock_start: string | null
  drive_game_clock_end: string | null
  drive_start_yard_line: string | null
  drive_end_yard_line: string | null
  drive_start_play_id: number | null
  drive_end_play_id: number | null
  series_sequence: number | null
  is_series_successful: boolean | null
  series_result: SeriesResult | null
  game_clock_end: string | null
  seconds_remaining_quarter: number | null
  seconds_remaining_half: number | null
  seconds_remaining_game: number | null
  is_fumble: boolean | null
  is_incompletion: boolean | null
  is_touchback: boolean | null
  is_safety: boolean | null
  is_out_of_bounds: boolean | null
  is_tackle_for_loss: boolean | null
  is_rushing_play: boolean | null
  is_passing_play: boolean | null
  is_solo_tackle: boolean | null
  is_assist_tackle: boolean | null
  penalty_team: string | null
  penalty_yards: number | null
  is_passing_touchdown: boolean | null
  is_rushing_touchdown: boolean | null
  pass_yards: number | null
  receiving_yards: number | null
  rush_yards: number | null
  is_qb_dropback: boolean | null
  is_qb_kneel: boolean | null
  is_qb_spike: boolean | null
  run_location: PlayDirection | null
  is_first_down_rush: boolean | null
  is_first_down_pass: boolean | null
  is_first_down_penalty: boolean | null
  is_third_down_converted: boolean | null
  is_third_down_failed: boolean | null
  is_fourth_down_converted: boolean | null
  is_fourth_down_failed: boolean | null
  expected_points: number | null
  epa: number | null
  is_epa_successful: boolean | null
  total_home_epa: number | null
  total_away_epa: number | null
  total_home_rush_epa: number | null
  total_away_rush_epa: number | null
  total_home_pass_epa: number | null
  total_away_pass_epa: number | null
  quarterback_epa: number | null
  air_epa: number | null
  yac_epa: number | null
  completion_air_epa: number | null
  completion_yac_epa: number | null
  xyac_epa: number | null
  total_home_completion_air_epa: number | null
  total_away_completion_air_epa: number | null
  total_home_completion_yac_epa: number | null
  total_away_completion_yac_epa: number | null
  total_home_raw_air_epa: number | null
  total_away_raw_air_epa: number | null
  total_home_raw_yac_epa: number | null
  total_away_raw_yac_epa: number | null
  win_probability: number | null
  win_probability_added: number | null
  home_win_probability: number | null
  away_win_probability: number | null
  vegas_wpa: number | null
  vegas_home_wpa: number | null
  home_win_probability_post: number | null
  away_win_probability_post: number | null
  vegas_win_probability: number | null
  vegas_home_win_probability: number | null
  total_home_rush_wpa: number | null
  total_away_rush_wpa: number | null
  total_home_pass_wpa: number | null
  total_away_pass_wpa: number | null
  air_wpa: number | null
  yac_wpa: number | null
  completion_air_wpa: number | null
  completion_yac_wpa: number | null
  total_home_completion_air_wpa: number | null
  total_away_completion_air_wpa: number | null
  total_home_completion_yac_wpa: number | null
  total_away_completion_yac_wpa: number | null
  total_home_raw_air_wpa: number | null
  total_away_raw_air_wpa: number | null
  total_home_raw_yac_wpa: number | null
  total_away_raw_yac_wpa: number | null
  xyac_mean_yards: number | null
  xyac_median_yards: number | null
  xyac_success_probability: number | null
  xyac_first_down_probability: number | null
  is_extra_point_attempt: boolean | null
  is_two_point_conversion_attempt: boolean | null
  is_field_goal_attempt: boolean | null
  is_kickoff_attempt: boolean | null
  is_punt_attempt: boolean | null
  kick_distance: number | null
  extra_point_result: NflKickResult | null
  is_punt_blocked: boolean | null
  home_timeouts_remaining: number | null
  away_timeouts_remaining: number | null
  possession_timeouts_remaining: number | null
  defense_timeouts_remaining: number | null
  is_timeout: boolean | null
  timeout_team: string | null
  possession_score: number | null
  defense_score: number | null
  score_difference: number | null
  possession_score_post: number | null
  defense_score_post: number | null
  score_difference_post: number | null
  no_score_probability: number | null
  opponent_field_goal_probability: number | null
  opponent_safety_probability: number | null
  opponent_touchdown_probability: number | null
  field_goal_probability: number | null
  safety_probability: number | null
  touchdown_probability: number | null
  extra_point_probability: number | null
  two_conversion_probability: number | null
  expected_pass_probability: number | null
  pass_over_expected: number | null
  completion_probability: number | null
  completion_percentage_over_expected: number | null
  air_yards: number | null
  time_to_throw: number | null
  charted_route: NflPassRoute | null
  man_zone: string | null
  coverage_type_ngs: string | null
  is_qb_pressure_tracking: boolean | null
  starting_hash: HashPosition | null
  ftn_play_id: number | null
  quarterback_position: QbPosition | null
  number_offense_backfield: number | null
  is_run_play_option: boolean | null
  read_thrown: ReadThrownType | null
  is_motion: boolean | null
  solo_tackle_1_gsis: string | null
  solo_tackle_1_pid: string | null
  solo_tackle_2_gsis: string | null
  solo_tackle_2_pid: string | null
  solo_tackle_3_gsis: string | null
  solo_tackle_3_pid: string | null
  assisted_tackle_1_gsis: string | null
  assisted_tackle_1_pid: string | null
  assisted_tackle_2_gsis: string | null
  assisted_tackle_2_pid: string | null
  tackle_assist_1_gsis: string | null
  tackle_assist_1_pid: string | null
  tackle_assist_2_gsis: string | null
  tackle_assist_2_pid: string | null
  tackle_assist_3_gsis: string | null
  tackle_assist_3_pid: string | null
  tackle_assist_4_gsis: string | null
  tackle_assist_4_pid: string | null
  pass_location: PlayDirection | null
  play_direction: string | null
  expected_points_ngs: number | null
  epa_ngs: number | null
  home_win_probability_pre_ngs: number | null
  home_win_probability_post_ngs: number | null
  away_win_probability_pre_ngs: number | null
  away_win_probability_post_ngs: number | null
  receiver_alignment: string | null
  average_pass_rusher_distance_to_quarterback: number | null
  number_high_safeties: number | null
  safety_shell: string | null
  number_shifted_players: number | null
  pass_probability_tracking: number | null
  pass_probability_non_tracking: number | null
  average_height: number | null
  total_weight: number | null
  quarterback_position_tracking: string | null
  run_gap: RunGap | null
  yards_created: number | null
  yards_blocked: number | null
  is_endzone_target: boolean | null
  targeted_receiver_separation: ReceiverSeparation | null
  coverage_type: CoverageType | null
  targeted_defender_gsis: string | null
  is_pass_breakup: boolean | null
  is_motion_before_snap: boolean | null
  is_motion_during_snap: boolean | null
  sportradar_game_id: string | null
  sportradar_play_id: string | null
  sportradar_drive_id: string | null
  sportradar_play_type: string | null
  wall_clock: Date | null
  kicker_pid: string | null
  kicker_gsis: string | null
  kicker_sportradar_player_id: string | null
  punter_pid: string | null
  punter_gsis: string | null
  punter_sportradar_player_id: string | null
  returner_pid: string | null
  returner_gsis: string | null
  returner_sportradar_player_id: string | null
  penalty_player_pid: string | null
  penalty_player_gsis: string | null
  penalty_sportradar_player_id: string | null
  penalty_type: string | null
  is_penalty_declined: boolean | null
  is_penalty_offset: boolean | null
  kickoff_yards: number | null
  punt_yards: number | null
  punt_hang_time: number | null
  is_punt_inside_20: boolean | null
  is_punt_touchback: boolean | null
  is_punt_fair_catch: boolean | null
  is_punt_out_of_bounds: boolean | null
  is_kickoff_onside: boolean | null
  is_kickoff_touchback: boolean | null
  is_kickoff_out_of_bounds: boolean | null
  is_field_goal_blocked: boolean | null
  field_goal_result_detail: NflFgResultDetail | null
  pocket_time: number | null
  tackle_for_loss_1_gsis: string | null
  tackle_for_loss_1_pid: string | null
  tackle_for_loss_1_sportradar_player_id: string | null
  tackle_for_loss_2_gsis: string | null
  tackle_for_loss_2_pid: string | null
  tackle_for_loss_2_sportradar_player_id: string | null
  sack_player_1_gsis: string | null
  sack_player_1_pid: string | null
  sack_1_sportradar_player_id: string | null
  sack_player_2_gsis: string | null
  sack_player_2_pid: string | null
  sack_2_sportradar_player_id: string | null
  fumble_forced_1_gsis: string | null
  fumble_forced_1_pid: string | null
  fumble_forced_1_sportradar_player_id: string | null
  fumble_recovered_1_gsis: string | null
  fumble_recovered_1_pid: string | null
  fumble_recovered_1_sportradar_player_id: string | null
  fumble_recovered_team: string | null
  incomplete_pass_type: NflIncompletePassType | null
  broken_tackles_rush: number | null
  broken_tackles_receiving: number | null
  pocket_location: NflPocketLocation | null
  left_tightends: number | null
  right_tightends: number | null
  is_fake_punt: boolean | null
  is_fake_field_goal: boolean | null
  is_blitz: boolean | null
  field_goal_result: NflKickResult | null
  two_point_result: NflTwoPointResult | null
  play_description_nflfastr: string | null
  nfl_week_id: string | null
  epa_charting: number | null
  dropback_depth: number | null
  play_action_concept: string | null
  run_concept: string | null
  run_gap_intent: string | null
  run_gap_intent_side: string | null
  run_gap_outcome: string | null
  run_gap_outcome_side: string | null
  mofc_played: string | null
  mofc_look: string | null
  pass_width: number | null
  quarterback_scramble_side: string | null
  is_split_run: boolean | null
  is_reverse_run: boolean | null
  is_pitch_run: boolean | null
  is_option_run: boolean | null
  is_qb_left_pocket: boolean | null
  is_end_around_run: boolean | null
  is_jet_sweep_run: boolean | null
  is_lead_run: boolean | null
  is_own_fumble_recovery: boolean | null
  charting_play_type: string | null
  charting_penalty_outcome: string | null
  qb_pid: string | null
  offense_personnel_quarterback_count: number | null
  offense_personnel_running_back_count: number | null
  offense_personnel_tight_end_count: number | null
  offense_personnel_wide_receiver_count: number | null
  offense_personnel_offensive_line_count: number | null
  defense_personnel_defensive_line_count: number | null
  defense_personnel_linebacker_count: number | null
  defense_personnel_defensive_back_count: number | null
  offense_personnel_running_back_count_per_play: number | null
  offense_personnel_tight_end_count_per_play: number | null
  offense_personnel_wide_receiver_count_per_play: number | null
  receiver_alignment_charting: string | null
  coverage_defenders: number | null
}

export interface NflSnapsRow {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2000Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2001Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2002Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2003Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2004Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2005Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2006Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2007Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2008Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2009Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2010Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2011Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2012Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2013Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2014Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2015Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2016Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2017Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2018Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2019Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2020Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2021Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2022Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2023Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2024Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2025Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYear2026Row {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflSnapsYearDefaultRow {
  esbid: number
  play_id: number
  gsis_it_player_id: number
  season_year: number
}

export interface NflStadiumRow {
  nfl_stadium_id: string
  stadium_name: string | null
}

export interface NflTeamGamelogsRow {
  esbid: number
  nfl_team: string
  season_year: number
  offense_pass_plays: number | null
  offense_pass_touchdowns: number | null
  offense_pass_yards: number | null
  offense_pass_yards_per_play: number | null
  offense_pass_epa: number | null
  offense_pass_epa_per_play: number | null
  offense_pass_attempts: number | null
  offense_average_time_to_throw: number | null
  offense_sack_yards: number | null
  offense_sacks: number | null
  offense_pressures: number | null
  offense_average_time_to_pressure: number | null
  offense_yards_after_catch: number | null
  offense_yards_after_catch_over_expected: number | null
  offense_average_target_separation: number | null
  offense_run_plays: number | null
  offense_rush_touchdowns: number | null
  offense_rush_yards: number | null
  offense_rush_yards_per_play: number | null
  offense_rush_epa: number | null
  offense_rush_epa_per_play: number | null
  offense_rush_yards_over_expected: number | null
  offense_rush_yards_over_expected_per_attempt: number | null
  offense_rush_yards_before_contact_per_attempt: number | null
  offense_rush_yards_after_contact_per_attempt: number | null
  offense_rush_yards_10_plus: number | null
  defense_pass_plays: number | null
  defense_pass_yards: number | null
  defense_pass_yards_per_play: number | null
  defense_pass_touchdowns: number | null
  defense_pass_epa: number | null
  defense_pass_epa_per_play: number | null
  defense_average_time_to_throw: number | null
  defense_sack_yards: number | null
  defense_sacks: number | null
  defense_pressures: number | null
  defense_average_time_to_pressure: number | null
  defense_average_get_off: number | null
  defense_yards_after_catch_over_expected: number | null
  defense_average_target_separation: number | null
  defense_tight_window_percentage: number | null
  defense_run_plays: number | null
  defense_rush_touchdowns: number | null
  defense_rush_yards: number | null
  defense_rush_yards_per_play: number | null
  defense_rush_yards_10_plus: number | null
  defense_rush_epa: number | null
  defense_rush_epa_per_play: number | null
  defense_rush_yards_over_expected: number | null
  defense_rush_yards_over_expected_per_attempt: number | null
  defense_rush_yards_before_contact_per_attempt: number | null
  defense_rush_yards_after_contact_per_attempt: number | null
  defense_yards_after_catch: number | null
  offense_pass_percentage: number | null
  offense_sack_rate: number | null
  offense_pressure_rate: number | null
  offense_blitz_rate: number | null
  offense_play_action_percentage: number | null
  offense_run_percentage: number | null
  offense_rush_success_percentage: number | null
  offense_rush_attempts_inside_tackles_percentage: number | null
  offense_rush_attempts_outside_tackles_percentage: number | null
  offense_rush_attempts_light_box_percentage: number | null
  offense_rush_attempts_stacked_box_percentage: number | null
  offense_rush_attempts_stuffed_percentage: number | null
  defense_pass_percentage: number | null
  defense_sack_percentage: number | null
  defense_pressure_rate: number | null
  defense_blitz_rate: number | null
  defense_run_percentage: number | null
  defense_rush_stuffed_percentage: number | null
  defense_rush_attempts_inside_tackles_percentage: number | null
  defense_rush_attempts_outside_tackles_percentage: number | null
  defense_rush_attempts_light_box_percentage: number | null
  defense_rush_attempts_stacked_box_percentage: number | null
}

export interface NflTeamSeasonlogsRow {
  nfl_team: string
  stat_key: string
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  pass_rating: number | null
  pass_yards_per_attempt: number | null
  pass_completion_percentage: number | null
  sacks_taken: number | null
  expected_pass_completion: number | null
  completion_percentage_over_expected: number | null
  dropbacks: number | null
  pass_epa: number | null
  pass_epa_per_dropback: number | null
  average_time_to_throw: number | null
  average_time_to_pressure: number | null
  average_time_to_sack: number | null
  pressures_against: number | null
  pressure_rate_against: number | null
  blitz_rate: number | null
  pass_drops: number | null
  drop_rate: number | null
  pass_completed_air_yards: number | null
  pass_yards_after_catch: number | null
  expected_pass_yards_after_catch: number | null
  pass_yards_after_catch_percentage: number | null
  air_yards_per_pass_attempt: number | null
  average_target_separation: number | null
  deep_pass_attempt_percentage: number | null
  tight_window_percentage: number | null
  play_action_percentage: number | null
  rush_epa: number | null
  rush_epa_per_attempt: number | null
  expected_rush_yards: number | null
  expected_rush_yards_per_attempt: number | null
  rush_yards_over_expected: number | null
  rush_yards_over_expected_per_attempt: number | null
  rush_yards_after_contact: number | null
  rush_yards_after_contact_per_attempt: number | null
  rush_yards_before_contact: number | null
  rush_yards_before_contact_per_attempt: number | null
  rush_success_rate: number | null
  rush_attempts_yards_10_plus: number | null
  rush_attempts_speed_15_plus_mph: number | null
  rush_attempts_speed_20_plus_mph: number | null
  rush_average_time_to_line_of_scrimmage: number | null
  rush_attempts_inside_tackles_percentage: number | null
  rush_attempts_stacked_box_percentage: number | null
  rush_attempts_under_center_percentage: number | null
  longest_rush: number | null
  rush_yards_per_attempt: number | null
  rush_yards_10_plus_rate: number | null
  routes: number | null
  receiving_passer_rating: number | null
  catch_rate: number | null
  expected_catch_rate: number | null
  catch_rate_over_expected: number | null
  receiving_yards_per_reception: number | null
  receiving_yards_per_route: number | null
  receiving_epa: number | null
  receiving_epa_per_target: number | null
  receiving_epa_per_route: number | null
  receiving_drops: number | null
  receiving_drop_rate: number | null
  receiving_yards_after_catch: number | null
  expected_receiving_yards_after_catch: number | null
  receiving_yards_after_catch_over_expected: number | null
  receiving_yards_after_catch_per_reception: number | null
  receiving_average_target_separation: number | null
  receiving_air_yards: number | null
  receiving_air_yards_per_target: number | null
  target_rate: number | null
  average_route_depth: number | null
  endzone_targets: number | null
  endzone_receptions: number | null
  team_target_share: number | null
  team_air_yard_share: number | null
  receiving_deep_target_percentage: number | null
  receiving_tight_window_percentage: number | null
  longest_reception: number | null
  receiving_yards_15_plus_rate: number | null
  receiving_first_downs: number | null
  rushing_first_downs: number | null
  rushing_yards_excluding_kneels: number | null
  fumble_return_touchdowns: number | null
  rushing_first_downs_excluding_touchdowns: number | null
  receiving_first_downs_excluding_touchdowns: number | null
}

export interface NgsProspectScoresHistoryRow {
  pid: string | null
  ngs_athleticism_score: number | null
  ngs_draft_grade: number | null
  nfl_grade: number | null
  ngs_production_score: number | null
  ngs_size_score: number | null
  observed_at: Date | null
}

export interface NgsProspectScoresIndexRow {
  pid: string
  ngs_athleticism_score: number | null
  ngs_draft_grade: number | null
  nfl_grade: number | null
  ngs_production_score: number | null
  ngs_size_score: number | null
  updated_at: Date | null
}

export interface NullsNotDistinctBackup20260903NflPlayStatsRow {
  esbid: number | null
  play_id: number | null
  nfl_team: string | null
  player_name: string | null
  stat_id: number | null
  stat_yards: number | null
  gsis_player_id: string | null
  smart_player_id: string | null
  nfl_team_id: string | null
  is_valid: boolean | null
}

export interface PercentilesRow {
  percentile_key: string
  field: string
  percentile_25: number
  percentile_50: number
  percentile_75: number
  percentile_90: number
  percentile_95: number
  percentile_98: number
  percentile_99: number
  minimum_value: number
  maximum_value: number
}

export interface PffPlayerFacetGamelogsRow {
  pid: string
  esbid: string
  facet: string
  pff_game_id: number | null
  pff_player_id: number | null
  pff_team_id: number | null
  nfl_team: string | null
  player_position: string | null
  facet_payload: any
  updated_at: Date
}

export interface PffPlayerFacetSeasonlogsRow {
  pid: string
  season_year: number
  facet: string
  pff_player_id: number | null
  pff_team_id: number | null
  nfl_team: string | null
  player_position: string | null
  facet_payload: any
  snap_count: number | null
  pff_grade: number | null
  pressures_allowed: number | null
  hurries_allowed: number | null
  hits_allowed: number | null
  sacks_allowed: number | null
  pass_blocking_efficiency: number | null
  pass_block_percent: number | null
  true_pass_set_snaps: number | null
  true_pass_set_grade: number | null
  true_pass_set_pressures_allowed: number | null
  pressure_percentage: number | null
  time_in_pocket: number | null
  targets: number | null
  receptions: number | null
  facet_yards: number | null
  facet_touchdowns: number | null
  updated_at: Date
}

export interface PffPlayerGamelogsRow {
  pid: string
  esbid: string
  season_year: number
  pff_game_id: number | null
  pff_player_id: number | null
  pff_team_id: number | null
  nfl_team: string | null
  player_position: string | null
  grade_offense: number | null
  grade_offense_penalty: number | null
  grade_defense: number | null
  grade_defense_penalty: number | null
  grade_pass: number | null
  grade_run: number | null
  grade_pass_block: number | null
  grade_run_block: number | null
  grade_pass_route: number | null
  grade_hands_drop: number | null
  grade_hands_fumble: number | null
  grade_coverage_defense: number | null
  grade_pass_rush_defense: number | null
  grade_run_defense: number | null
  grade_tackle: number | null
  grade_punter: number | null
  penalties: number | null
  declined_penalties: number | null
  routes: number | null
  yards_per_route_run: number | null
  scrambles: number | null
  snaps_offense_total: number | null
  snaps_offense_pass: number | null
  snaps_offense_run: number | null
  snaps_offense_total_pass: number | null
  snaps_offense_total_run: number | null
  snaps_pass_block: number | null
  snaps_run_block: number | null
  snaps_pass_route: number | null
  passing_snaps: number | null
  passing_dropbacks: number | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_touchdowns: number | null
  passing_interceptions: number | null
  passing_first_downs: number | null
  passing_aimed_passes: number | null
  passing_batted_passes: number | null
  passing_big_time_throws: number | null
  passing_big_time_throw_rate: number | null
  passing_turnover_worthy_plays: number | null
  passing_turnover_worthy_play_rate: number | null
  passing_accuracy_percentage: number | null
  passing_completion_percentage: number | null
  passing_drops: number | null
  passing_drop_rate: number | null
  passing_hit_as_threw: number | null
  passing_sacks: number | null
  passing_sack_percentage: number | null
  passing_spikes: number | null
  passing_throwaways: number | null
  passing_defense_generated_pressures: number | null
  passing_pressure_to_sack_rate: number | null
  passing_quarterback_rating: number | null
  passing_average_depth_of_target: number | null
  passing_average_time_to_throw: number | null
  passing_yards_per_attempt: number | null
  receiving_targets: number | null
  receiving_receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  receiving_first_downs: number | null
  receiving_longest: number | null
  receiving_drops: number | null
  receiving_drop_rate: number | null
  receiving_fumbles: number | null
  receiving_interceptions: number | null
  receiving_caught_percentage: number | null
  receiving_contested_targets: number | null
  receiving_contested_receptions: number | null
  receiving_contested_catch_rate: number | null
  receiving_avoided_tackles: number | null
  receiving_yards_after_catch: number | null
  receiving_yards_after_catch_per_reception: number | null
  receiving_yards_per_reception: number | null
  receiving_average_depth_of_target: number | null
  receiving_targeted_quarterback_rating: number | null
  receiving_pass_plays: number | null
  receiving_pass_blocks: number | null
  receiving_pass_block_rate: number | null
  receiving_route_rate: number | null
  receiving_inline_snaps: number | null
  receiving_inline_rate: number | null
  receiving_slot_snaps: number | null
  receiving_slot_rate: number | null
  receiving_wide_snaps: number | null
  receiving_wide_rate: number | null
  rushing_run_plays: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  rushing_first_downs: number | null
  rushing_longest: number | null
  rushing_fumbles: number | null
  rushing_drops: number | null
  rushing_designed_yards: number | null
  rushing_scramble_yards: number | null
  rushing_total_touches: number | null
  rushing_explosive: number | null
  rushing_gap_attempts: number | null
  rushing_zone_attempts: number | null
  rushing_avoided_tackles: number | null
  rushing_breakaway_attempts: number | null
  rushing_breakaway_yards: number | null
  rushing_breakaway_percentage: number | null
  rushing_elusive_rating: number | null
  rushing_elusive_receiving_missed_tackles_forced: number | null
  rushing_elusive_rushing_missed_tackles_forced: number | null
  rushing_elusive_yards_after_contact: number | null
  rushing_yards_after_contact: number | null
  rushing_yards_after_contact_per_attempt: number | null
  rushing_yards_per_attempt: number | null
  rushing_targets: number | null
  rushing_receptions: number | null
  rushing_receiving_yards: number | null
  defense_snaps: number | null
  defense_snaps_box: number | null
  defense_snaps_corner: number | null
  defense_snaps_coverage: number | null
  defense_snaps_defensive_line: number | null
  defense_snaps_center_guard_gap: number | null
  defense_snaps_guard_tackle_gap: number | null
  defense_snaps_defensive_line_outside_tackle: number | null
  defense_snaps_defensive_line_over_tackle: number | null
  defense_snaps_free_safety: number | null
  defense_snaps_second_level: number | null
  defense_snaps_pass_rush: number | null
  defense_snaps_run_defense: number | null
  defense_snaps_slot: number | null
  defense_tackles: number | null
  defense_assists: number | null
  defense_missed_tackles: number | null
  defense_missed_tackle_rate: number | null
  defense_tackles_for_loss: number | null
  defense_stops: number | null
  defense_sacks: number | null
  defense_hits: number | null
  defense_hurries: number | null
  defense_total_pressures: number | null
  defense_batted_passes: number | null
  defense_pass_breakups: number | null
  defense_interceptions: number | null
  defense_interception_touchdowns: number | null
  defense_forced_fumbles: number | null
  defense_fumble_recoveries: number | null
  defense_fumble_recovery_touchdowns: number | null
  defense_safeties: number | null
  defense_targets_allowed: number | null
  defense_receptions_allowed: number | null
  defense_yards_allowed: number | null
  defense_touchdowns_allowed: number | null
  defense_yards_after_catch_allowed: number | null
  defense_yards_per_reception_allowed: number | null
  defense_longest_reception_allowed: number | null
  defense_catch_rate_allowed: number | null
  defense_quarterback_rating_against: number | null
  punting_snaps: number | null
  punting_attempts: number | null
  punting_yards: number | null
  punting_blocks: number | null
  punting_touchbacks: number | null
  punting_inside_twenty_yard_line: number | null
  punting_downed: number | null
  punting_out_of_bounds: number | null
  punting_fair_catches: number | null
  punting_returns: number | null
  punting_return_yards: number | null
  punting_longest_punt: number | null
  punting_total_net_yards: number | null
  punting_average_net_yards: number | null
  punting_average_yards_per_attempt: number | null
  punting_average_yards_per_return: number | null
  punting_percentage_returned: number | null
  punting_attempts_with_hangtime: number | null
  punting_total_hangtime: number | null
  punting_average_hangtime: number | null
  updated_at: Date
}

export interface PffPlayerSeasonlogsRow {
  pid: string
  season_year: number
  field_goal_extra_point_kicker: number | null
  defense_rank: number | null
  grade_position: string | null
  height: number | null
  run_block: number | null
  offense: number | null
  special_teams: number | null
  offense_snaps: number | null
  special_teams_snaps: number | null
  slug: string | null
  coverage_snaps: number | null
  punter_rank: number | null
  pass_rush: number | null
  punter: number | null
  unit: string | null
  pass_block: number | null
  run_block_snaps: number | null
  draft_pff_team_id: number | null
  draft_league: string | null
  draft_round: number | null
  draft_season: number | null
  draft_selection: number | null
  draft_type: string | null
  offense_ranked: number | null
  player_position: string | null
  defense_snaps: number | null
  pass_snaps: number | null
  name: string | null
  defense: number | null
  current_eligible_year: number | null
  receiving: number | null
  coverage: number | null
  speed_rating: number | null
  run_grade: number | null
  run_defense_snaps: number | null
  defense_ranked: number | null
  pass_rush_snaps: number | null
  college: string | null
  pass_block_snaps: number | null
  pff_player_id: number | null
  run_defense: number | null
  special_teams_rank: number | null
  run_snaps: number | null
  is_meeting_snap_minimum: boolean | null
  kickoff_kicker: number | null
  pass_grade: number | null
  pass_plays: number | null
  weight: number | null
  overall_snaps: number | null
  offense_rank: number | null
  routes: number | null
  season_type: string
}

export interface PffPlayerSeasonlogsChangelogRow {
  id: number
  pid: string
  season_year: number
  column_name: string
  previous_value: string | null
  new_value: string | null
  source: string
  reason: string | null
  changed_at: Date
  season_type: string
}

export interface PffTeamGamelogsRow {
  pff_team_gamelog_id: number
  nfl_team: string
  season_year: number
  week: number
  pff_team_id: number | null
  team_name: string | null
  points_scored: number | null
  points_allowed: number | null
  grades_offense: number | null
  grades_defense: number | null
  grades_special_teams: number | null
  grades_overall: number | null
  grades_pass: number | null
  grades_run: number | null
  grades_pass_block: number | null
  grades_pass_rush_defense: number | null
  grades_run_defense: number | null
  grades_run_block: number | null
  grades_coverage_defense: number | null
  grades_tackle: number | null
  grades_pass_route: number | null
  updated_at: Date
}

export interface PffTeamSeasonlogsRow {
  pff_team_seasonlog_id: number
  nfl_team: string
  season_year: number
  pff_team_id: number | null
  team_name: string | null
  win_count: number | null
  loss_count: number | null
  tie_count: number | null
  points_scored: number | null
  points_allowed: number | null
  grades_offense: number | null
  grades_defense: number | null
  grades_special_teams: number | null
  grades_overall: number | null
  grades_pass: number | null
  grades_run: number | null
  grades_pass_block: number | null
  grades_pass_rush_defense: number | null
  grades_run_defense: number | null
  grades_run_block: number | null
  grades_coverage_defense: number | null
  grades_tackle: number | null
  grades_pass_route: number | null
  updated_at: Date
}

export interface PffUnresolvedPlayersRow {
  pff_player_id: number
  season_year: number
  facet: string
  name: string | null
  pff_position: string | null
  pff_nfl_team: string | null
  nfl_team: string | null
  source_file: string | null
  first_seen: Date
  last_seen: Date
}

export interface PlacedWagersRow {
  wager_id: number
  user_id: number
  public: number | null
  wager_type: PlacedWagersWagerType
  placed_at: Date
  bet_count: number
  selection_count: number
  wager_status: WagerStatus
  bet_wager_amount: number
  total_wager_amount: number
  wager_returned_amount: number
  book_id: PlacedWagersBookId
  book_wager_id: string
  selection_lost: number | null
  selections: any | null
}

export interface PlayChangelogRow {
  id: number
  esbid: number
  play_id: number
  column_name: string
  previous_value: string | null
  new_value: string | null
  source: string
  reason: string | null
  changed_at: Date
}

export interface PlayerRow {
  first_name: string
  last_name: string
  short_name: string
  formatted_name: string
  primary_position: string
  secondary_position: string
  tertiary_position: string | null
  height_inches: number | null
  weight_pounds: number | null
  date_of_birth: string | null
  forty_yard_dash_seconds: number | null
  bench_press_reps: number | null
  vertical_jump_inches: number | null
  broad_jump_inches: number | null
  shuttle_run_seconds: number | null
  three_cone_drill_seconds: number | null
  arm_length_inches: number | null
  hand_size_inches: number | null
  draft_overall_pick: number | null
  draft_round: number | null
  college: string | null
  college_division: string | null
  nfl_draft_year: number | null
  current_nfl_team: string
  position_depth: string | null
  jersey_number: number | null
  draft_capital_points: number | null
  nfl_player_id: number | null
  esb_player_id: string | null
  gsis_player_id: string | null
  smart_player_id: string | null
  gsis_it_player_id: number | null
  high_school: string | null
  sleeper_player_id: string | null
  rotoworld_player_id: number | null
  rotowire_player_id: number | null
  sportradar_player_id: string | null
  espn_player_id: number | null
  fantasy_data_player_id: number | null
  yahoo_player_id: number | null
  keeptradecut_player_id: number | null
  pfr_player_id: string | null
  name_search_vector: unknown | null
  ngs_athleticism_score: number | null
  ngs_draft_grade: number | null
  nfl_grade: number | null
  ngs_production_score: number | null
  ngs_size_score: number | null
  otc_player_id: number | null
  contract_year_signed: number | null
  contract_years: number | null
  contract_value: number | null
  contract_average_annual_value: number | null
  contract_guaranteed: number | null
  contract_average_annual_value_cap_percentage: number | null
  contract_inflated_value: number | null
  contract_inflated_average_annual_value: number | null
  contract_inflated_guaranteed: number | null
  pff_player_id: number | null
  mfl_player_id: number | null
  fleaflicker_player_id: number | null
  cbs_player_id: number | null
  cfbref_player_id: string | null
  twitter_username: string | null
  swish_player_id: number | null
  draftkings_player_id: number | null
  fanduel_player_id: string | null
  rts_player_id: number | null
  draft_team: string | null
  sis_player_id: number | null
  sis_prospect_grade: number | null
  sis_prospect_position_rank: number | null
  sis_prospect_overall_rank: number | null
  all_pro_first_team_selections: number | null
  pro_bowls_selections: number | null
  pfr_years_as_primary_starter: number | null
  pfr_weighted_career_approximate_value: number | null
  pfr_weighted_career_approximate_value_drafted_team: number | null
  ffpc_player_id: number | null
  nffc_player_id: number | null
  fantrax_player_id: string | null
  roster_status: string | null
  game_designation: string | null
  forty_yard_dash_designation: string | null
  ten_yard_split_seconds: number | null
  ten_yard_split_designation: string | null
  pro_day_forty_seconds: number | null
  pro_day_forty_designation: string | null
  sixty_yard_shuttle_seconds: number | null
  sixty_yard_shuttle_designation: string | null
  has_combine_attendance: boolean | null
  hometown: string | null
  sumer_player_id: string | null
  fantasylabs_player_id: number | null
  underdog_player_id: string | null
  pid: string
  fantasypoints_player_id: string | null
}

export interface PlayerAdpHistoryRow {
  pid: string | null
  player_position: string
  season_year: number | null
  average_draft_position: number | null
  min_pick: number | null
  max_pick: number | null
  standard_deviation: number | null
  sample_size: number | null
  percent_drafted: number | null
  observed_at: Date
  source_id: AdpSourceId | null
  average_draft_position_format_id: string
}

export interface PlayerAdpIndexRow {
  pid: string
  player_position: string
  season_year: number
  average_draft_position: number | null
  min_pick: number | null
  max_pick: number | null
  standard_deviation: number | null
  sample_size: number | null
  percent_drafted: number | null
  source_id: AdpSourceId
  average_draft_position_format_id: string
}

export interface PlayerAliasesRow {
  pid: string
  formatted_alias: string
  source: string | null
}

export interface PlayerArchetypesRow {
  pid: string
  season_year: number
  primary_position: string | null
  archetype: string
  rushing_rate: number | null
  target_share: number | null
  opportunity_share: number | null
  calculated_at: Date | null
  confidence: number | null
}

export interface PlayerChangelogRow {
  id: number
  pid: string | null
  column_name: string
  previous_value: string | null
  new_value: string | null
  source: string
  reason: string | null
  changed_at: Date
}

export interface PlayerCollegeCareerlogsRow {
  pid: string
  team_name: string | null
  games_played: number | null
  games_started: number | null
  snap_count: number | null
  total_touchdowns: number | null
  position_name: string | null
  height: number | null
  height_is_pro_day: boolean | null
  weight: number | null
  weight_is_pro_day: boolean | null
  arm_length: number | null
  arms_is_pro_day: boolean | null
  hand_size: number | null
  hands_is_pro_day: boolean | null
  forty_yard_dash: number | null
  forty_yard_dash_is_pro_day: boolean | null
  three_cone: number | null
  three_cone_is_pro_day: boolean | null
  bench_press: number | null
  bench_is_pro_day: boolean | null
  broad_jump: number | null
  broad_jump_is_pro_day: boolean | null
  vertical_jump: number | null
  vertical_jump_is_pro_day: boolean | null
  shuttle: number | null
  shuttle_is_pro_day: boolean | null
  completions: number | null
  completion_percentage: number | null
  average_depth_of_target: number | null
  interceptions: number | null
  receptions: number | null
  targets: number | null
  pass_block_points: number | null
  pass_block_points_rating: number | null
  blown_block_percentage_pass: number | null
  blown_block_percentage_run: number | null
  blown_blocks: number | null
  blown_blocks_pressure: number | null
  blown_blocks_run: number | null
  blown_blocks_sack: number | null
  false_start_penalties: number | null
  gap_blocking_percentage: number | null
  holding_penalties: number | null
  pass_snaps: number | null
  run_block_points: number | null
  run_block_points_rating: number | null
  run_snaps: number | null
  zone_blocking_percentage: number | null
  adjusted_tackle_depth_plus: number | null
  blitz_percentage: number | null
  bounce_percentage_run_behind: number | null
  bounce_percentage_when_run_at: number | null
  box_percentage: number | null
  broken_missed_tackle_percentage: number | null
  broken_missed_tackles: number | null
  broken_tackle_percentage: number | null
  broken_tackles: number | null
  defensive_end_percentage: number | null
  defensive_tackle_percentage: number | null
  dropped_interceptions: number | null
  epa: number | null
  epa_per_attempt_run_behind: number | null
  forced_fumbles: number | null
  hand_on_ball_percentage: number | null
  quarterback_hits: number | null
  holding_penalties_drawn: number | null
  hurries: number | null
  knockdowns: number | null
  man_coverage_percentage: number | null
  missed_tackle_percentage: number | null
  missed_tackles: number | null
  nose_tackle_percentage: number | null
  pass_breakups: number | null
  pass_coverage_points: number | null
  pass_coverage_points_press: number | null
  pass_coverage_points_slot: number | null
  pass_coverage_points_wide: number | null
  pass_coverage_points_rating: number | null
  pass_deflections: number | null
  pass_rush_percentage: number | null
  pass_rush_points: number | null
  pass_rush_points_rating: number | null
  positive_percentage: number | null
  positive_percentage_gap: number | null
  positive_percentage_man: number | null
  positive_percentage_man_alternate: number | null
  positive_percentage_run_behind: number | null
  positive_percentage_vs_man: number | null
  positive_percentage_vs_zone: number | null
  positive_percentage_when_run_at: number | null
  positive_percentage_zone: number | null
  press_coverage_percentage: number | null
  pressure_percentage: number | null
  pressure_percentage_plus_minus: number | null
  pressures: number | null
  pressure_share: number | null
  quick_pressure_percentage: number | null
  run_behind_percentage: number | null
  run_defense_points: number | null
  run_defense_points_rating: number | null
  sack_epa: number | null
  sack_percentage: number | null
  defensive_sacks: number | null
  tackle_for_loss_epa: number | null
  tackles: number | null
  tackles_for_loss: number | null
  tackle_share: number | null
  targets_man: number | null
  targets_secondary_defender: number | null
  three_point_stance_percentage: number | null
  true_pressure_percentage: number | null
  broken_missed_tackles_per_reception: number | null
  catchable_catch_percentage: number | null
  completed_air_yards: number | null
  deep_route_percentage: number | null
  deserved_catch_percentage: number | null
  dropped_passes: number | null
  receiving_epa_per_target: number | null
  on_target_catch_percentage: number | null
  receiver_points: number | null
  receiver_points_slot: number | null
  receiver_points_split: number | null
  receiver_points_tight: number | null
  receiver_points_wide: number | null
  receiver_points_rating: number | null
  receiver_rating: number | null
  routes: number | null
  slot_percentage: number | null
  targets_above_expectation: number | null
  target_share: number | null
  receiving_yards: number | null
  yards_after_catch: number | null
  yards_after_catch_per_completion: number | null
  yards_after_catch_per_reception: number | null
  yards_before_contact_per_attempt_run_behind: number | null
  yards_per_attempt_gap: number | null
  yards_per_attempt_run_behind: number | null
  yards_per_attempt_zone: number | null
  yards_per_coverage_snap: number | null
  yards_per_coverage_snap_man: number | null
  yards_per_coverage_snap_zone: number | null
  yards_per_route: number | null
  yards_per_target: number | null
  yards_per_target_man: number | null
  blocking_points: number | null
  blocking_points_rating: number | null
  pass_pro_snaps_per_game: number | null
  total_points: number | null
  total_points_rating: number | null
  three_cone_is_unofficial: boolean | null
  forty_yard_dash_is_unofficial: boolean | null
  adjusted_net_yards_per_attempt: number | null
  average_depth_of_completion: number | null
  arms_is_unofficial: boolean | null
  bench_is_unofficial: boolean | null
  boom_percentage: number | null
  broad_jump_is_unofficial: boolean | null
  broken_missed_tackles_per_100_defensive_backs: number | null
  broken_tackles_per_100_touches: number | null
  bust_percentage: number | null
  catchable_percentage: number | null
  epa_per_dropback: number | null
  fumbles_per_100_touches: number | null
  hands_is_unofficial: boolean | null
  heavy_box_percentage: number | null
  height_is_unofficial: boolean | null
  iqr: number | null
  iqr_deep: number | null
  iqr_intermediate: number | null
  iqr_no_pressure: number | null
  iqr_pressure: number | null
  iqr_short: number | null
  iqr_vs_man: number | null
  iqr_vs_zone: number | null
  missed_tackles_per_100_touches: number | null
  on_target_percentage: number | null
  pass_attempts: number | null
  passer_points: number | null
  passer_points_rating: number | null
  pass_touchdowns: number | null
  pass_yards: number | null
  pass_yards_per_attempt: number | null
  expected_completion_percentage: number | null
  completion_percentage_plus_minus: number | null
  positive_percentage_hit_at_line: number | null
  positive_percentage_inside: number | null
  positive_percentage_outside: number | null
  quarterback_rating: number | null
  receiving_epa: number | null
  receiving_touchdowns: number | null
  rush_attempts: number | null
  rush_epa: number | null
  rush_epa_per_attempt: number | null
  rusher_points: number | null
  rusher_points_rating: number | null
  rush_yards: number | null
  rush_yards_per_attempt: number | null
  scrambles: number | null
  shuttle_is_unofficial: boolean | null
  snap_to_throw_plus_minus: number | null
  split_out_percentage: number | null
  throw_air_time_plus_minus: number | null
  vertical_jump_is_unofficial: boolean | null
  weight_is_unofficial: boolean | null
  yards_after_contact_per_attempt: number | null
  created_at: Date | null
  updated_at: Date | null
}

export interface PlayerCollegeSeasonlogsRow {
  pid: string
  season_year: number
  team_name: string | null
  games_played: number | null
  games_started: number | null
  snap_count: number | null
  total_touchdowns: number | null
  position_name: string | null
  height: number | null
  height_is_pro_day: boolean | null
  weight: number | null
  weight_is_pro_day: boolean | null
  arm_length: number | null
  arms_is_pro_day: boolean | null
  hand_size: number | null
  hands_is_pro_day: boolean | null
  forty_yard_dash: number | null
  forty_yard_dash_is_pro_day: boolean | null
  three_cone: number | null
  three_cone_is_pro_day: boolean | null
  bench_press: number | null
  bench_is_pro_day: boolean | null
  broad_jump: number | null
  broad_jump_is_pro_day: boolean | null
  vertical_jump: number | null
  vertical_jump_is_pro_day: boolean | null
  shuttle: number | null
  shuttle_is_pro_day: boolean | null
  completions: number | null
  completion_percentage: number | null
  average_depth_of_target: number | null
  interceptions: number | null
  receptions: number | null
  targets: number | null
  pass_block_points: number | null
  pass_block_points_rating: number | null
  blown_block_percentage_pass: number | null
  blown_block_percentage_run: number | null
  blown_blocks: number | null
  blown_blocks_pressure: number | null
  blown_blocks_run: number | null
  blown_blocks_sack: number | null
  false_start_penalties: number | null
  gap_blocking_percentage: number | null
  holding_penalties: number | null
  pass_snaps: number | null
  run_block_points: number | null
  run_block_points_rating: number | null
  run_snaps: number | null
  zone_blocking_percentage: number | null
  adjusted_tackle_depth_plus: number | null
  blitz_percentage: number | null
  bounce_percentage_run_behind: number | null
  bounce_percentage_when_run_at: number | null
  box_percentage: number | null
  broken_missed_tackle_percentage: number | null
  broken_missed_tackles: number | null
  broken_tackle_percentage: number | null
  broken_tackles: number | null
  defensive_end_percentage: number | null
  defensive_tackle_percentage: number | null
  dropped_interceptions: number | null
  epa: number | null
  epa_per_attempt_run_behind: number | null
  forced_fumbles: number | null
  hand_on_ball_percentage: number | null
  quarterback_hits: number | null
  holding_penalties_drawn: number | null
  hurries: number | null
  knockdowns: number | null
  man_coverage_percentage: number | null
  missed_tackle_percentage: number | null
  missed_tackles: number | null
  nose_tackle_percentage: number | null
  pass_breakups: number | null
  pass_coverage_points: number | null
  pass_coverage_points_press: number | null
  pass_coverage_points_slot: number | null
  pass_coverage_points_wide: number | null
  pass_coverage_points_rating: number | null
  pass_deflections: number | null
  pass_rush_percentage: number | null
  pass_rush_points: number | null
  pass_rush_points_rating: number | null
  positive_percentage: number | null
  positive_percentage_gap: number | null
  positive_percentage_man: number | null
  positive_percentage_man_alternate: number | null
  positive_percentage_run_behind: number | null
  positive_percentage_vs_man: number | null
  positive_percentage_vs_zone: number | null
  positive_percentage_when_run_at: number | null
  positive_percentage_zone: number | null
  press_coverage_percentage: number | null
  pressure_percentage: number | null
  pressure_percentage_plus_minus: number | null
  pressures: number | null
  pressure_share: number | null
  quick_pressure_percentage: number | null
  run_behind_percentage: number | null
  run_defense_points: number | null
  run_defense_points_rating: number | null
  sack_epa: number | null
  sack_percentage: number | null
  defensive_sacks: number | null
  tackle_for_loss_epa: number | null
  tackles: number | null
  tackles_for_loss: number | null
  tackle_share: number | null
  targets_man: number | null
  targets_secondary_defender: number | null
  three_point_stance_percentage: number | null
  true_pressure_percentage: number | null
  broken_missed_tackles_per_reception: number | null
  catchable_catch_percentage: number | null
  completed_air_yards: number | null
  deep_route_percentage: number | null
  deserved_catch_percentage: number | null
  dropped_passes: number | null
  receiving_epa_per_target: number | null
  on_target_catch_percentage: number | null
  receiver_points: number | null
  receiver_points_slot: number | null
  receiver_points_split: number | null
  receiver_points_tight: number | null
  receiver_points_wide: number | null
  receiver_points_rating: number | null
  receiver_rating: number | null
  routes: number | null
  slot_percentage: number | null
  targets_above_expectation: number | null
  target_share: number | null
  receiving_yards: number | null
  yards_after_catch: number | null
  yards_after_catch_per_completion: number | null
  yards_after_catch_per_reception: number | null
  yards_before_contact_per_attempt_run_behind: number | null
  yards_per_attempt_gap: number | null
  yards_per_attempt_run_behind: number | null
  yards_per_attempt_zone: number | null
  yards_per_coverage_snap: number | null
  yards_per_coverage_snap_man: number | null
  yards_per_coverage_snap_zone: number | null
  yards_per_route: number | null
  yards_per_target: number | null
  yards_per_target_man: number | null
  blocking_points: number | null
  blocking_points_rating: number | null
  pass_pro_snaps_per_game: number | null
  total_points: number | null
  total_points_rating: number | null
  three_cone_is_unofficial: boolean | null
  forty_yard_dash_is_unofficial: boolean | null
  adjusted_net_yards_per_attempt: number | null
  average_depth_of_completion: number | null
  arms_is_unofficial: boolean | null
  bench_is_unofficial: boolean | null
  boom_percentage: number | null
  broad_jump_is_unofficial: boolean | null
  broken_missed_tackles_per_100_defensive_backs: number | null
  broken_tackles_per_100_touches: number | null
  bust_percentage: number | null
  catchable_percentage: number | null
  epa_per_dropback: number | null
  fumbles_per_100_touches: number | null
  hands_is_unofficial: boolean | null
  heavy_box_percentage: number | null
  height_is_unofficial: boolean | null
  iqr: number | null
  iqr_deep: number | null
  iqr_intermediate: number | null
  iqr_no_pressure: number | null
  iqr_pressure: number | null
  iqr_short: number | null
  iqr_vs_man: number | null
  iqr_vs_zone: number | null
  missed_tackles_per_100_touches: number | null
  on_target_percentage: number | null
  pass_attempts: number | null
  passer_points: number | null
  passer_points_rating: number | null
  pass_touchdowns: number | null
  pass_yards: number | null
  pass_yards_per_attempt: number | null
  expected_completion_percentage: number | null
  completion_percentage_plus_minus: number | null
  positive_percentage_hit_at_line: number | null
  positive_percentage_inside: number | null
  positive_percentage_outside: number | null
  quarterback_rating: number | null
  receiving_epa: number | null
  receiving_touchdowns: number | null
  rush_attempts: number | null
  rush_epa: number | null
  rush_epa_per_attempt: number | null
  rusher_points: number | null
  rusher_points_rating: number | null
  rush_yards: number | null
  rush_yards_per_attempt: number | null
  scrambles: number | null
  shuttle_is_unofficial: boolean | null
  snap_to_throw_plus_minus: number | null
  split_out_percentage: number | null
  throw_air_time_plus_minus: number | null
  vertical_jump_is_unofficial: boolean | null
  weight_is_unofficial: boolean | null
  yards_after_contact_per_attempt: number | null
  created_at: Date | null
  updated_at: Date | null
}

export interface PlayerContractsRow {
  pid: string
  season_year: string
  nfl_team: string | null
  base_salary: number | null
  prorated_bonus: number | null
  roster_bonus: number | null
  guaranteed_salary: number | null
  cap_number: number | null
  cap_percent: number | null
  cash_paid: number | null
  workout_bonus: number | null
  other_bonus: number | null
  per_game_roster_bonus: number | null
  option_bonus: number | null
}

export interface PlayerDefenderGamelogsRow {
  esbid: number
  pid: string
  season_year: number
  pass_rush_snaps: number | null
  pass_coverage_snaps: number | null
  tackles: number | null
  tackle_stops: number | null
  hustle_stops: number | null
  pressures_generated: number | null
  defensive_sacks: number | null
  coverage_snaps_nearest_defender: number | null
  targets_nearest_defender: number | null
  receptions_nearest_defender: number | null
  receiving_yards_nearest_defender: number | null
  receiving_touchdowns_nearest_defender: number | null
  passer_rating_nearest_defender: number | null
  target_epa_nearest_defender: number | null
  yards_per_reception_nearest_defender: number | null
  average_target_separation_allowed: number | null
  defensive_interceptions: number | null
  time_to_sack: number | null
  quick_sacks: number | null
  time_to_pressure: number | null
  quick_pressures: number | null
  pass_rush_get_off: number | null
  pressure_turnovers: number | null
  pressures_generated_rate: number | null
  catch_rate_nearest_defender: number | null
  catch_rate_over_expected_nearest_defender: number | null
  target_rate_nearest_defender: number | null
  tight_window_forced_percentage: number | null
  ball_hawk_percentage: number | null
}

export interface PlayerDfsOwnershipRow {
  pid: string
  source_contest_id: string
  source_id: DfsSourceId
  source_draft_group_id: string | null
  ownership_percentage: number | null
  roster_position: string | null
  fantasy_points: number | null
  source_player_display_name: string | null
  season_year: number | null
  week: number | null
  created_at: Date | null
}

export interface PlayerFieldOverrideRow {
  pid: string
  column_name: string
  override_value: string | null
  provider_name: string
  adjudicated_by: string
  adjudicated_at: Date
  evidence_source: string
  reason: string
}

export interface PlayerGameOutcomeCorrelationsRow {
  pid: string
  season_year: number
  outcome_type: string
  correlation: number | null
  games_sample: number
  leading_games: number | null
  trailing_games: number | null
  leading_fantasy_points_per_game: number | null
  trailing_fantasy_points_per_game: number | null
  overall_fantasy_points_per_game: number | null
  confidence: number | null
  calculated_at: Date | null
}

export interface PlayerGamelogsRow {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsDefaultRow {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2000Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2001Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2002Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2003Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2004Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2005Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2006Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2007Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2008Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2009Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2010Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2011Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2012Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2013Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2014Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2015Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2016Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2017Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2018Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2019Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2020Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2021Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2022Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2023Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2024Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2025Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerGamelogsYear2026Row {
  esbid: number
  pid: string
  opponent_nfl_team: string
  nfl_team: string
  player_position: string
  jersey_number: number | null
  is_active: boolean | null
  is_starter: boolean | null
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  career_game: number | null
  season_year: number
  snaps_offense: number | null
  snaps_offense_percentage: number | null
  snaps_defense: number | null
  snaps_defense_percentage: number | null
  snaps_special_teams: number | null
  snaps_special_teams_percentage: number | null
  snaps_pass: number | null
  snaps_pass_percentage: number | null
  snaps_rush: number | null
  snaps_rush_percentage: number | null
  snaps_inside_five_yards: number | null
  snaps_inside_five_yards_percentage: number | null
  snaps_inside_ten_yards: number | null
  snaps_inside_ten_yards_percentage: number | null
  snaps_inside_twenty_yards: number | null
  snaps_inside_twenty_yards_percentage: number | null
  snaps_leading: number | null
  snaps_leading_percentage: number | null
  snaps_trailing: number | null
  snaps_trailing_percentage: number | null
  snaps_neutral: number | null
  snaps_neutral_percentage: number | null
  snaps_no_huddle: number | null
  snaps_no_huddle_percentage: number | null
  snaps_under_two_minutes: number | null
  snaps_under_two_minutes_percentage: number | null
  snaps_low_probability: number | null
  snaps_low_probability_percentage: number | null
  snaps_neutral_short: number | null
  snaps_neutral_short_percentage: number | null
  snaps_neutral_long: number | null
  snaps_neutral_long_percentage: number | null
  snaps_neutral_early_down: number | null
  snaps_neutral_early_down_percentage: number | null
  snaps_neutral_late_down: number | null
  snaps_neutral_late_down_percentage: number | null
  snaps_under_five_minutes: number | null
  snaps_under_five_minutes_percentage: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  is_ruled_out_in_game: boolean | null
  fumble_return_touchdowns: number | null
  quarter_1_snaps_offense: number | null
  quarter_1_snaps_offense_percentage: number | null
  quarter_2_snaps_offense: number | null
  quarter_2_snaps_offense_percentage: number | null
  quarter_3_snaps_offense: number | null
  quarter_3_snaps_offense_percentage: number | null
  quarter_4_snaps_offense: number | null
  quarter_4_snaps_offense_percentage: number | null
  quarter_1_snaps_defense: number | null
  quarter_1_snaps_defense_percentage: number | null
  quarter_2_snaps_defense: number | null
  quarter_2_snaps_defense_percentage: number | null
  quarter_3_snaps_defense: number | null
  quarter_3_snaps_defense_percentage: number | null
  quarter_4_snaps_defense: number | null
  quarter_4_snaps_defense_percentage: number | null
  source: string | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerPairCorrelationsRow {
  pid_first: string
  pid_second: string
  season_year: number
  nfl_team_first: string | null
  nfl_team_second: string | null
  games_together: number
  correlation: number | null
  relationship_type: string
  calculated_at: Date | null
}

export interface PlayerPassingGamelogsRow {
  esbid: number
  pid: string
  season_year: number
  pass_rating: number | null
  pass_yards_per_attempt: number | null
  passing_sacks: number | null
  dropbacks: number | null
  pass_epa: number | null
  pass_epa_per_dropback: number | null
  average_time_to_throw: number | null
  average_time_to_pressure: number | null
  average_time_to_sack: number | null
  pressures_against: number | null
  pass_drops: number | null
  pass_completed_air_yards: number | null
  pass_yards_after_catch: number | null
  expected_pass_yards_after_catch: number | null
  air_yards_per_pass_attempt: number | null
  average_target_separation: number | null
  pass_completion_percentage: number | null
  expected_pass_completion: number | null
  completion_percentage_over_expected: number | null
  pressure_rate_against: number | null
  blitz_rate: number | null
  drop_rate: number | null
  pass_yards_after_catch_percentage: number | null
  deep_pass_attempt_percentage: number | null
  tight_window_percentage: number | null
  play_action_percentage: number | null
}

export interface PlayerProspectProfileRow {
  pid: string
  sis_player_id: number | null
  name: string | null
  primary_position: string | null
  jersey_number: string | null
  class: string | null
  weight: number | null
  height: number | null
  hometown: string | null
  summary: string | null
  overall_grade: number | null
  overall_pick: number | null
  picked_by_team: string | null
  draft_class: string | null
  overall_rank: number | null
  position_rank: number | null
  has_been_drafted: boolean | null
  draft_round: number | null
  draft_round_pick: number | null
  headshot_url: string | null
  team_name: string | null
  team_abbreviation: string | null
  sis_team_id: number | null
  strengths: any | null
  weaknesses: any | null
  scouting_report: string | null
  pass_game_report: string | null
  run_game_report: string | null
  last_word_report: string | null
  scout_name: string | null
  critical_factor_blocking_ability: number | null
  critical_factor_receiving_ability: number | null
  critical_factor_football_intelligence: number | null
  critical_factor_vision: number | null
  critical_factor_contact_balance: number | null
  critical_factor_passing_game_impact: number | null
  critical_factor_pass_coverage: number | null
  critical_factor_play_speed: number | null
  critical_factor_football_intelligence_instincts: number | null
  critical_factor_hands: number | null
  critical_factor_separation: number | null
  critical_factor_run_after_catch: number | null
  critical_factor_accuracy: number | null
  critical_factor_decision_making_mental: number | null
  critical_factor_clutch_performance: number | null
  critical_factor_three_level_impact: number | null
  critical_factor_anchor_play_strength: number | null
  critical_factor_mismatch: number | null
  critical_factor_body_control: number | null
  critical_factor_reactive_athleticism: number | null
  critical_factor_ball_skills: number | null
  critical_factor_three_down_ability: number | null
  critical_factor_first_step_explosion: number | null
  critical_factor_play_strength: number | null
  critical_factor_pass_rush: number | null
  critical_factor_point_of_attack_set_edge: number | null
  positional_factor_run_block: number | null
  positional_factor_pass_block: number | null
  positional_factor_play_strength: number | null
  positional_factor_play_speed: number | null
  positional_factor_mismatch: number | null
  positional_factor_release: number | null
  positional_factor_catching_skills: number | null
  positional_factor_catching_skill: number | null
  positional_factor_separation: number | null
  positional_factor_run_after_catch: number | null
  positional_factor_clutch_performance: number | null
  positional_factor_toughness: number | null
  positional_factor_special_teams_value: number | null
  positional_factor_elusiveness: number | null
  positional_factor_power: number | null
  positional_factor_playmaker: number | null
  positional_factor_pass_protection: number | null
  positional_factor_ball_security: number | null
  positional_factor_three_level_impact: number | null
  positional_factor_quarterback_defense: number | null
  positional_factor_man_coverage: number | null
  positional_factor_zone_coverage: number | null
  positional_factor_range: number | null
  positional_factor_blitz: number | null
  positional_factor_stoutness: number | null
  positional_factor_shed_ability: number | null
  positional_factor_navigate_trash: number | null
  positional_factor_tackling: number | null
  positional_factor_route_running: number | null
  positional_factor_route_savvy: number | null
  positional_factor_contested_catch: number | null
  positional_factor_tracking: number | null
  positional_factor_body_control: number | null
  positional_factor_blocking: number | null
  positional_factor_short_accuracy: number | null
  positional_factor_deep_accuracy: number | null
  positional_factor_pocket_awareness: number | null
  positional_factor_footwork: number | null
  positional_factor_under_pressure: number | null
  positional_factor_mobility: number | null
  positional_factor_arm_strength: number | null
  positional_factor_awkward_throw: number | null
  positional_factor_eye_discipline: number | null
  positional_factor_leadership: number | null
  positional_factor_body_composition: number | null
  positional_factor_ball_skills_tracking: number | null
  positional_factor_physicality: number | null
  positional_factor_communication: number | null
  positional_factor_pass_rush: number | null
  positional_factor_on_ball_impact: number | null
  positional_factor_disruption: number | null
  positional_factor_hand_use: number | null
  positional_factor_football_intelligence: number | null
  positional_factor_stamina: number | null
  positional_factor_awareness: number | null
  positional_factor_second_level: number | null
  positional_factor_sustain: number | null
  positional_factor_finish: number | null
  positional_factor_flexibility: number | null
  positional_factor_off_man_coverage: number | null
  positional_factor_press_man_coverage: number | null
  positional_factor_slot_coverage: number | null
  positional_factor_transition: number | null
  positional_factor_closing_speed: number | null
  positional_factor_mental_toughness: number | null
  positional_factor_open_field_tackling: number | null
  positional_factor_run_support: number | null
  positional_factor_agility: number | null
  positional_factor_discipline: number | null
  positional_factor_motor: number | null
  positional_factor_pass_rush_repertoire: number | null
  positional_factor_bend: number | null
  positional_factor_flat_coverage: number | null
  combine_height: number | null
  combine_weight: number | null
  combine_arm_length: number | null
  combine_hand_size: number | null
  combine_forty_yard_dash: number | null
  combine_bench_press: number | null
  combine_vertical_jump: number | null
  combine_broad_jump: number | null
  combine_three_cone: number | null
  combine_shuttle: number | null
  combine_height_percentile: number | null
  combine_weight_percentile: number | null
  combine_arm_length_percentile: number | null
  combine_hand_size_percentile: number | null
  combine_forty_yard_dash_percentile: number | null
  combine_bench_press_percentile: number | null
  combine_vertical_jump_percentile: number | null
  combine_broad_jump_percentile: number | null
  combine_three_cone_percentile: number | null
  combine_shuttle_percentile: number | null
  combine_height_is_pro_day: boolean | null
  combine_weight_is_pro_day: boolean | null
  combine_arm_length_is_pro_day: boolean | null
  combine_hand_size_is_pro_day: boolean | null
  combine_forty_yard_dash_is_pro_day: boolean | null
  combine_bench_press_is_pro_day: boolean | null
  combine_vertical_jump_is_pro_day: boolean | null
  combine_broad_jump_is_pro_day: boolean | null
  combine_three_cone_is_pro_day: boolean | null
  combine_shuttle_is_pro_day: boolean | null
  stat_total_points_per_game: number | null
  stat_total_points_per_game_pass_coverage: number | null
  stat_yards_per_route: number | null
  stat_total_points_rating_overall: number | null
  stat_total_points_rating_receiving: number | null
  stat_total_points_rating_blocking: number | null
  stat_blown_block_percentage_pass: number | null
  stat_blown_block_percentage_rush: number | null
  stat_catchable_catch_percentage: number | null
  stat_target_share: number | null
  stat_yards_after_catch_per_game: number | null
  stat_broken_missed_tackle_per_reception: number | null
  stat_total_points_rating_rushing: number | null
  stat_total_points_pass_block: number | null
  stat_positive_percentage: number | null
  stat_boom_percentage: number | null
  stat_broken_tackle_per_100_touch: number | null
  stat_missed_tackle_per_100_touch: number | null
  stat_yards_after_catch_per_attempt: number | null
  stat_total_points_rating_pass_coverage: number | null
  stat_total_points_rating_run_defense: number | null
  stat_total_points_rating_pass_rush: number | null
  stat_hand_on_ball_percentage: number | null
  stat_adjusted_tackle_depth_plus: number | null
  stat_broken_missed_tackle_percentage: number | null
  stat_tackle_share: number | null
  stat_total_points_per_game_slot: number | null
  stat_total_points_per_game_wide: number | null
  stat_target_percentage_plus_minus: number | null
  stat_deep_route_percentage: number | null
  stat_unique_routes: number | null
  stat_yards_after_catch_per_reception: number | null
  stat_total_points_rating_passing: number | null
  stat_iqr: number | null
  stat_snap_throw_plus_minus: number | null
  stat_air_time_plus_minus: number | null
  stat_catchable_percentage: number | null
  stat_on_target_percentage: number | null
  stat_adjusted_net_yards_per_attempt: number | null
  stat_deserved_catch_percentage: number | null
  stat_slot_percentage: number | null
  stat_box_percentage: number | null
  stat_total_points_rating_pass_block: number | null
  stat_total_points_rating_run_block: number | null
  stat_blown_block_percentage: number | null
  stat_run_behind_percentage: number | null
  stat_positive_percentage_run_behind: number | null
  stat_bounce_percentage: number | null
  stat_yards_before_contact_per_attempt: number | null
  stat_total_points_per_game_press_coverage: number | null
  stat_yards_per_coverage_snap: number | null
  stat_yards_per_snap_man: number | null
  stat_yards_per_snap_zone: number | null
  stat_tackles_for_loss_per_game: number | null
  stat_pressure_percentage_plus_minus: number | null
  stat_true_pressure_percentage: number | null
  stat_quick_pressure_percentage: number | null
  stat_pressure_share: number | null
  stat_total_points_per_game_rank: number | null
  stat_total_points_per_game_pass_coverage_rank: number | null
  stat_yards_per_route_rank: number | null
  stat_total_points_rating_overall_rank: number | null
  stat_total_points_rating_receiving_rank: number | null
  stat_total_points_rating_blocking_rank: number | null
  created_at: Date | null
  updated_at: Date | null
}

export interface PlayerRankingsHistoryRow {
  pid: string | null
  player_position: string
  season_year: number | null
  min_rank: number | null
  max_rank: number | null
  average_rank: number | null
  rank_standard_deviation: number | null
  overall_rank: number | null
  position_rank: number | null
  observed_at: Date
  source_id: RankingsSourceId | null
  ranking_type: RankingType
}

export interface PlayerRankingsIndexRow {
  pid: string
  player_position: string
  season_year: number
  min_rank: number | null
  max_rank: number | null
  average_rank: number | null
  rank_standard_deviation: number | null
  overall_rank: number | null
  position_rank: number | null
  source_id: RankingsSourceId
  ranking_type: RankingType
}

export interface PlayerReceivingGamelogsRow {
  esbid: number
  pid: string
  season_year: number
  routes: number | null
  receiving_passer_rating: number | null
  catch_rate: number | null
  expected_catch_rate: number | null
  catch_rate_over_expected: number | null
  receiving_yards_per_reception: number | null
  receiving_yards_per_route: number | null
  receiving_epa: number | null
  receiving_epa_per_target: number | null
  receiving_epa_per_route: number | null
  receiving_drops: number | null
  receiving_drop_rate: number | null
  receiving_yards_after_catch: number | null
  expected_receiving_yards_after_catch: number | null
  receiving_yards_after_catch_over_expected: number | null
  receiving_yards_after_catch_per_reception: number | null
  receiving_average_target_separation: number | null
  receiving_air_yards: number | null
  receiving_air_yards_per_target: number | null
  target_rate: number | null
  average_route_depth: number | null
  endzone_targets: number | null
  endzone_receptions: number | null
  receiving_deep_target_percentage: number | null
  receiving_tight_window_percentage: number | null
  longest_reception: number | null
  receiving_yards_15_plus_rate: number | null
  weighted_opportunity_rating: number | null
  redzone_targets: number | null
  route_share: number | null
  receiving_yards_15_plus_count: number | null
  team_target_share: number | null
  team_air_yard_share: number | null
}

export interface PlayerRushingGamelogsRow {
  esbid: number
  pid: string
  season_year: number
  rush_epa: number | null
  rush_epa_per_attempt: number | null
  expected_rush_yards: number | null
  expected_rush_yards_per_attempt: number | null
  rush_yards_over_expected: number | null
  rush_yards_over_expected_per_attempt: number | null
  rush_yards_after_contact: number | null
  rush_yards_after_contact_per_attempt: number | null
  rush_yards_before_contact: number | null
  rush_yards_before_contact_per_attempt: number | null
  rush_success_rate: number | null
  rush_attempts_yards_10_plus: number | null
  rush_attempts_speed_15_plus_mph: number | null
  rush_attempts_speed_20_plus_mph: number | null
  rush_average_time_to_line_of_scrimmage: number | null
  rush_attempts_inside_tackles_percentage: number | null
  rush_attempts_stacked_box_percentage: number | null
  rush_attempts_under_center_percentage: number | null
  longest_rush: number | null
  rush_yards_per_attempt: number | null
  rush_yards_10_plus_rate: number | null
  weighted_opportunity: number | null
  rush_attempts_redzone: number | null
  rush_attempts_goal_line: number | null
  rush_share: number | null
}

export interface PlayerSalariesRow {
  pid: string | null
  esbid: number | null
  source_competition_name: string | null
  source_player_display_name: string | null
  source_contest_id: string
  salary: number | null
  created_at: Date | null
  source_id: DfsSourceId
}

export interface PlayerSeasonlogsRow {
  pid: string
  season_year: number
  season_type: string
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  fumbles_lost: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  two_point_conversions: number | null
  punt_return_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  espn_open_score: number | null
  espn_catch_score: number | null
  espn_overall_score: number | null
  espn_yac_score: number | null
  espn_rtm_routes: number | null
  espn_rtm_targets: number | null
  espn_rtm_receiving_yards: number | null
  career_year: number | null
  pfr_season_value: number | null
  rushing_first_downs: number
  receiving_first_downs: number
  rushing_yards_excluding_kneels: number
  fumble_return_touchdowns: number | null
  rushing_first_downs_excluding_touchdowns: number
  receiving_first_downs_excluding_touchdowns: number
}

export interface PlayerTeamExtensionStateRow {
  lid: number
  tid: number
  pid: string
  extension_count: number
  franchise_tag_history_years: number[] | null
  rookie_tag_used_year: number | null
  last_reset_event: number | null
  last_refreshed_at: Date
}

export interface PlayerVarianceRow {
  pid: string
  season_year: number
  games_played: number
  mean_points: number | null
  standard_deviation: number | null
  min_points: number | null
  max_points: number | null
  calculated_at: Date | null
  coefficient_of_variation: number | null
  scoring_format_id: string
}

export interface PlayersStatusRow {
  pid: string | null
  mfl_player_id: string | null
  sleeper_player_id: string | null
  is_active: boolean | null
  depth_chart_order: string | null
  depth_chart_position: string | null
  details: string | null
  expected_return: string | null
  injury_body_part: string | null
  injury_start_date: Date | null
  injury_notes: string | null
  practice_participation: string | null
  practice_description: string | null
  search_rank: number | null
  observed_at: Date
  roster_status: string | null
  game_designation: string | null
  source_status: string | null
  source_injury_status: string | null
}

export interface PlayoffsRow {
  playoff_week_number: number
  tid: number
  lid: number
  season_year: number
  week: number
  points: number | null
  points_manual: number | null
  projection: number | null
}

export interface PoachReleasesRow {
  poach_id: number
  pid: string | null
}

export interface PoachesRow {
  poach_id: number
  pid: string | null
  user_id: number
  tid: number
  player_tid: number
  lid: number
  submitted: Date
  reason: string | null
  processed: Date | null
  is_successful: boolean | null
}

export interface PositionGameOutcomeDefaultsRow {
  player_position: string
  archetype: string | null
  archetype_key: string | null
  season_year: number
  outcome_type: string
  default_correlation: number
  sample_size: number | null
  calculated_at: Date | null
}

export interface PositionVocabularyBackfillAuditRow {
  audit_id: number
  table_name: string
  column_name: string
  row_key: any
  old_value: string | null
  new_value: string | null
  applied_at: Date
}

export interface PracticeRow {
  pid: string | null
  week: number
  season_year: number | null
  injury_type: string | null
  monday_practice_status: string | null
  tuesday_practice_status: string | null
  wednesday_practice_status: string | null
  thursday_practice_status: string | null
  friday_practice_status: string | null
  saturday_practice_status: string | null
  sunday_practice_status: string | null
  roster_status: string | null
  game_designation: string | null
  source_status: string | null
  season_type: string
  nfl_week_id: string | null
  source: string | null
  practice_status: string | null
}

export interface ProjectionsHistoryRow {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryDefaultRow {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2020Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2021Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2022Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2023Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2024Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2025Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsHistoryY2026Row {
  pid: string | null
  source_id: number
  user_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  week: number
  season_year: number | null
  generated_at: Date
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  nfl_week_id: string | null
}

export interface ProjectionsIndexRow {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexDefaultRow {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2020Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2021Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2022Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2023Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2024Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2025Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface ProjectionsIndexY2026Row {
  pid: string
  source_id: number
  week: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_type: SeasonType
  receiving_first_downs: number
  rushing_first_downs: number
  nfl_week_id: string | null
}

export interface PropMarketEventsRawHistoryRow {
  source_id: MarketSourceId
  source_event_id: string
  observed_at: Date
  raw_payload: any
}

export interface PropMarketSelectionsHistoryRow {
  source_id: MarketSourceId
  source_market_id: string
  source_selection_id: string
  selection_name: string | null
  selection_metric_line: number | null
  odds_decimal: number | null
  odds_american: number | null
  observed_at: Date
  selection_type: SelectionType | null
}

export interface PropMarketSelectionsIndexRow {
  source_id: MarketSourceId
  source_market_id: string
  source_selection_id: string
  selection_pid: string | null
  selection_name: string | null
  selection_metric_line: number | null
  odds_decimal: number | null
  odds_american: number | null
  selection_result: WagerStatus | null
  observed_at: Date
  time_type: TimeType
  current_season_hit_rate_hard: number | null
  current_season_hit_rate_soft: number | null
  current_season_edge_hard: number | null
  current_season_edge_soft: number | null
  last_five_hit_rate_hard: number | null
  last_five_hit_rate_soft: number | null
  last_five_edge_hard: number | null
  last_five_edge_soft: number | null
  last_ten_hit_rate_hard: number | null
  last_ten_hit_rate_soft: number | null
  last_ten_edge_hard: number | null
  last_ten_edge_soft: number | null
  last_season_hit_rate_hard: number | null
  last_season_hit_rate_soft: number | null
  last_season_edge_hard: number | null
  last_season_edge_soft: number | null
  overall_hit_rate_hard: number | null
  overall_hit_rate_soft: number | null
  overall_edge_hard: number | null
  overall_edge_soft: number | null
  selection_type: SelectionType | null
  metric_result_value: number | null
}

export interface PropMarketsHistoryRow {
  source_id: MarketSourceId
  source_market_id: string
  source_market_name: string | null
  is_open: boolean | null
  is_live: boolean | null
  selection_count: number
  observed_at: Date
}

export interface PropMarketsIndexRow {
  market_type: string | null
  source_id: MarketSourceId
  source_market_id: string
  source_market_name: string | null
  esbid: number | null
  source_event_id: string | null
  source_event_name: string | null
  is_open: boolean | null
  is_live: boolean | null
  selection_count: number
  time_type: TimeType
  observed_at: Date
  season_year: number | null
  is_market_settled: boolean | null
}

export interface PropMarketsRawHistoryRow {
  source_id: MarketSourceId
  source_market_id: string
  observed_at: Date
  raw_payload: any
}

export interface PropPairingPropsRow {
  pairing_id: string
  source_market_id: string
  source_selection_id: string
}

export interface PropPairingsRow {
  pairing_id: string
  source_id: MarketSourceId
  name: string | null
  nfl_team: string | null
  week: number
  size: number
  market_probability: number | null
  risk_total: number | null
  payout_total: number | null
  current_season_historical_rate_soft: number | null
  current_season_historical_rate_hard: number | null
  current_season_opponent_allow_rate: number | null
  current_season_total_games: number | null
  current_season_week_last_hit: number | null
  current_season_week_first_hit: number | null
  current_season_joint_historical_rate_soft: number | null
  current_season_joint_games: number | null
  current_season_historical_edge_soft: number | null
  current_season_historical_edge_hard: number | null
  highest_payout: number | null
  lowest_payout: number | null
  second_lowest_payout: number | null
  current_season_sum_historical_rate_soft: number | null
  current_season_sum_historical_rate_hard: number | null
  last_five_historical_rate_soft: number | null
  last_five_historical_rate_hard: number | null
  last_five_joint_historical_rate_soft: number | null
  last_five_historical_edge_soft: number | null
  last_five_historical_edge_hard: number | null
  last_ten_historical_rate_soft: number | null
  last_ten_historical_rate_hard: number | null
  last_ten_joint_historical_rate_soft: number | null
  last_ten_historical_edge_soft: number | null
  last_ten_historical_edge_hard: number | null
  last_season_historical_rate_soft: number | null
  last_season_historical_rate_hard: number | null
  last_season_joint_historical_rate_soft: number | null
  last_season_historical_edge_soft: number | null
  last_season_historical_edge_hard: number | null
  season_year: number
  season_type: string
}

export interface PropsRow {
  pid: string | null
  esbid: number | null
  week: number
  season_year: number | null
  id: string
  prop_line: number | null
  over_odds_decimal: number | null
  over_american_odds: number | null
  under_odds_decimal: number | null
  under_american_odds: number | null
  source_id: number
  observed_at: Date
  is_active: boolean | null
  is_live: boolean | null
  prop_type: string | null
}

export interface PropsIndexRow {
  pid: string | null
  esbid: number | null
  week: number
  season_year: number
  prop_type: string | null
  prop_line: number | null
  over_odds_decimal: number | null
  under_odds_decimal: number | null
  over_american_odds: number | null
  under_american_odds: number | null
  source_id: MarketSourceId
  observed_at: Date
  time_type: TimeType
  name: string | null
  nfl_team: string | null
  opponent_nfl_team: string | null
  player_position: string | null
  hits_soft: number | null
  hit_weeks_soft: any | null
  hits_hard: number | null
  hit_weeks_hard: any | null
  hits_opponent: number | null
  opponent_hit_weeks: any | null
  historical_rate_soft: number | null
  historical_rate_hard: number | null
  opponent_allow_rate: number | null
  historical_edge_soft: number | null
  historical_edge_hard: number | null
  market_probability: number | null
  is_pending: number | null
  is_success: number | null
  risk_amount: number | null
  payout: number | null
  all_weeks: any | null
  opponent_weeks: any | null
  prop_id: number
}

export interface RestOfSeasonProjectionsRow {
  pid: string | null
  source_id: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  season_year: number | null
}

export interface RestrictedFreeAgencyBidsRow {
  bid_id: number
  pid: string | null
  user_id: number
  bid_amount: number | null
  tid: number
  season_year: number | null
  lid: number
  is_successful: boolean | null
  submitted: Date
  processed: Date | null
  cancelled: Date | null
  nomination_id: number | null
  outcome: string | null
  outcome_detail: string | null
}

export interface RestrictedFreeAgencyNominationsRow {
  nomination_id: number
  league_id: number
  player_id: string
  season_year: number
  original_team_id: number
  nominated_at: Date | null
  announced_at: Date | null
  processed_at: Date | null
  winning_bid_id: number | null
}

export interface RestrictedFreeAgencyReleasesRow {
  restricted_free_agency_bid_id: number
  pid: string | null
}

export interface RosterAssetHoldingRow {
  holding_id: number
  lid: number
  tid: number
  asset_type: number
  player_id: string | null
  pick_year: number | null
  pick_round: number | null
  pick_original_owner_tid: number | null
  pick_draft_overall_position: number | null
  period_start: Date
  period_end: Date | null
  salary_paid: number | null
  salary_basis: number | null
  initial_slot_type: number | null
  practice_squad_slot_subtype: number | null
  weeks_active: number
  weeks_practice_squad: number
  weeks_reserve_short_term: number
  weeks_reserve_long_term: number
  weeks_covid_reserve: number
  weeks_started: number
  projected_points_added_at_acquisition: number | null
  realized_points_added_net_through_termination: number | null
  realized_points_added_positive_through_termination: number | null
  realized_points_added_net_in_active_slot: number | null
  realized_points_added_net_in_started_slot: number | null
  realized_points_added_net_in_practice_squad_slot: number | null
  projected_points_added_remaining_at_termination: number | null
  keeptradecut_value_at_acquisition: number | null
  keeptradecut_value_at_termination: number | null
  extension_count_at_acquisition: number | null
  franchise_tag_consecutive_count_at_acquisition: number | null
  is_rookie_tag: boolean
  protected_for_year: number | null
  super_priority_until: Date | null
  is_audit_corrected: boolean
  correction_note: string | null
  terminated_by: number | null
  league_format_id: string
}

export interface RosterAssetLineageRefreshStateRow {
  lid: number
  input_hash: string
  refreshed_at: Date
}

export interface RosterAssetTransformationRow {
  transformation_row_id: number
  transformation_id: string
  lid: number
  transaction_id: number | null
  transformation_type: number
  occurred_at: Date
  source_holding_id: number | null
  target_holding_id: number | null
  source_share: number | null
  target_share: number | null
  is_audit_corrected: boolean
  correction_note: string | null
  trade_id: number | null
}

export interface RostersRow {
  roster_id: number
  tid: number
  lid: number
  week: number
  season_year: number
  last_updated: Date | null
}

export interface RostersPlayersRow {
  roster_id: number
  slot: number
  pid: string
  player_position: string
  tag: number
  extensions: number
  tid: number
  lid: number
  week: number
  season_year: number
}

export interface ScoringFormatPlayerCareerlogsRow {
  pid: string
  draft_rank: number | null
  points: number | null
  points_per_game: number | null
  games_played: number | null
  top_3: number | null
  top_6: number | null
  top_12: number | null
  top_24: number | null
  top_36: number | null
  top_1: number | null
  scoring_format_id: string
}

export interface ScoringFormatPlayerGamelogsRow {
  pid: string
  esbid: number
  points: number | null
  position_rank: number | null
  scoring_format_id: string
}

export interface ScoringFormatPlayerProjectionPointsRow {
  pid: string
  week: number
  season_year: number
  projected_points_total: number | null
  scoring_format_id: string
}

export interface ScoringFormatPlayerRestOfSeasonProjectionPointsRow {
  pid: string
  scoring_format_id: string
  season_year: number
  projected_points_total: number | null
}

export interface ScoringFormatPlayerSeasonProjectionPointsRow {
  pid: string
  scoring_format_id: string
  season_year: number
  projected_points_total: number | null
}

export interface ScoringFormatPlayerSeasonlogsRow {
  pid: string
  season_year: number
  points: number | null
  points_per_game: number | null
  games_played: number | null
  points_rank: number | null
  points_position_rank: number | null
  points_per_game_rank: number | null
  points_per_game_position_rank: number | null
  scoring_format_id: string
}

export interface SeasonProjectionsHistoryRow {
  pid: string
  source_id: number
  season_year: number
  generated_at: Date
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
}

export interface SeasonProjectionsIndexRow {
  pid: string
  source_id: number
  season_year: number
  passing_attempts: number | null
  passing_completions: number | null
  passing_yards: number | null
  passing_interceptions: number | null
  passing_touchdowns: number | null
  rushing_attempts: number | null
  rushing_yards: number | null
  rushing_touchdowns: number | null
  targets: number | null
  receptions: number | null
  receiving_yards: number | null
  receiving_touchdowns: number | null
  fumbles_lost: number | null
  two_point_conversions: number | null
  field_goals_made: number | null
  field_goal_yards: number | null
  field_goals_made_0_19_yards: number | null
  field_goals_made_20_29_yards: number | null
  field_goals_made_30_39_yards: number | null
  field_goals_made_40_49_yards: number | null
  field_goals_made_50_plus_yards: number | null
  extra_points_made: number | null
  defensive_sacks: number | null
  defensive_interceptions: number | null
  defensive_forced_fumbles: number | null
  defensive_recovered_fumbles: number | null
  defensive_three_and_outs: number | null
  defensive_fourth_down_stops: number | null
  defensive_points_against: number | null
  defensive_yards_against: number | null
  defensive_blocked_kicks: number | null
  defensive_safeties: number | null
  defensive_two_point_returns: number | null
  defensive_touchdowns: number | null
  kickoff_return_touchdowns: number | null
  punt_return_touchdowns: number | null
  receiving_first_downs: number
  rushing_first_downs: number
}

export interface SeasonsRow {
  lid: number
  season_year: number
  season_started_at: Date | null
  franchise_tag_salary_quarterback: number | null
  franchise_tag_salary_running_back: number | null
  franchise_tag_salary_wide_receiver: number | null
  franchise_tag_salary_tight_end: number | null
  restricted_free_agency_period_start: Date | null
  restricted_free_agency_period_end: Date | null
  extension_deadline_at: Date | null
  draft_start: Date | null
  free_agency_period_start: Date | null
  free_agency_period_end: Date | null
  trade_deadline_at: Date | null
  draft_type: string | null
  draft_hour_min: number | null
  draft_hour_max: number | null
  max_roster_quarterback: number
  max_roster_running_back: number
  max_roster_wide_receiver: number
  max_roster_tight_end: number
  max_roster_defense_special_teams: number
  max_roster_kicker: number
  starting_free_agent_acquisition_budget: number
  franchise_tag_limit: number
  rookie_tag_limit: number
  restricted_free_agency_tag_limit: number
  season_due_amount: number | null
  wildcard_round: number | null
  championship_round: number[] | null
  rookie_draft_completed_at: Date | null
  season_finalized_at: Date | null
  scoring_format_id: string
  league_format_id: string
  restricted_free_agency_first_window_at: Date | null
  restricted_free_agency_window_hours: number
  restricted_free_agency_processing_lead_hours: number
  playoff_team_count: number
  bye_count: number
  bye_candidate_pool: string
  bye_selection_method: string
  at_large_selection_method: string
  has_division_winner_berths: boolean
  trade_veto_window_hours: number
  draft_pick_interval: number | null
  restricted_free_agency_processing_paused_until: Date | null
  restricted_free_agency_processing_paused_reason: string | null
  restricted_free_agency_processing_paused_at: Date | null
  head_to_head_berth_count: number
  rookie_draft_end_at: Date | null
  auction_block_notice_minutes: number
  auction_final_block_pace_minutes: number
  auction_final_block_buffer_hours: number
  is_auction_election_mode_enabled: boolean
}

export interface SelectionCombinationDefinitionsRow {
  combination_id: number
  combination_name: string
  combination_description: string | null
  selections: any
  is_active: boolean | null
  created_at: Date | null
  updated_at: Date | null
}

export interface SelectionCombinationOddsHistoryRow {
  history_id: number
  combination_id: number
  source_id: MarketSourceId
  selection_ids: string[]
  esbid: number
  season_year: number | null
  week: number | null
  decimal_odds: number | null
  american_odds: number | null
  is_same_game_parlay: boolean | null
  observed_at: Date
  previous_decimal_odds: number | null
  previous_american_odds: number | null
}

export interface SelectionCombinationOddsIndexRow {
  combination_id: number
  source_id: MarketSourceId
  selection_ids: string[]
  esbid: number
  season_year: number | null
  week: number | null
  decimal_odds: number | null
  american_odds: number | null
  is_same_game_parlay: boolean | null
  observed_at: Date
}

export interface SourcesRow {
  source_id: number
  name: string
  url: string
}

export interface SuperPriorityRow {
  super_priority_id: number
  pid: string
  original_tid: number
  poaching_tid: number
  lid: number
  poach_timestamp: Date
  eligible: number
  claimed: number
  claimed_at: Date | null
}

export interface TeamsRow {
  team_id: number
  season_year: number
  lid: number
  division: number | null
  name: string
  abbreviation: string
  image: string | null
  waiver_order: number | null
  draft_order: number | null
  salary_cap: number
  free_agent_acquisition_budget_balance: number
  primary_color: string | null
  accent_color: string | null
}

export interface TradeReleasesRow {
  trade_id: number
  tid: number
  pid: string | null
  origin_slot: number | null
}

export interface TradesRow {
  trade_id: number
  propose_tid: number
  accept_tid: number
  lid: number
  user_id: number
  season_year: number | null
  offered: Date
  accepted: Date | null
  cancelled: Date | null
  rejected: Date | null
  vetoed: Date | null
  approved: Date | null
}

export interface TradesPicksRow {
  trade_id: number
  tid: number
  draft_pick_id: number
}

export interface TradesPlayersRow {
  trade_id: number
  tid: number
  pid: string | null
}

export interface TradesSlotsRow {
  trade_id: number
  pid: string
  tid: number
  slot: number
  origin_slot: number | null
}

export interface TradesTransactionsRow {
  trade_id: number
  transaction_id: number
}

export interface TransactionsRow {
  transaction_id: number
  user_id: number
  tid: number
  lid: number
  pid: string | null
  type: number
  player_salary: number
  week: number
  season_year: number | null
  occurred_at: Date
  waiver_id: number | null
}

export interface UrlsRow {
  url: string
  url_hash: Buffer
  created_at: Date | null
}

export interface UserApiKeysRow {
  api_key_id: number
  user_id: number
  key_hash: string
  key_prefix: string
  name: string
  created_at: Date
  last_used_at: Date | null
  revoked_at: Date | null
}

export interface UserDataViewFavoritesRow {
  user_id: number
  view_id: string
  created_at: Date | null
}

export interface UserDataViewTagsRow {
  user_id: number
  view_id: string
  tag_name: string
  source: string
  created_at: Date | null
}

export interface UserDataViewsRow {
  view_id: string
  view_name: string
  view_description: string | null
  table_state: any | null
  created_at: Date | null
  updated_at: Date | null
  user_id: number | null
  llm_tags_generated_at: Date | null
  query_id: string | null
  llm_generated_at: Date | null
  llm_inference_provider: string | null
}

export interface UserPlaysViewsRow {
  view_id: string
  view_name: string
  view_description: string | null
  table_state: any | null
  created_at: Date | null
  updated_at: Date | null
  user_id: number | null
}

export interface UsersRow {
  id: number
  username: string
  email: string
  password: string
  watchlist: string | null
  last_visit_at: Date | null
  invite_code: string | null
  data_view_export_max_rows: number | null
  data_view_generation_is_enabled: boolean
}

export interface UsersSourcesRow {
  user_id: number
  source_id: number
  weight: number
}

export interface UsersTeamsRow {
  user_id: number
  tid: number
  season_year: number
}

export interface WaiverReleasesRow {
  waiver_id: number
  pid: string | null
}

export interface WaiversRow {
  waiver_id: number
  user_id: number
  pid: string | null
  tid: number
  lid: number
  submitted: Date
  bid_amount: number | null
  priority_order: number | null
  type: number
  is_successful: boolean | null
  reason: string | null
  processed: Date | null
  cancelled: Date | null
  super_priority: number
}

export interface WeeklyMarketSelectionsAnalysisCacheRow {
  source_id: MarketSourceId
  source_market_id: string
  source_selection_id: string
  selection_pid: string | null
  current_season_hits_soft: number | null
  current_season_hit_weeks_soft: any | null
  current_season_hits_hard: number | null
  current_season_hit_weeks_hard: any | null
  current_season_weeks_played: any | null
  last_five_hits_soft: number | null
  last_five_hit_weeks_soft: any | null
  last_five_hits_hard: number | null
  last_five_hit_weeks_hard: any | null
  last_five_weeks_played: any | null
  last_ten_hits_soft: number | null
  last_ten_hit_weeks_soft: any | null
  last_ten_hits_hard: number | null
  last_ten_hit_weeks_hard: any | null
  last_ten_weeks_played: any | null
  last_season_hits_soft: number | null
  last_season_hit_weeks_soft: any | null
  last_season_hits_hard: number | null
  last_season_hit_weeks_hard: any | null
  last_season_weeks_played: any | null
  overall_hits_soft: number | null
  overall_hit_weeks_soft: any | null
  overall_hits_hard: number | null
  overall_hit_weeks_hard: any | null
  overall_weeks_played: any | null
  current_season_hits_opponent: number | null
  current_season_opponent_hit_weeks: any | null
  current_season_opponent_weeks_played: any | null
  name: string | null
  nfl_team: string | null
  player_position: string | null
  opponent_nfl_team: string | null
  market_type: string | null
  esbid: number | null
}
