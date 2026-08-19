export * as simulation from './simulation/index.mjs'
export { default as readCSV } from './read-csv.mjs'
export { default as sendNotifications } from './send-notifications.mjs'
export { default as sendEmail } from './send-email.mjs'
export { default as find_player_row } from './find-player-row.mjs'
export { default as ensure_player_alias } from './ensure-player-alias.mjs'
export { default as get_selection_id_from_source } from './get-selection-id-from-source.mjs'
export { default as updatePlayer } from './update-player.mjs'
export { default as set_player_field_override } from './set-player-field-override.mjs'
export { default as update_player_id } from './update-player-id.mjs'
export { default as generate_fantasy_league_schedule } from './generate-fantasy-league-schedule.mjs'
export { default as getTeam } from './get-team.mjs'
export { default as isPlayerOnWaivers } from './is-player-on-waivers.mjs'
export { default as isPlayerRostered } from './is-player-rostered.mjs'
export { default as isPlayerLocked } from './is-player-locked.mjs'
export { default as submitPoach } from './submit-poach.mjs'
export { default as submit_reserve } from './submit-reserve.mjs'
export { default as submitActivate } from './submit-activate.mjs'
export { default as submitDeactivate } from './submit-deactivate.mjs'
export { default as processPoach } from './process-poach.mjs'
export { default as processRelease } from './process-release.mjs'
export { default as get_super_priority_status } from './get-super-priority-status.mjs'
export { default as process_super_priority } from './process-super-priority.mjs'
export { default as processRestrictedFreeAgencyBid } from './process-restricted-free-agency-bid.mjs'
export {
  default as record_bid_change,
  record_restricted_free_agency_bid_change
} from './record-bid-change.mjs'
export { default as classify_restricted_free_agency_bid_outcome } from './classify-restricted-free-agency-bid-outcome.mjs'
export { default as get_restricted_free_agency_nominations } from './get-restricted-free-agency-nominations.mjs'
export { default as getRoster } from './get-roster.mjs'
export { default as get_player_projections } from './get-projections.mjs'
export { default as getLeague } from './get-league.mjs'
export { default as createLeague } from './create-league.mjs'
export {
  find_or_create_scoring_format,
  find_or_create_league_format
} from './find-or-create-format.mjs'
export { find_or_create_adp_format } from './find-or-create-adp-format.mjs'
export { default as resetWaiverOrder } from './reset-waiver-order.mjs'
export { default as getTopPoachingWaiver } from './get-top-poaching-waiver.mjs'
export { default as getTopFreeAgencyWaiver } from './get-top-free-agency-waiver.mjs'
export { default as getTopPracticeSquadWaiver } from './get-top-practice-squad-waiver.mjs'
export { default as get_waiver_by_id } from './get-waiver-by-id.mjs'
export { default as get_top_restricted_free_agency_bids } from './get-top-restricted-free-agency-bids.mjs'
export { default as generateSchedule } from './generate-schedule.mjs'
export { default as submitAcquisition } from './submit-acquisition.mjs'
export { default as getTransactionsSinceAcquisition } from './get-transactions-since-acquisition.mjs'
export { default as getTransactionsSinceFreeAgent } from './get-transactions-since-free-agent.mjs'
export { default as getPlayerExtensions } from './get-player-extensions.mjs'
export { default as verifyUserTeam } from './verify-user-team.mjs'
export { default as verify_reserve_status } from './verify-reserve-status.mjs'
export { default as verifyRestrictedFreeAgency } from './verify-restricted-free-agency.mjs'
export {
  get_trade_protected_assets,
  verify_assets_not_trade_protected,
  get_trade_veto_deadline,
  is_trade_within_veto_window
} from './get-trade-veto-window.mjs'
export { default as validate_franchise_tag } from './validate-franchise-tag.mjs'
export { default as getJobs } from './get-jobs.mjs'
export { default as getLastTransaction } from './get-last-transaction.mjs'
export { default as get_player_transactions } from './get-player-transactions.mjs'
export { default as getPlayers } from './get-players.mjs'
export { default as get_laegue_rosters_from_database } from './get-league-rosters-from-database.mjs'
export { default as getAcquisitionTransaction } from './get-acquisition-transaction.mjs'
export { default as getPlay } from './get-play.mjs'
export { default as is_main } from './is-main.mjs'
export {
  default as createPlayer,
  CREATE_PLAYER_REQUIRED_FIELDS
} from './create-player.mjs'
export {
  default as resolve_canonical_player,
  BIRTH_DATE_PLACEHOLDER,
  UNKNOWN_REASONS,
  describe_resolution
} from './resolve-canonical-player.mjs'
export { default as insert_prop_markets } from './insert-prop-markets.mjs'
export { format_sql, normalize_sql_for_comparison } from './format-sql.mjs'
export { default as generate_player_id } from './generate-player-id.mjs'
export * as espn from './espn.mjs'
export * as espn_auth from './espn-auth.mjs'
export * as sportradar from './sportradar/index.mjs'
export * as draftkings from './draftkings/index.mjs'
export * as fanduel from './fanduel/index.mjs'
export * as prizepicks from './prizepicks.mjs'
export { default as getRestrictedFreeAgencyBids } from './get-restricted-free-agency-bids.mjs'
export { wait } from './wait.mjs'
export { default as clean_string } from './clean-string.mjs'
export * as nfl from './nfl.mjs'

