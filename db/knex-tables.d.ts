// GENERATED FILE -- do not edit.
//
// Source: db/schema.postgres.sql
// Regenerate: node db/tools/generate-schema-types.mjs
// Currency gate: yarn check:types (runs this generator with --check)
//
// Maps every table NAME to its row type for knex, so a checked file gets
// `db('player').select('*')` typed as PlayerRow[] with no annotation of its
// own, and a misspelled column read reports TS2551 with the correct
// spelling. This is the alternative to hand-copying the same
// `@returns {Promise<XRow[]>}` at every one of ~1,500 call sites.
//
// THIS FILE MUST BE LISTED IN tsconfig.json `include`. The include patterns
// are `**/*.mjs`, which does not match a .d.ts, and a module augmentation
// that is not in the program applies to nothing while every check still
// passes -- a vacuous green indistinguishable from a working one. Verify
// with a deliberate typo, never with an exit code.
//
// Known limits, so coverage is not overclaimed: a join or an
// aliased select narrows imperfectly, `db.raw()` stays untyped, and a
// bespoke computed shape still needs its own hand-written typedef.

import type {
  AdmissionVoteBallotPreferencesRow,
  AdmissionVoteBallotsRow,
  AdmissionVoteCandidateSponsorsRow,
  AdmissionVoteCandidatesRow,
  AdmissionVoteEligibleTeamsRow,
  AdmissionVotesRow,
  AdpFormatRow,
  BidChangelogRow,
  CompositeMarketValueBlendWeightsRow,
  CompositeMarketValueCalibrationRow,
  CompositeMarketValueDailyRow,
  ConfigRow,
  ContributionAnswersRow,
  ContributionEventsRow,
  ContributionQuestionsRow,
  ContributionScreenshotsRow,
  ContributionSubmissionsRow,
  ContributionTrustOverridesRow,
  DataViewSqlAuditRow,
  DfsContestsRow,
  DraftRow,
  DraftkingsCategoryActivityRow,
  DvoaTeamDriveSeasonlogsRow,
  DvoaTeamGamelogsRow,
  DvoaTeamSeasonlogsHistoryRow,
  DvoaTeamSeasonlogsIndexRow,
  DvoaTeamUnitSeasonlogsHistoryRow,
  DvoaTeamUnitSeasonlogsIndexRow,
  EspnPlayerWinRatesHistoryRow,
  EspnPlayerWinRatesIndexRow,
  EspnReceivingMetricsHistoryRow,
  EspnTeamWinRatesHistoryRow,
  EspnTeamWinRatesIndexRow,
  ExternalLeagueConnectionsRow,
  ExternalLeagueImportJobsRow,
  ExternalLeagueMembershipsRow,
  ExternalLeagueTradeLegsRow,
  ExternalLeagueTradesRow,
  ExternalLeagueUsersRow,
  ExternalLeaguesRow,
  FormatCategorySignalMappingRow,
  HistoricalInjuryIndexRow,
  HistoricalInjuryIndex2009Row,
  HistoricalInjuryIndex2010Row,
  HistoricalInjuryIndex2011Row,
  HistoricalInjuryIndex2012Row,
  HistoricalInjuryIndex2013Row,
  HistoricalInjuryIndex2014Row,
  HistoricalInjuryIndex2015Row,
  HistoricalInjuryIndex2016Row,
  HistoricalInjuryIndex2017Row,
  HistoricalInjuryIndex2018Row,
  HistoricalInjuryIndex2019Row,
  HistoricalInjuryIndex2020Row,
  HistoricalInjuryIndex2021Row,
  HistoricalInjuryIndex2022Row,
  HistoricalInjuryIndex2023Row,
  HistoricalInjuryIndex2024Row,
  HistoricalInjuryIndex2025Row,
  InviteCodesRow,
  JobsRow,
  KeeptradecutLiquidityRow,
  KeeptradecutPickRow,
  KeeptradecutValuationsRow,
  LeagueBaselinesRow,
  LeagueCutlistRow,
  LeagueDivisionsRow,
  LeagueFormatDraftPickValueRow,
  LeagueFormatPlayerCareerlogsRow,
  LeagueFormatPlayerGamelogsRow,
  LeagueFormatPlayerProjectionValuesRow,
  LeagueFormatPlayerProjectionValuesHistoryRow,
  LeagueFormatPlayerRestOfSeasonProjectionValuesRow,
  LeagueFormatPlayerRestOfSeasonProjectionValuesHistoryRow,
  LeagueFormatPlayerSeasonProjectionValuesRow,
  LeagueFormatPlayerSeasonlogsRow,
  LeagueFormatsRow,
  LeagueMigrationsRow,
  LeagueMigrationsLockRow,
  LeagueNflTeamSeasonlogsRow,
  LeagueNotificationsRow,
  LeaguePausesRow,
  LeaguePlayerProjectionValuesRow,
  LeaguePlayerRestOfSeasonProjectionValuesRow,
  LeaguePlayerSeasonProjectionValuesRow,
  LeaguePlayerSeasonlogsRow,
  LeagueScoringFormatsRow,
  LeagueSeasonBaselinesRow,
  LeagueTeamCareerlogsRow,
  LeagueTeamDailyValuesRow,
  LeagueTeamForecastRow,
  LeagueTeamLineupContributionWeeksRow,
  LeagueTeamLineupContributionsRow,
  LeagueTeamLineupStartersRow,
  LeagueTeamLineupsRow,
  LeagueTeamPlayerSeasonlogsRow,
  LeagueTeamSeasonlogsRow,
  LeagueUserCareerlogsRow,
  LeaguesRow,
  ManagerWaitlistSubmissionsRow,
  MatchupsRow,
  NflCoachesRow,
  NflDraftRankingsHistoryRow,
  NflDraftRankingsIndexRow,
  NflGameCoachesRow,
  NflGamesRow,
  NflGamesChangelogRow,
  NflMatchupStatsRow,
  NflPlayStatsRow,
  NflPlayStatsCurrentWeekRow,
  NflPlaysRow,
  NflPlaysCurrentWeekRow,
  NflPlaysPasserRow,
  NflPlaysPlayerRow,
  NflPlaysReceiverRow,
  NflPlaysRusherRow,
  NflPlaysYear2000Row,
  NflPlaysYear2001Row,
  NflPlaysYear2002Row,
  NflPlaysYear2003Row,
  NflPlaysYear2004Row,
  NflPlaysYear2005Row,
  NflPlaysYear2006Row,
  NflPlaysYear2007Row,
  NflPlaysYear2008Row,
  NflPlaysYear2009Row,
  NflPlaysYear2010Row,
  NflPlaysYear2011Row,
  NflPlaysYear2012Row,
  NflPlaysYear2013Row,
  NflPlaysYear2014Row,
  NflPlaysYear2015Row,
  NflPlaysYear2016Row,
  NflPlaysYear2017Row,
  NflPlaysYear2018Row,
  NflPlaysYear2019Row,
  NflPlaysYear2020Row,
  NflPlaysYear2021Row,
  NflPlaysYear2022Row,
  NflPlaysYear2023Row,
  NflPlaysYear2024Row,
  NflPlaysYear2025Row,
  NflPlaysYear2026Row,
  NflSnapsRow,
  NflSnapsYear2000Row,
  NflSnapsYear2001Row,
  NflSnapsYear2002Row,
  NflSnapsYear2003Row,
  NflSnapsYear2004Row,
  NflSnapsYear2005Row,
  NflSnapsYear2006Row,
  NflSnapsYear2007Row,
  NflSnapsYear2008Row,
  NflSnapsYear2009Row,
  NflSnapsYear2010Row,
  NflSnapsYear2011Row,
  NflSnapsYear2012Row,
  NflSnapsYear2013Row,
  NflSnapsYear2014Row,
  NflSnapsYear2015Row,
  NflSnapsYear2016Row,
  NflSnapsYear2017Row,
  NflSnapsYear2018Row,
  NflSnapsYear2019Row,
  NflSnapsYear2020Row,
  NflSnapsYear2021Row,
  NflSnapsYear2022Row,
  NflSnapsYear2023Row,
  NflSnapsYear2024Row,
  NflSnapsYear2025Row,
  NflSnapsYear2026Row,
  NflSnapsYearDefaultRow,
  NflStadiumRow,
  NflTeamGamelogsRow,
  NflTeamSeasonlogsRow,
  NgsProspectScoresHistoryRow,
  NgsProspectScoresIndexRow,
  PercentilesRow,
  PffPlayerFacetGamelogsRow,
  PffPlayerFacetSeasonlogsRow,
  PffPlayerGamelogsRow,
  PffPlayerSeasonlogsRow,
  PffPlayerSeasonlogsChangelogRow,
  PffTeamGamelogsRow,
  PffTeamSeasonlogsRow,
  PffUnresolvedPlayersRow,
  PlacedWagersRow,
  PlayChangelogRow,
  PlayerRow,
  PlayerAdpHistoryRow,
  PlayerAdpIndexRow,
  PlayerAliasesRow,
  PlayerArchetypesRow,
  PlayerChangelogRow,
  PlayerCollegeCareerlogsRow,
  PlayerCollegeSeasonlogsRow,
  PlayerContractsRow,
  PlayerDefenderGamelogsRow,
  PlayerDfsOwnershipRow,
  PlayerFieldOverrideRow,
  PlayerGameOutcomeCorrelationsRow,
  PlayerGamelogsRow,
  PlayerGamelogsDefaultRow,
  PlayerGamelogsYear2000Row,
  PlayerGamelogsYear2001Row,
  PlayerGamelogsYear2002Row,
  PlayerGamelogsYear2003Row,
  PlayerGamelogsYear2004Row,
  PlayerGamelogsYear2005Row,
  PlayerGamelogsYear2006Row,
  PlayerGamelogsYear2007Row,
  PlayerGamelogsYear2008Row,
  PlayerGamelogsYear2009Row,
  PlayerGamelogsYear2010Row,
  PlayerGamelogsYear2011Row,
  PlayerGamelogsYear2012Row,
  PlayerGamelogsYear2013Row,
  PlayerGamelogsYear2014Row,
  PlayerGamelogsYear2015Row,
  PlayerGamelogsYear2016Row,
  PlayerGamelogsYear2017Row,
  PlayerGamelogsYear2018Row,
  PlayerGamelogsYear2019Row,
  PlayerGamelogsYear2020Row,
  PlayerGamelogsYear2021Row,
  PlayerGamelogsYear2022Row,
  PlayerGamelogsYear2023Row,
  PlayerGamelogsYear2024Row,
  PlayerGamelogsYear2025Row,
  PlayerGamelogsYear2026Row,
  PlayerPairCorrelationsRow,
  PlayerPassingGamelogsRow,
  PlayerProspectProfileRow,
  PlayerRankingsHistoryRow,
  PlayerRankingsIndexRow,
  PlayerReceivingGamelogsRow,
  PlayerRushingGamelogsRow,
  PlayerSalariesRow,
  PlayerSeasonlogsRow,
  PlayerTeamExtensionStateRow,
  PlayerVarianceRow,
  PlayersStatusRow,
  PlayoffsRow,
  PoachReleasesRow,
  PoachesRow,
  PositionGameOutcomeDefaultsRow,
  PositionVocabularyBackfillAuditRow,
  PracticeRow,
  ProjectionsHistoryRow,
  ProjectionsHistoryDefaultRow,
  ProjectionsHistoryY2020Row,
  ProjectionsHistoryY2021Row,
  ProjectionsHistoryY2022Row,
  ProjectionsHistoryY2023Row,
  ProjectionsHistoryY2024Row,
  ProjectionsHistoryY2025Row,
  ProjectionsHistoryY2026Row,
  ProjectionsIndexRow,
  ProjectionsIndexDefaultRow,
  ProjectionsIndexY2020Row,
  ProjectionsIndexY2021Row,
  ProjectionsIndexY2022Row,
  ProjectionsIndexY2023Row,
  ProjectionsIndexY2024Row,
  ProjectionsIndexY2025Row,
  ProjectionsIndexY2026Row,
  PropMarketSelectionsHistoryRow,
  PropMarketSelectionsIndexRow,
  PropMarketsHistoryRow,
  PropMarketsIndexRow,
  PropPairingPropsRow,
  PropPairingsRow,
  PropsRow,
  PropsIndexRow,
  RestOfSeasonProjectionsRow,
  RestrictedFreeAgencyBidsRow,
  RestrictedFreeAgencyNominationsRow,
  RestrictedFreeAgencyReleasesRow,
  RosterAssetHoldingRow,
  RosterAssetLineageRefreshStateRow,
  RosterAssetTransformationRow,
  RostersRow,
  RostersPlayersRow,
  ScoringFormatPlayerCareerlogsRow,
  ScoringFormatPlayerGamelogsRow,
  ScoringFormatPlayerProjectionPointsRow,
  ScoringFormatPlayerRestOfSeasonProjectionPointsRow,
  ScoringFormatPlayerSeasonProjectionPointsRow,
  ScoringFormatPlayerSeasonlogsRow,
  SeasonProjectionsHistoryRow,
  SeasonsRow,
  SelectionCombinationDefinitionsRow,
  SelectionCombinationOddsHistoryRow,
  SelectionCombinationOddsIndexRow,
  SourcesRow,
  SuperPriorityRow,
  TeamsRow,
  TradeReleasesRow,
  TradesRow,
  TradesPicksRow,
  TradesPlayersRow,
  TradesSlotsRow,
  TradesTransactionsRow,
  TransactionsRow,
  UrlsRow,
  UserDataViewFavoritesRow,
  UserDataViewTagsRow,
  UserDataViewsRow,
  UserPlaysViewsRow,
  UsersRow,
  UsersSourcesRow,
  UsersTeamsRow,
  WaiverReleasesRow,
  WaiversRow,
  WeeklyMarketSelectionsAnalysisCacheRow
} from './schema-types.js'

