import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

// TODO should use scoring_format_id instead of league_id
const default_league_id = 1

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  const single_position = Array.isArray(params.single_position)
    ? params.single_position[0]
    : params.single_position
  const team_unit = Array.isArray(params.team_unit)
    ? params.team_unit[0]
    : params.team_unit
  const stat_type = Array.isArray(params.stat_type)
    ? params.stat_type[0]
    : params.stat_type
  const time_type = Array.isArray(params.time_type)
    ? params.time_type[0]
    : params.time_type

  const league_id =
    (Array.isArray(params.league_id)
      ? params.league_id[0]
      : params.league_id) || default_league_id

  const stat_key = get_stat_key({
    single_position,
    team_unit,
    stat_type,
    time_type
  })

  return { year, stat_key, matchup_opponent_type, league_id }
}

const get_stat_key = ({
  single_position = 'QB',
  stat_type = 'TOTAL',
  time_type = 'SEASON'
}) => {
  return `${single_position}_${stat_type}${time_type === 'SEASON' ? '' : `_${time_type}`}`
}

const nfl_team_seasonlogs_table_alias = ({ params = {} }) => {
  const { year, stat_key } = get_default_params({ params })
  return get_table_hash(`nfl_team_seasonlogs_${year.join('_')}_${stat_key}`)
}

const league_nfl_team_seasonlogs_table_alias = ({ params = {} }) => {
  const { year, stat_key, league_id } = get_default_params({ params })
  return get_table_hash(
    `league_nfl_team_seasonlogs_${year.join('_')}_${stat_key}_${league_id}`
  )
}

const year_default = (params) => {
  const raw = params.year ?? current_season.stats_season_year
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map(Number)
}

const nfl_team_source = {
  table: 'nfl_team_seasonlogs',
  grain: 'team_year',
  key_columns: { team: 'tm', year: 'year' },
  year_default,
  extra_predicates: (params) => {
    const { stat_key } = get_default_params({ params })
    return stat_key ? [{ column: 'stat_key', value: stat_key }] : []
  }
}

const league_nfl_team_source = {
  table: 'league_nfl_team_seasonlogs',
  grain: 'team_year',
  key_columns: { team: 'tm', year: 'year' },
  year_default,
  extra_predicates: (params) => {
    const { stat_key, league_id } = get_default_params({ params })
    return [
      { column: 'lid', value: league_id },
      { column: 'stat_key', value: stat_key }
    ]
  }
}

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const year = Array.isArray(params.year)
      ? params.year[0]
      : params.year || current_season.stats_season_year
    return { year: [year] }
  }
})

// Range year_offset reduction per column (select-string defaults to SUM).
// Rates, ratios, per-attempt/per-route/per-target/per-reception averages,
// percentages, passer ratings, cpoe, EPA-per-unit, time-to averages, and
// team-share fractions are NOT additive across a multi-year window -- they
// must AVG. Longest rush/reception take the window MAX. Everything else (raw
// yard/EPA/attempt/reception/drop/td counts) is additive and keeps the SUM
// default.
const NFL_TEAM_SEASONLOGS_AVG_COLUMNS = [
  'pass_rating',
  'pass_yards_per_attempt',
  'pass_comp_pct',
  'expected_pass_comp',
  'cpoe',
  'pass_epa_per_db',
  'avg_time_to_throw',
  'avg_time_to_pressure',
  'avg_time_to_sack',
  'pressure_rate_against',
  'blitz_rate',
  'drop_rate',
  'pass_yards_after_catch_pct',
  'air_yards_per_pass_att',
  'avg_target_separation',
  'deep_pass_att_pct',
  'tight_window_pct',
  'play_action_pct',
  'rush_epa_per_attempt',
  'expected_rush_yards_per_attempt',
  'rush_yards_over_expected_per_attempt',
  'rush_yards_after_contact_per_attempt',
  'rush_yards_before_contact_per_attempt',
  'rush_success_rate',
  'rush_avg_time_to_line_of_scrimmage',
  'rush_attempts_inside_tackles_pct',
  'rush_attempts_stacked_box_pct',
  'rush_attempts_under_center_pct',
  'rush_yards_per_attempt',
  'rush_yards_10_plus_rate',
  'receiving_passer_rating',
  'catch_rate',
  'expected_catch_rate',
  'catch_rate_over_expected',
  'recv_yards_per_reception',
  'recv_yards_per_route',
  'recv_epa_per_target',
  'recv_epa_per_route',
  'recv_drop_rate',
  'recv_yards_after_catch_per_reception',
  'recv_avg_target_separation',
  'recv_air_yards_per_target',
  'target_rate',
  'avg_route_depth',
  'team_target_share',
  'team_air_yard_share',
  'recv_deep_target_pct',
  'recv_tight_window_pct',
  'recv_yards_15_plus_rate'
]

