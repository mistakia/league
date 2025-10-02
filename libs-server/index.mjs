export { default as readCSV } from './read-csv.mjs'
export { default as sendNotifications } from './send-notifications.mjs'
export { default as sendEmail } from './send-email.mjs'
export { default as sendGroupmeMessage } from './send-groupme-message.mjs'
export { default as find_player_row } from './find-player-row.mjs'
export { default as updatePlayer } from './update-player.mjs'
export { default as update_player_id } from './update-player-id.mjs'
export { default as generate_fantasy_league_schedule } from './generate-fantasy-league-schedule.mjs'
export { default as getTeam } from './get-team.mjs'
export { default as isPlayerOnWaivers } from './is-player-on-waivers.mjs'
export { default as isPlayerRostered } from './is-player-rostered.mjs'
export { default as isPlayerLocked } from './is-player-locked.mjs'
export { default as submitPoach } from './submit-poach.mjs'
export { default as submitReserve } from './submit-reserve.mjs'
export { default as submitActivate } from './submit-activate.mjs'
export { default as processPoach } from './process-poach.mjs'
export { default as processRelease } from './process-release.mjs'
export { default as get_super_priority_status } from './get-super-priority-status.mjs'
export { default as process_super_priority } from './process-super-priority.mjs'
export { default as processRestrictedFreeAgencyBid } from './process-restricted-free-agency-bid.mjs'
export { default as getRoster } from './get-roster.mjs'
export { default as get_player_projections } from './get-projections.mjs'
export { default as getLeague } from './get-league.mjs'
export { default as createLeague } from './create-league.mjs'
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
export { default as verifyReserveStatus } from './verify-reserve-status.mjs'
export { default as verifyRestrictedFreeAgency } from './verify-restricted-free-agency.mjs'
export { default as validate_franchise_tag } from './validate-franchise-tag.mjs'
export { default as googleDrive, downloadFile } from './google-drive.mjs'
export { default as getJobs } from './get-jobs.mjs'
export { default as getLastTransaction } from './get-last-transaction.mjs'
export { default as get_player_transactions } from './get-player-transactions.mjs'
export { default as getPlayers } from './get-players.mjs'
export { default as get_laegue_rosters_from_database } from './get-league-rosters-from-database.mjs'
export { default as getAcquisitionTransaction } from './get-acquisition-transaction.mjs'
export { default as getPlay } from './get-play.mjs'
export { default as is_main } from './is-main.mjs'
export { default as createPlayer } from './create-player.mjs'
export { default as insert_prop_markets } from './insert-prop-markets.mjs'
export { format_sql, normalize_sql_for_comparison } from './format-sql.mjs'
export { default as generate_player_id } from './generate-player-id.mjs'
export * as espn from './espn.mjs'
export * as sportradar from './sportradar.mjs'
export * as draftkings from './draftkings/index.mjs'
export * as fanduel from './fanduel.mjs'
export * as betmgm from './betmgm.mjs'
export * as prizepicks from './prizepicks.mjs'
export * as fantasylife from './fantasylife.mjs'
export { default as getRestrictedFreeAgencyBids } from './get-restricted-free-agency-bids.mjs'
export { wait } from './wait.mjs'
export { default as clean_string } from './clean-string.mjs'
export * as nfl from './nfl.mjs'