declare module 'knex/types/tables' {
  interface Tables {
    admission_vote_ballot_preferences: AdmissionVoteBallotPreferencesRow
    admission_vote_ballots: AdmissionVoteBallotsRow
    admission_vote_candidate_sponsors: AdmissionVoteCandidateSponsorsRow
    admission_vote_candidates: AdmissionVoteCandidatesRow
    admission_vote_eligible_teams: AdmissionVoteEligibleTeamsRow
    admission_votes: AdmissionVotesRow
    adp_format: AdpFormatRow
    bid_changelog: BidChangelogRow
    composite_market_value_blend_weights: CompositeMarketValueBlendWeightsRow
    composite_market_value_calibration: CompositeMarketValueCalibrationRow
    composite_market_value_daily: CompositeMarketValueDailyRow
    config: ConfigRow
    contribution_answers: ContributionAnswersRow
    contribution_events: ContributionEventsRow
    contribution_questions: ContributionQuestionsRow
    contribution_screenshots: ContributionScreenshotsRow
    contribution_submissions: ContributionSubmissionsRow
    contribution_trust_overrides: ContributionTrustOverridesRow
    data_view_sql_audit: DataViewSqlAuditRow
    dfs_contests: DfsContestsRow
    draft: DraftRow
    draftkings_category_activity: DraftkingsCategoryActivityRow
    dvoa_team_drive_seasonlogs: DvoaTeamDriveSeasonlogsRow
    dvoa_team_gamelogs: DvoaTeamGamelogsRow
    dvoa_team_seasonlogs_history: DvoaTeamSeasonlogsHistoryRow
    dvoa_team_seasonlogs_index: DvoaTeamSeasonlogsIndexRow
    dvoa_team_unit_seasonlogs_history: DvoaTeamUnitSeasonlogsHistoryRow
    dvoa_team_unit_seasonlogs_index: DvoaTeamUnitSeasonlogsIndexRow
    espn_player_win_rates_history: EspnPlayerWinRatesHistoryRow
    espn_player_win_rates_index: EspnPlayerWinRatesIndexRow
    espn_receiving_metrics_history: EspnReceivingMetricsHistoryRow
    espn_team_win_rates_history: EspnTeamWinRatesHistoryRow
    espn_team_win_rates_index: EspnTeamWinRatesIndexRow
    external_league_connections: ExternalLeagueConnectionsRow
    external_league_import_jobs: ExternalLeagueImportJobsRow
    external_league_memberships: ExternalLeagueMembershipsRow
    external_league_trade_legs: ExternalLeagueTradeLegsRow
    external_league_trades: ExternalLeagueTradesRow
    external_league_users: ExternalLeagueUsersRow
    external_leagues: ExternalLeaguesRow
    format_category_signal_mapping: FormatCategorySignalMappingRow
    historical_injury_index: HistoricalInjuryIndexRow
    historical_injury_index_2009: HistoricalInjuryIndex2009Row
    historical_injury_index_2010: HistoricalInjuryIndex2010Row
    historical_injury_index_2011: HistoricalInjuryIndex2011Row
    historical_injury_index_2012: HistoricalInjuryIndex2012Row
    historical_injury_index_2013: HistoricalInjuryIndex2013Row
    historical_injury_index_2014: HistoricalInjuryIndex2014Row
    historical_injury_index_2015: HistoricalInjuryIndex2015Row
    historical_injury_index_2016: HistoricalInjuryIndex2016Row
    historical_injury_index_2017: HistoricalInjuryIndex2017Row
    historical_injury_index_2018: HistoricalInjuryIndex2018Row
    historical_injury_index_2019: HistoricalInjuryIndex2019Row
    historical_injury_index_2020: HistoricalInjuryIndex2020Row
    historical_injury_index_2021: HistoricalInjuryIndex2021Row
    historical_injury_index_2022: HistoricalInjuryIndex2022Row
    historical_injury_index_2023: HistoricalInjuryIndex2023Row
    historical_injury_index_2024: HistoricalInjuryIndex2024Row
    historical_injury_index_2025: HistoricalInjuryIndex2025Row
    invite_codes: InviteCodesRow
    jobs: JobsRow
    keeptradecut_liquidity: KeeptradecutLiquidityRow
    keeptradecut_pick: KeeptradecutPickRow
    keeptradecut_valuations: KeeptradecutValuationsRow
    league_baselines: LeagueBaselinesRow
    league_cutlist: LeagueCutlistRow
    league_divisions: LeagueDivisionsRow
    league_format_draft_pick_value: LeagueFormatDraftPickValueRow
    league_format_player_careerlogs: LeagueFormatPlayerCareerlogsRow
    league_format_player_gamelogs: LeagueFormatPlayerGamelogsRow
    league_format_player_projection_values: LeagueFormatPlayerProjectionValuesRow
    league_format_player_projection_values_history: LeagueFormatPlayerProjectionValuesHistoryRow
    league_format_player_rest_of_season_projection_values: LeagueFormatPlayerRestOfSeasonProjectionValuesRow
    league_format_player_rest_of_season_projection_values_history: LeagueFormatPlayerRestOfSeasonProjectionValuesHistoryRow
    league_format_player_season_projection_values: LeagueFormatPlayerSeasonProjectionValuesRow
    league_format_player_seasonlogs: LeagueFormatPlayerSeasonlogsRow
    league_formats: LeagueFormatsRow
    league_migrations: LeagueMigrationsRow
    league_migrations_lock: LeagueMigrationsLockRow
    league_nfl_team_seasonlogs: LeagueNflTeamSeasonlogsRow
    league_notifications: LeagueNotificationsRow
    league_pauses: LeaguePausesRow
    league_player_projection_values: LeaguePlayerProjectionValuesRow
    league_player_rest_of_season_projection_values: LeaguePlayerRestOfSeasonProjectionValuesRow
    league_player_season_projection_values: LeaguePlayerSeasonProjectionValuesRow
    league_player_seasonlogs: LeaguePlayerSeasonlogsRow
    league_scoring_formats: LeagueScoringFormatsRow
    league_season_baselines: LeagueSeasonBaselinesRow
    league_team_careerlogs: LeagueTeamCareerlogsRow
    league_team_daily_values: LeagueTeamDailyValuesRow
    league_team_forecast: LeagueTeamForecastRow
    league_team_lineup_contribution_weeks: LeagueTeamLineupContributionWeeksRow
    league_team_lineup_contributions: LeagueTeamLineupContributionsRow
    league_team_lineup_starters: LeagueTeamLineupStartersRow
    league_team_lineups: LeagueTeamLineupsRow
    league_team_player_seasonlogs: LeagueTeamPlayerSeasonlogsRow
    league_team_seasonlogs: LeagueTeamSeasonlogsRow
    league_user_careerlogs: LeagueUserCareerlogsRow
    leagues: LeaguesRow
    manager_waitlist_submissions: ManagerWaitlistSubmissionsRow
    matchups: MatchupsRow
    nfl_coaches: NflCoachesRow
    nfl_draft_rankings_history: NflDraftRankingsHistoryRow
    nfl_draft_rankings_index: NflDraftRankingsIndexRow
    nfl_game_coaches: NflGameCoachesRow
    nfl_games: NflGamesRow
    nfl_games_changelog: NflGamesChangelogRow
    nfl_matchup_stats: NflMatchupStatsRow
    nfl_play_stats: NflPlayStatsRow
    nfl_play_stats_current_week: NflPlayStatsCurrentWeekRow
    nfl_plays: NflPlaysRow
    nfl_plays_current_week: NflPlaysCurrentWeekRow
    nfl_plays_passer: NflPlaysPasserRow
    nfl_plays_player: NflPlaysPlayerRow
    nfl_plays_receiver: NflPlaysReceiverRow
    nfl_plays_rusher: NflPlaysRusherRow
    nfl_plays_year_2000: NflPlaysYear2000Row
    nfl_plays_year_2001: NflPlaysYear2001Row
    nfl_plays_year_2002: NflPlaysYear2002Row
    nfl_plays_year_2003: NflPlaysYear2003Row
    nfl_plays_year_2004: NflPlaysYear2004Row
    nfl_plays_year_2005: NflPlaysYear2005Row
    nfl_plays_year_2006: NflPlaysYear2006Row
    nfl_plays_year_2007: NflPlaysYear2007Row
    nfl_plays_year_2008: NflPlaysYear2008Row
    nfl_plays_year_2009: NflPlaysYear2009Row
    nfl_plays_year_2010: NflPlaysYear2010Row
    nfl_plays_year_2011: NflPlaysYear2011Row
    nfl_plays_year_2012: NflPlaysYear2012Row
    nfl_plays_year_2013: NflPlaysYear2013Row
    nfl_plays_year_2014: NflPlaysYear2014Row
    nfl_plays_year_2015: NflPlaysYear2015Row
    nfl_plays_year_2016: NflPlaysYear2016Row
    nfl_plays_year_2017: NflPlaysYear2017Row
    nfl_plays_year_2018: NflPlaysYear2018Row
    nfl_plays_year_2019: NflPlaysYear2019Row
    nfl_plays_year_2020: NflPlaysYear2020Row
    nfl_plays_year_2021: NflPlaysYear2021Row
    nfl_plays_year_2022: NflPlaysYear2022Row
    nfl_plays_year_2023: NflPlaysYear2023Row
    nfl_plays_year_2024: NflPlaysYear2024Row
    nfl_plays_year_2025: NflPlaysYear2025Row
    nfl_plays_year_2026: NflPlaysYear2026Row
    nfl_snaps: NflSnapsRow
    nfl_snaps_year_2000: NflSnapsYear2000Row
    nfl_snaps_year_2001: NflSnapsYear2001Row
    nfl_snaps_year_2002: NflSnapsYear2002Row
    nfl_snaps_year_2003: NflSnapsYear2003Row
    nfl_snaps_year_2004: NflSnapsYear2004Row
    nfl_snaps_year_2005: NflSnapsYear2005Row
    nfl_snaps_year_2006: NflSnapsYear2006Row
    nfl_snaps_year_2007: NflSnapsYear2007Row
    nfl_snaps_year_2008: NflSnapsYear2008Row
    nfl_snaps_year_2009: NflSnapsYear2009Row
    nfl_snaps_year_2010: NflSnapsYear2010Row
    nfl_snaps_year_2011: NflSnapsYear2011Row
    nfl_snaps_year_2012: NflSnapsYear2012Row
    nfl_snaps_year_2013: NflSnapsYear2013Row
    nfl_snaps_year_2014: NflSnapsYear2014Row
    nfl_snaps_year_2015: NflSnapsYear2015Row
    nfl_snaps_year_2016: NflSnapsYear2016Row
    nfl_snaps_year_2017: NflSnapsYear2017Row
    nfl_snaps_year_2018: NflSnapsYear2018Row
    nfl_snaps_year_2019: NflSnapsYear2019Row
    nfl_snaps_year_2020: NflSnapsYear2020Row
    nfl_snaps_year_2021: NflSnapsYear2021Row
    nfl_snaps_year_2022: NflSnapsYear2022Row
    nfl_snaps_year_2023: NflSnapsYear2023Row
    nfl_snaps_year_2024: NflSnapsYear2024Row
    nfl_snaps_year_2025: NflSnapsYear2025Row
    nfl_snaps_year_2026: NflSnapsYear2026Row
    nfl_snaps_year_default: NflSnapsYearDefaultRow
    nfl_stadium: NflStadiumRow
    nfl_team_gamelogs: NflTeamGamelogsRow
    nfl_team_seasonlogs: NflTeamSeasonlogsRow
    ngs_prospect_scores_history: NgsProspectScoresHistoryRow
    ngs_prospect_scores_index: NgsProspectScoresIndexRow
    percentiles: PercentilesRow
    pff_player_facet_gamelogs: PffPlayerFacetGamelogsRow
    pff_player_facet_seasonlogs: PffPlayerFacetSeasonlogsRow
    pff_player_gamelogs: PffPlayerGamelogsRow
    pff_player_seasonlogs: PffPlayerSeasonlogsRow
    pff_player_seasonlogs_changelog: PffPlayerSeasonlogsChangelogRow
    pff_team_gamelogs: PffTeamGamelogsRow
    pff_team_seasonlogs: PffTeamSeasonlogsRow
    pff_unresolved_players: PffUnresolvedPlayersRow
    placed_wagers: PlacedWagersRow
    play_changelog: PlayChangelogRow
    player: PlayerRow
    player_adp_history: PlayerAdpHistoryRow
    player_adp_index: PlayerAdpIndexRow
    player_aliases: PlayerAliasesRow
    player_archetypes: PlayerArchetypesRow
    player_changelog: PlayerChangelogRow
    player_college_careerlogs: PlayerCollegeCareerlogsRow
    player_college_seasonlogs: PlayerCollegeSeasonlogsRow
    player_contracts: PlayerContractsRow
    player_defender_gamelogs: PlayerDefenderGamelogsRow
    player_dfs_ownership: PlayerDfsOwnershipRow
    player_field_override: PlayerFieldOverrideRow
    player_game_outcome_correlations: PlayerGameOutcomeCorrelationsRow
    player_gamelogs: PlayerGamelogsRow
    player_gamelogs_default: PlayerGamelogsDefaultRow
    player_gamelogs_year_2000: PlayerGamelogsYear2000Row
    player_gamelogs_year_2001: PlayerGamelogsYear2001Row
    player_gamelogs_year_2002: PlayerGamelogsYear2002Row
    player_gamelogs_year_2003: PlayerGamelogsYear2003Row
    player_gamelogs_year_2004: PlayerGamelogsYear2004Row
    player_gamelogs_year_2005: PlayerGamelogsYear2005Row
    player_gamelogs_year_2006: PlayerGamelogsYear2006Row
    player_gamelogs_year_2007: PlayerGamelogsYear2007Row
    player_gamelogs_year_2008: PlayerGamelogsYear2008Row
    player_gamelogs_year_2009: PlayerGamelogsYear2009Row
    player_gamelogs_year_2010: PlayerGamelogsYear2010Row
    player_gamelogs_year_2011: PlayerGamelogsYear2011Row
    player_gamelogs_year_2012: PlayerGamelogsYear2012Row
    player_gamelogs_year_2013: PlayerGamelogsYear2013Row
    player_gamelogs_year_2014: PlayerGamelogsYear2014Row
    player_gamelogs_year_2015: PlayerGamelogsYear2015Row
    player_gamelogs_year_2016: PlayerGamelogsYear2016Row
    player_gamelogs_year_2017: PlayerGamelogsYear2017Row
    player_gamelogs_year_2018: PlayerGamelogsYear2018Row
    player_gamelogs_year_2019: PlayerGamelogsYear2019Row
    player_gamelogs_year_2020: PlayerGamelogsYear2020Row
    player_gamelogs_year_2021: PlayerGamelogsYear2021Row
    player_gamelogs_year_2022: PlayerGamelogsYear2022Row
    player_gamelogs_year_2023: PlayerGamelogsYear2023Row
    player_gamelogs_year_2024: PlayerGamelogsYear2024Row
    player_gamelogs_year_2025: PlayerGamelogsYear2025Row
    player_gamelogs_year_2026: PlayerGamelogsYear2026Row
    player_pair_correlations: PlayerPairCorrelationsRow
    player_passing_gamelogs: PlayerPassingGamelogsRow
    player_prospect_profile: PlayerProspectProfileRow
    player_rankings_history: PlayerRankingsHistoryRow
    player_rankings_index: PlayerRankingsIndexRow
    player_receiving_gamelogs: PlayerReceivingGamelogsRow
    player_rushing_gamelogs: PlayerRushingGamelogsRow
    player_salaries: PlayerSalariesRow
    player_seasonlogs: PlayerSeasonlogsRow
    player_team_extension_state: PlayerTeamExtensionStateRow
    player_variance: PlayerVarianceRow
    players_status: PlayersStatusRow
    playoffs: PlayoffsRow
    poach_releases: PoachReleasesRow
    poaches: PoachesRow
    position_game_outcome_defaults: PositionGameOutcomeDefaultsRow
    position_vocabulary_backfill_audit: PositionVocabularyBackfillAuditRow
    practice: PracticeRow
    projections_history: ProjectionsHistoryRow
    projections_history_default: ProjectionsHistoryDefaultRow
    projections_history_y2020: ProjectionsHistoryY2020Row
    projections_history_y2021: ProjectionsHistoryY2021Row
    projections_history_y2022: ProjectionsHistoryY2022Row
    projections_history_y2023: ProjectionsHistoryY2023Row
    projections_history_y2024: ProjectionsHistoryY2024Row
    projections_history_y2025: ProjectionsHistoryY2025Row
    projections_history_y2026: ProjectionsHistoryY2026Row
    projections_index: ProjectionsIndexRow
    projections_index_default: ProjectionsIndexDefaultRow
    projections_index_y2020: ProjectionsIndexY2020Row
    projections_index_y2021: ProjectionsIndexY2021Row
    projections_index_y2022: ProjectionsIndexY2022Row
    projections_index_y2023: ProjectionsIndexY2023Row
    projections_index_y2024: ProjectionsIndexY2024Row
    projections_index_y2025: ProjectionsIndexY2025Row
    projections_index_y2026: ProjectionsIndexY2026Row
    prop_market_selections_history: PropMarketSelectionsHistoryRow
    prop_market_selections_index: PropMarketSelectionsIndexRow
    prop_markets_history: PropMarketsHistoryRow
    prop_markets_index: PropMarketsIndexRow
    prop_pairing_props: PropPairingPropsRow
    prop_pairings: PropPairingsRow
    props: PropsRow
    props_index: PropsIndexRow
    rest_of_season_projections: RestOfSeasonProjectionsRow
    restricted_free_agency_bids: RestrictedFreeAgencyBidsRow
    restricted_free_agency_nominations: RestrictedFreeAgencyNominationsRow
    restricted_free_agency_releases: RestrictedFreeAgencyReleasesRow
    roster_asset_holding: RosterAssetHoldingRow
    roster_asset_lineage_refresh_state: RosterAssetLineageRefreshStateRow
    roster_asset_transformation: RosterAssetTransformationRow
    rosters: RostersRow
    rosters_players: RostersPlayersRow
    scoring_format_player_careerlogs: ScoringFormatPlayerCareerlogsRow
    scoring_format_player_gamelogs: ScoringFormatPlayerGamelogsRow
    scoring_format_player_projection_points: ScoringFormatPlayerProjectionPointsRow
    scoring_format_player_rest_of_season_projection_points: ScoringFormatPlayerRestOfSeasonProjectionPointsRow
    scoring_format_player_season_projection_points: ScoringFormatPlayerSeasonProjectionPointsRow
    scoring_format_player_seasonlogs: ScoringFormatPlayerSeasonlogsRow
    season_projections_history: SeasonProjectionsHistoryRow
    seasons: SeasonsRow
    selection_combination_definitions: SelectionCombinationDefinitionsRow
    selection_combination_odds_history: SelectionCombinationOddsHistoryRow
    selection_combination_odds_index: SelectionCombinationOddsIndexRow
    sources: SourcesRow
    super_priority: SuperPriorityRow
    teams: TeamsRow
    trade_releases: TradeReleasesRow
    trades: TradesRow
    trades_picks: TradesPicksRow
    trades_players: TradesPlayersRow
    trades_slots: TradesSlotsRow
    trades_transactions: TradesTransactionsRow
    transactions: TransactionsRow
    urls: UrlsRow
    user_data_view_favorites: UserDataViewFavoritesRow
    user_data_view_tags: UserDataViewTagsRow
    user_data_views: UserDataViewsRow
    user_plays_views: UserPlaysViewsRow
    users: UsersRow
    users_sources: UsersSourcesRow
    users_teams: UsersTeamsRow
    waiver_releases: WaiverReleasesRow
    waivers: WaiversRow
    weekly_market_selections_analysis_cache: WeeklyMarketSelectionsAnalysisCacheRow
  }
}