export * as gambet from './gambet.mjs'
export * as cache from './cache.mjs'
export * as betrivers from './betrivers.mjs'
export { default as get_league_format } from './get-league-format.mjs'
export { default as get_observed_at_for_season_weeks } from './dvoa/get-observed-at-for-season-weeks.mjs'
export {
  default as get_game_team_implied_totals,
  parse_game_team_total_market_id
} from './get-game-team-implied-totals.mjs'
export * as validators from './validators.mjs'
export { default as get_trades } from './get-trades.mjs'
export { default as get_draft_data_with_history } from './get-draft-data-with-history.mjs'
export { default as where_outstanding_draft_pick } from './where-outstanding-draft-pick.mjs'
export { default as close_rookie_draft } from './close-rookie-draft.mjs'
export { default as calculate_admission_vote_points } from './calculate-admission-vote-points.mjs'
export { default as close_admission_vote } from './close-admission-vote.mjs'
export { default as get_admission_vote_totals } from './get-admission-vote-totals.mjs'
export { default as get_restricted_free_agency_signings } from './get-restricted-free-agency-signings.mjs'
export { default as batch_insert } from './batch-insert.mjs'
export {
  DYNASTY_RANKINGS_URL,
  fetch_dynasty_rankings_players,
  has_liquidity_data,
  summarize_zero_liquidity_payload,
  write_zero_liquidity_payload_summary,
  build_liquidity_inserts,
  liquidity_observed_at
} from './keeptradecut-liquidity.mjs'
export {
  default as get_data_view_results,
  get_data_view_results_query
} from './get-data-view-results.mjs'
export {
  resolve_table_state_from_short_url,
  parse_url_to_table_state,
  extract_short_url_hash
} from './data-views/resolve-table-state.mjs'
export {
  default as get_plays_view_results,
  get_plays_view_results_query
} from './plays-view/get-plays-view-results.mjs'
export { default as update_play, compute_play_changes } from './update-play.mjs'
export { default as update_nfl_game } from './update-nfl-game.mjs'
export { default as record_changelog } from './record-changelog.mjs'
export {
  calculate_route_share,
  recompute_route_share,
  ROUTE_SHARE_MAX
} from './route-share.mjs'
export { default as record_league_format_projection_value_history } from './record-league-format-projection-value-history.mjs'
export * as betonline from './betonline.mjs'
export { default as format_starting_hash } from './format-starting-hash.mjs'
export { default as report_job } from './report-job.mjs'
export { default as emit_signal, resolve_signal } from './emit-signal.mjs'
export { default as throw_if_shortfall } from './throw-if-shortfall.mjs'
export { default as check_projections_index_floor } from './check-projections-index-floor.mjs'
export {
  has_league_notification_been_sent,
  claim_league_notification,
  record_league_notification_sent
} from './league-notifications.mjs'
export {
  redis_client,
  RedisCacheAdapter,
  redis_cache
} from './redis_adapter.mjs'
export * as auction_slow_mode_redis from './auction-slow-mode-redis.mjs'
export * as sleeper from './sleeper.mjs'
export * as player_name_utils from './player-name-utils.mjs'
export * as fantasypros from './fantasypros.mjs'
export * as four_for_four from './4for4.mjs'
export * as yahoo from './yahoo.mjs'
export * as rts from './rts.mjs'
export * as underdog from './underdog.mjs'
export { default as mergePlayer } from './merge-player.mjs'
export * as pinnacle from './pinnacle.mjs'
export { default as report_error } from './report-error.mjs'
export { default as report_run_outcome } from './report-run-outcome.mjs'
export * as selection_result from './selection-result.mjs'
export * as fanatics from './fanatics.mjs'
export {
  fetch_with_retry,
  fetch_with_proxy,
  proxy_manager
} from './proxy-manager.mjs'
export { default as handle_season_args_for_script } from './handle-season-args-for-script.mjs'
export { default as get_season_playoff_weeks } from './get-season-playoff-weeks.mjs'
export {
  load_data_view_test_queries,
  load_data_view_test_queries_sync
} from './load-test-cases.mjs'
export { update_test_file } from './update-test-file.mjs'
export { process_expected_query } from './process-expected-query.mjs'