export * as gambet from './gambet.mjs'
export * as cache from './cache.mjs'
export * as betrivers from './betrivers.mjs'
export { default as get_league_format } from './get-league-format.mjs'
export * as pfr from './pro-football-reference.mjs'
export * as validators from './validators.mjs'
export { default as get_trades } from './get-trades.mjs'
export { default as get_draft_data_with_history } from './get-draft-data-with-history.mjs'
export { default as get_restricted_free_agency_signings } from './get-restricted-free-agency-signings.mjs'
export { default as batch_insert } from './batch-insert.mjs'
export * as puppeteer from './puppeteer.mjs'
export {
  default as get_data_view_results,
  get_data_view_results_query
} from './get-data-view-results.mjs'
export { default as update_play } from './update-play.mjs'
export { default as update_nfl_game } from './update-nfl-game.mjs'
export * as betonline from './betonline.mjs'
export { default as encode_market_selection_id } from './encode-market-selection-id.mjs'
export { default as format_starting_hash } from './format-starting-hash.mjs'
export { default as report_job } from './report-job.mjs'
export {
  redis_client,
  RedisCacheAdapter,
  redis_cache
} from './redis_adapter.mjs'
export * as auction_slow_mode_redis from './auction-slow-mode-redis.mjs'
export * as sleeper from './sleeper.mjs'
export * as fantasypros from './fantasypros.mjs'
export * as four_for_four from './4for4.mjs'
export * as yahoo from './yahoo.mjs'
export * as rts from './rts.mjs'
export { default as mergePlayer } from './merge-player.mjs'
export * as pinnacle from './pinnacle.mjs'
export { default as report_error } from './report-error.mjs'
export * as selection_result from './selection-result.mjs'
export { default as format_market_selection_id } from './format-market-selection-id.mjs'
export * as fanatics from './fanatics.mjs'
export { default as fetch_with_retry } from './fetch-with-retry.mjs'
export { default as fetch_with_proxy, proxy_manager } from './proxy-manager.mjs'
export { default as handle_season_args_for_script } from './handle-season-args-for-script.mjs'
export {
  load_data_view_test_queries,
  load_data_view_test_queries_sync
} from './load-test-cases.mjs'
export { update_test_file } from './update-test-file.mjs'
export { process_expected_query } from './process-expected-query.mjs'

export const getChartedPlayByPlayQuery = (db) =>
  db('nfl_plays')
    .select(
      'nfl_plays.player_fuml_pid',
      'nfl_plays.fuml',
      'nfl_plays.off',
      'nfl_plays.play_type',
      'nfl_plays.bc_pid',
      'nfl_plays.pass_yds',
      'nfl_plays.rush_yds',
      'nfl_plays.recv_yds',
      'nfl_plays.yds_gained',
      'nfl_plays.first_down',
      'nfl_plays.successful_play',
      'nfl_plays.psr_pid',
      'nfl_plays.trg_pid',
      'nfl_plays.intp_pid',
      'nfl_plays.comp',
      'nfl_plays.td',
      'nfl_plays.sk',
      'nfl_plays.dwn',
      'nfl_plays.qtr',
      'nfl_plays.dot',
      'nfl_plays.qb_pressure',
      'nfl_plays.qb_hit',
      'nfl_plays.qb_hurry',
      'nfl_plays.highlight_pass',
      'nfl_plays.int_worthy',
      'nfl_plays.dropped_pass',
      'nfl_plays.contested_ball',
      'nfl_plays.mbt',
      'nfl_plays.yards_after_catch',
      'nfl_plays.yards_after_any_contact',
      'nfl_games.week',
      'nfl_games.day',
      'nfl_plays.cov_type',
      'nfl_plays.sep',
      'nfl_plays.ydl_100'
    )
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .whereNot('nfl_plays.play_type', 'NOPL')

const fields = [
  'nfl_plays_current_week.esbid',
  'nfl_plays_current_week.playId',
  'nfl_plays_current_week.sequence',
  'nfl_plays_current_week.dwn',
  'nfl_plays_current_week.desc',
  'nfl_plays_current_week.pos_team',
  'nfl_plays_current_week.year',
  'nfl_plays_current_week.week',
  'nfl_plays_current_week.qtr',
  'nfl_plays_current_week.yards_to_go',
  'nfl_plays_current_week.game_clock_start',
  'nfl_plays_current_week.ydl_end',
  'nfl_plays_current_week.ydl_start',
  'nfl_plays_current_week.first_down',
  'nfl_plays_current_week.goal_to_go',
  'nfl_plays_current_week.drive_play_count',
  'nfl_plays_current_week.timestamp',
  'nfl_plays_current_week.play_type_nfl',
  'nfl_plays_current_week.updated',

  'nfl_games.h',
  'nfl_games.v'
]

export const getPlayByPlayQuery = (db) =>
  db('nfl_plays_current_week')
    .select(fields)
    .join('nfl_games', 'nfl_plays_current_week.esbid', '=', 'nfl_games.esbid')