const NFL_TEAM_SEASONLOGS_RANGE_OFFSET_AGGREGATE = {
  ...Object.fromEntries(
    NFL_TEAM_SEASONLOGS_AVG_COLUMNS.map((column_name) => [column_name, 'AVG'])
  ),
  longest_rush: 'MAX',
  longest_reception: 'MAX'
}

const create_field_from_nfl_team_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `nfl_team_seasonlogs_${column_name}`,
  table_name: 'nfl_team_seasonlogs',
  table_alias: nfl_team_seasonlogs_table_alias,
  source: nfl_team_source,
  range_offset_aggregate:
    NFL_TEAM_SEASONLOGS_RANGE_OFFSET_AGGREGATE[column_name],
  get_cache_info
})

const create_field_from_league_nfl_team_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `league_nfl_team_seasonlogs_${column_name}`,
  table_name: 'league_nfl_team_seasonlogs',
  table_alias: league_nfl_team_seasonlogs_table_alias,
  source: league_nfl_team_source,
  // rnk is a league rank (AVG across the window); pts is additive fantasy
  // points (SUM default).
  range_offset_aggregate: column_name === 'rnk' ? 'AVG' : undefined,
  get_cache_info
})

export default {
  league_nfl_team_seasonlogs_points:
    create_field_from_league_nfl_team_seasonlogs('pts'),
  league_nfl_team_seasonlogs_rank:
    create_field_from_league_nfl_team_seasonlogs('rnk'),
  nfl_team_seasonlogs_passing_attempts:
    create_field_from_nfl_team_seasonlogs('passing_attempts'),
  nfl_team_seasonlogs_passing_completions:
    create_field_from_nfl_team_seasonlogs('passing_completions'),
  nfl_team_seasonlogs_passing_yards:
    create_field_from_nfl_team_seasonlogs('passing_yards'),
  nfl_team_seasonlogs_passing_interceptions:
    create_field_from_nfl_team_seasonlogs('passing_interceptions'),
  nfl_team_seasonlogs_passing_touchdowns:
    create_field_from_nfl_team_seasonlogs('passing_touchdowns'),
  nfl_team_seasonlogs_rushing_attempts:
    create_field_from_nfl_team_seasonlogs('rushing_attempts'),
  nfl_team_seasonlogs_rushing_yards:
    create_field_from_nfl_team_seasonlogs('rushing_yards'),
  nfl_team_seasonlogs_rushing_touchdowns:
    create_field_from_nfl_team_seasonlogs('rushing_touchdowns'),
  nfl_team_seasonlogs_fumbles_lost:
    create_field_from_nfl_team_seasonlogs('fumbles_lost'),
  nfl_team_seasonlogs_targets: create_field_from_nfl_team_seasonlogs('targets'),
  nfl_team_seasonlogs_receptions:
    create_field_from_nfl_team_seasonlogs('receptions'),
  nfl_team_seasonlogs_receiving_yards:
    create_field_from_nfl_team_seasonlogs('receiving_yards'),
  nfl_team_seasonlogs_receiving_touchdowns:
    create_field_from_nfl_team_seasonlogs('receiving_touchdowns'),
  nfl_team_seasonlogs_two_point_conversions:
    create_field_from_nfl_team_seasonlogs('two_point_conversions'),
  nfl_team_seasonlogs_punt_return_touchdowns:
    create_field_from_nfl_team_seasonlogs('punt_return_touchdowns'),
  nfl_team_seasonlogs_kickoff_return_touchdowns:
    create_field_from_nfl_team_seasonlogs('kickoff_return_touchdowns'),
  nfl_team_seasonlogs_field_goals_made:
    create_field_from_nfl_team_seasonlogs('field_goals_made'),
  nfl_team_seasonlogs_field_goal_yards:
    create_field_from_nfl_team_seasonlogs('field_goal_yards'),
  nfl_team_seasonlogs_field_goals_made_0_19_yards:
    create_field_from_nfl_team_seasonlogs('field_goals_made_0_19_yards'),
  nfl_team_seasonlogs_field_goals_made_20_29_yards:
    create_field_from_nfl_team_seasonlogs('field_goals_made_20_29_yards'),
  nfl_team_seasonlogs_field_goals_made_30_39_yards:
    create_field_from_nfl_team_seasonlogs('field_goals_made_30_39_yards'),
  nfl_team_seasonlogs_field_goals_made_40_49_yards:
    create_field_from_nfl_team_seasonlogs('field_goals_made_40_49_yards'),
  nfl_team_seasonlogs_field_goals_made_50_plus_yards:
    create_field_from_nfl_team_seasonlogs('field_goals_made_50_plus_yards'),
  nfl_team_seasonlogs_extra_points_made:
    create_field_from_nfl_team_seasonlogs('extra_points_made'),
  nfl_team_seasonlogs_defensive_sacks:
    create_field_from_nfl_team_seasonlogs('defensive_sacks'),
  nfl_team_seasonlogs_defensive_interceptions:
    create_field_from_nfl_team_seasonlogs('defensive_interceptions'),
  nfl_team_seasonlogs_defensive_forced_fumbles:
    create_field_from_nfl_team_seasonlogs('defensive_forced_fumbles'),
  nfl_team_seasonlogs_defensive_recovered_fumbles:
    create_field_from_nfl_team_seasonlogs('defensive_recovered_fumbles'),
  nfl_team_seasonlogs_defensive_three_and_outs:
    create_field_from_nfl_team_seasonlogs('defensive_three_and_outs'),
  nfl_team_seasonlogs_defensive_fourth_down_stops:
    create_field_from_nfl_team_seasonlogs('defensive_fourth_down_stops'),
  nfl_team_seasonlogs_defensive_points_against:
    create_field_from_nfl_team_seasonlogs('defensive_points_against'),
  nfl_team_seasonlogs_defensive_yards_against:
    create_field_from_nfl_team_seasonlogs('defensive_yards_against'),
  nfl_team_seasonlogs_defensive_blocked_kicks:
    create_field_from_nfl_team_seasonlogs('defensive_blocked_kicks'),
  nfl_team_seasonlogs_defensive_safeties:
    create_field_from_nfl_team_seasonlogs('defensive_safeties'),
  nfl_team_seasonlogs_defensive_two_point_returns:
    create_field_from_nfl_team_seasonlogs('defensive_two_point_returns'),
  nfl_team_seasonlogs_defensive_touchdowns:
    create_field_from_nfl_team_seasonlogs('defensive_touchdowns'),
  nfl_team_seasonlogs_pass_rating:
    create_field_from_nfl_team_seasonlogs('pass_rating'),
  nfl_team_seasonlogs_pass_yards_per_attempt:
    create_field_from_nfl_team_seasonlogs('pass_yards_per_attempt'),
  nfl_team_seasonlogs_pass_comp_pct:
    create_field_from_nfl_team_seasonlogs('pass_comp_pct'),
  nfl_team_seasonlogs_sacks: create_field_from_nfl_team_seasonlogs('sacks'),
  nfl_team_seasonlogs_expected_pass_comp:
    create_field_from_nfl_team_seasonlogs('expected_pass_comp'),
  nfl_team_seasonlogs_cpoe: create_field_from_nfl_team_seasonlogs('cpoe'),
  nfl_team_seasonlogs_dropbacks:
    create_field_from_nfl_team_seasonlogs('dropbacks'),
  nfl_team_seasonlogs_pass_epa:
    create_field_from_nfl_team_seasonlogs('pass_epa'),
  nfl_team_seasonlogs_pass_epa_per_db:
    create_field_from_nfl_team_seasonlogs('pass_epa_per_db'),
  nfl_team_seasonlogs_avg_time_to_throw:
    create_field_from_nfl_team_seasonlogs('avg_time_to_throw'),
  nfl_team_seasonlogs_avg_time_to_pressure:
    create_field_from_nfl_team_seasonlogs('avg_time_to_pressure'),
  nfl_team_seasonlogs_avg_time_to_sack:
    create_field_from_nfl_team_seasonlogs('avg_time_to_sack'),
  nfl_team_seasonlogs_pressures_against:
    create_field_from_nfl_team_seasonlogs('pressures_against'),
  nfl_team_seasonlogs_pressure_rate_against:
    create_field_from_nfl_team_seasonlogs('pressure_rate_against'),
  nfl_team_seasonlogs_blitz_rate:
    create_field_from_nfl_team_seasonlogs('blitz_rate'),
  nfl_team_seasonlogs_pass_drops:
    create_field_from_nfl_team_seasonlogs('pass_drops'),
  nfl_team_seasonlogs_drop_rate:
    create_field_from_nfl_team_seasonlogs('drop_rate'),
  nfl_team_seasonlogs_pass_completed_air_yards:
    create_field_from_nfl_team_seasonlogs('pass_completed_air_yards'),
  nfl_team_seasonlogs_pass_yards_after_catch:
    create_field_from_nfl_team_seasonlogs('pass_yards_after_catch'),
  nfl_team_seasonlogs_expected_pass_yards_after_catch:
    create_field_from_nfl_team_seasonlogs('expected_pass_yards_after_catch'),
  nfl_team_seasonlogs_pass_yards_after_catch_pct:
    create_field_from_nfl_team_seasonlogs('pass_yards_after_catch_pct'),
  nfl_team_seasonlogs_air_yards_per_pass_att:
    create_field_from_nfl_team_seasonlogs('air_yards_per_pass_att'),
  nfl_team_seasonlogs_avg_target_separation:
    create_field_from_nfl_team_seasonlogs('avg_target_separation'),
  nfl_team_seasonlogs_deep_pass_att_pct:
    create_field_from_nfl_team_seasonlogs('deep_pass_att_pct'),
  nfl_team_seasonlogs_tight_window_pct:
    create_field_from_nfl_team_seasonlogs('tight_window_pct'),
  nfl_team_seasonlogs_play_action_pct:
    create_field_from_nfl_team_seasonlogs('play_action_pct'),
  nfl_team_seasonlogs_rush_epa:
    create_field_from_nfl_team_seasonlogs('rush_epa'),
  nfl_team_seasonlogs_rush_epa_per_attempt:
    create_field_from_nfl_team_seasonlogs('rush_epa_per_attempt'),
  nfl_team_seasonlogs_expected_rush_yards:
    create_field_from_nfl_team_seasonlogs('expected_rush_yards'),
  nfl_team_seasonlogs_expected_rush_yards_per_attempt:
    create_field_from_nfl_team_seasonlogs('expected_rush_yards_per_attempt'),
  nfl_team_seasonlogs_rush_yards_over_expected:
    create_field_from_nfl_team_seasonlogs('rush_yards_over_expected'),
  nfl_team_seasonlogs_rush_yards_over_expected_per_attempt:
    create_field_from_nfl_team_seasonlogs(
      'rush_yards_over_expected_per_attempt'
    ),
  nfl_team_seasonlogs_rush_yards_after_contact:
    create_field_from_nfl_team_seasonlogs('rush_yards_after_contact'),
  nfl_team_seasonlogs_rush_yards_after_contact_per_attempt:
    create_field_from_nfl_team_seasonlogs(
      'rush_yards_after_contact_per_attempt'
    ),
  nfl_team_seasonlogs_rush_yards_before_contact:
    create_field_from_nfl_team_seasonlogs('rush_yards_before_contact'),
  nfl_team_seasonlogs_rush_yards_before_contact_per_attempt:
    create_field_from_nfl_team_seasonlogs(
      'rush_yards_before_contact_per_attempt'
    ),
  nfl_team_seasonlogs_rush_success_rate:
    create_field_from_nfl_team_seasonlogs('rush_success_rate'),
  nfl_team_seasonlogs_rush_attempts_yards_10_plus:
    create_field_from_nfl_team_seasonlogs('rush_attempts_yards_10_plus'),
  nfl_team_seasonlogs_rush_attempts_speed_15_plus_mph:
    create_field_from_nfl_team_seasonlogs('rush_attempts_speed_15_plus_mph'),
  nfl_team_seasonlogs_rush_attempts_speed_20_plus_mph:
    create_field_from_nfl_team_seasonlogs('rush_attempts_speed_20_plus_mph'),
  nfl_team_seasonlogs_rush_avg_time_to_line_of_scrimmage:
    create_field_from_nfl_team_seasonlogs('rush_avg_time_to_line_of_scrimmage'),
  nfl_team_seasonlogs_rush_attempts_inside_tackles_pct:
    create_field_from_nfl_team_seasonlogs('rush_attempts_inside_tackles_pct'),
  nfl_team_seasonlogs_rush_attempts_stacked_box_pct:
    create_field_from_nfl_team_seasonlogs('rush_attempts_stacked_box_pct'),
  nfl_team_seasonlogs_rush_attempts_under_center_pct:
    create_field_from_nfl_team_seasonlogs('rush_attempts_under_center_pct'),
  nfl_team_seasonlogs_longest_rush:
    create_field_from_nfl_team_seasonlogs('longest_rush'),
  nfl_team_seasonlogs_rush_yards_per_attempt:
    create_field_from_nfl_team_seasonlogs('rush_yards_per_attempt'),
  nfl_team_seasonlogs_rush_yards_10_plus_rate:
    create_field_from_nfl_team_seasonlogs('rush_yards_10_plus_rate'),
  nfl_team_seasonlogs_routes: create_field_from_nfl_team_seasonlogs('routes'),
  nfl_team_seasonlogs_receiving_passer_rating:
    create_field_from_nfl_team_seasonlogs('receiving_passer_rating'),
  nfl_team_seasonlogs_catch_rate:
    create_field_from_nfl_team_seasonlogs('catch_rate'),
  nfl_team_seasonlogs_expected_catch_rate:
    create_field_from_nfl_team_seasonlogs('expected_catch_rate'),
  nfl_team_seasonlogs_catch_rate_over_expected:
    create_field_from_nfl_team_seasonlogs('catch_rate_over_expected'),
  nfl_team_seasonlogs_recv_yards_per_reception:
    create_field_from_nfl_team_seasonlogs('recv_yards_per_reception'),
  nfl_team_seasonlogs_recv_yards_per_route:
    create_field_from_nfl_team_seasonlogs('recv_yards_per_route'),
  nfl_team_seasonlogs_recv_epa:
    create_field_from_nfl_team_seasonlogs('recv_epa'),
  nfl_team_seasonlogs_recv_epa_per_target:
    create_field_from_nfl_team_seasonlogs('recv_epa_per_target'),
  nfl_team_seasonlogs_recv_epa_per_route:
    create_field_from_nfl_team_seasonlogs('recv_epa_per_route'),
  nfl_team_seasonlogs_recv_drops:
    create_field_from_nfl_team_seasonlogs('recv_drops'),
  nfl_team_seasonlogs_recv_drop_rate:
    create_field_from_nfl_team_seasonlogs('recv_drop_rate'),
  nfl_team_seasonlogs_recv_yards_after_catch:
    create_field_from_nfl_team_seasonlogs('recv_yards_after_catch'),
  nfl_team_seasonlogs_expected_recv_yards_after_catch:
    create_field_from_nfl_team_seasonlogs('expected_recv_yards_after_catch'),
  nfl_team_seasonlogs_recv_yards_after_catch_over_expected:
    create_field_from_nfl_team_seasonlogs(
      'recv_yards_after_catch_over_expected'
    ),
  nfl_team_seasonlogs_recv_yards_after_catch_per_reception:
    create_field_from_nfl_team_seasonlogs(
      'recv_yards_after_catch_per_reception'
    ),
  nfl_team_seasonlogs_recv_avg_target_separation:
    create_field_from_nfl_team_seasonlogs('recv_avg_target_separation'),
  nfl_team_seasonlogs_recv_air_yards:
    create_field_from_nfl_team_seasonlogs('recv_air_yards'),
  nfl_team_seasonlogs_recv_air_yards_per_target:
    create_field_from_nfl_team_seasonlogs('recv_air_yards_per_target'),
  nfl_team_seasonlogs_target_rate:
    create_field_from_nfl_team_seasonlogs('target_rate'),
  nfl_team_seasonlogs_avg_route_depth:
    create_field_from_nfl_team_seasonlogs('avg_route_depth'),
  nfl_team_seasonlogs_endzone_targets:
    create_field_from_nfl_team_seasonlogs('endzone_targets'),
  nfl_team_seasonlogs_endzone_recs:
    create_field_from_nfl_team_seasonlogs('endzone_recs'),
  nfl_team_seasonlogs_team_target_share:
    create_field_from_nfl_team_seasonlogs('team_target_share'),
  nfl_team_seasonlogs_team_air_yard_share:
    create_field_from_nfl_team_seasonlogs('team_air_yard_share'),
  nfl_team_seasonlogs_recv_deep_target_pct:
    create_field_from_nfl_team_seasonlogs('recv_deep_target_pct'),
  nfl_team_seasonlogs_recv_tight_window_pct:
    create_field_from_nfl_team_seasonlogs('recv_tight_window_pct'),
  nfl_team_seasonlogs_longest_reception:
    create_field_from_nfl_team_seasonlogs('longest_reception'),
  nfl_team_seasonlogs_recv_yards_15_plus_rate:
    create_field_from_nfl_team_seasonlogs('recv_yards_15_plus_rate')
}