export const getChartedPlayByPlayQuery = (db) =>
  db('nfl_plays')
    .select(
      'nfl_plays.fumble_lost_pid',
      'nfl_plays.is_fumble_lost',
      'nfl_plays.offense_nfl_team',
      'nfl_plays.play_type',
      'nfl_plays.ball_carrier_pid',
      'nfl_plays.pass_yards',
      'nfl_plays.rush_yards',
      'nfl_plays.receiving_yards',
      'nfl_plays.yards_gained',
      'nfl_plays.is_first_down',
      'nfl_plays.is_successful_play',
      'nfl_plays.passer_pid',
      'nfl_plays.target_pid',
      'nfl_plays.interceptor_pid',
      'nfl_plays.is_completion',
      'nfl_plays.is_touchdown',
      'nfl_plays.is_sack',
      'nfl_plays.down_number',
      'nfl_plays.quarter',
      'nfl_plays.depth_of_target',
      'nfl_plays.is_qb_pressure',
      'nfl_plays.is_qb_hit',
      'nfl_plays.is_qb_hurry',
      'nfl_plays.is_highlight_pass',
      'nfl_plays.is_interception_worthy',
      'nfl_plays.is_dropped_pass',
      'nfl_plays.is_contested_ball',
      'nfl_plays.missed_or_broken_tackle',
      'nfl_plays.yards_after_catch',
      'nfl_plays.yards_after_any_contact',
      'nfl_games.week',
      'nfl_games.day',
      // Canonical week identifier, consumed by the client-side week filter in
      // app/core/stats. Generated column, so it never drifts from the parts.
      'nfl_games.nfl_week_id',
      'nfl_plays.coverage_type_ngs',
      'nfl_plays.receiver_separation',
      'nfl_plays.yard_line_100'
    )
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .whereNot('nfl_plays.play_type', 'NOPL')

const fields = [
  'nfl_plays_current_week.esbid',
  'nfl_plays_current_week.play_id',
  'nfl_plays_current_week.sequence',
  'nfl_plays_current_week.down_number',
  'nfl_plays_current_week.play_description',
  'nfl_plays_current_week.possession_nfl_team',
  'nfl_plays_current_week.offense_nfl_team',
  'nfl_plays_current_week.defense_nfl_team',
  'nfl_plays_current_week.season_year',
  'nfl_plays_current_week.week',
  'nfl_plays_current_week.quarter',
  'nfl_plays_current_week.yards_to_go',
  'nfl_plays_current_week.game_clock_start',
  'nfl_plays_current_week.yard_line_end',
  'nfl_plays_current_week.yard_line_start',
  'nfl_plays_current_week.is_first_down',
  'nfl_plays_current_week.is_goal_to_go',
  'nfl_plays_current_week.drive_play_count',
  'nfl_plays_current_week.play_time_of_day',
  'nfl_plays_current_week.play_type_nfl',
  'nfl_plays_current_week.updated',
  'nfl_plays_current_week.is_qb_kneel',

  'nfl_games.home_nfl_team',
  'nfl_games.away_nfl_team'
]

export const getPlayByPlayQuery = (db) =>
  db('nfl_plays_current_week')
    .select(fields)
    .join('nfl_games', 'nfl_plays_current_week.esbid', '=', 'nfl_games.esbid')

export {
  generate_docs_index,
  generate_league_context,
  generate_league_rules,
  generate_league_schedule,
  generate_league_rosters,
  generate_league_rosters_csv,
  generate_team_context,
  ContextDocError
} from './context-docs/index.mjs'
