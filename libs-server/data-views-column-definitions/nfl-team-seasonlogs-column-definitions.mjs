import { constants } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import db from '#db'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.stats_season_year]
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

  const stat_key = get_stat_key({
    single_position,
    team_unit,
    stat_type,
    time_type
  })

  return { year, stat_key, matchup_opponent_type }
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

const nfl_team_seasonlogs_join = (join_arguments) => {
  const { params = {} } = join_arguments
  const { stat_key } = get_default_params({ params })

  data_view_join_function({
    ...join_arguments,
    join_year: true,
    default_year: constants.season.stats_season_year,
    join_table_clause: `nfl_team_seasonlogs as ${join_arguments.table_name}`,
    join_on_team: true,
    join_table_team_field: 'tm',
    additional_conditions: function () {
      if (stat_key) {
        this.andOn(
          `${join_arguments.table_name}.stat_key`,
          '=',
          db.raw('?', [stat_key])
        )
      }
    }
  })
}

const create_field_from_nfl_team_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `nfl_team_seasonlogs_${column_name}`,
  table_name: 'nfl_team_seasonlogs',
  table_alias: nfl_team_seasonlogs_table_alias,
  join: nfl_team_seasonlogs_join,
  supported_splits: ['year']
})

export default {
  nfl_team_seasonlogs_pa: create_field_from_nfl_team_seasonlogs('pa'),
  nfl_team_seasonlogs_pc: create_field_from_nfl_team_seasonlogs('pc'),
  nfl_team_seasonlogs_py: create_field_from_nfl_team_seasonlogs('py'),
  nfl_team_seasonlogs_ints: create_field_from_nfl_team_seasonlogs('ints'),
  nfl_team_seasonlogs_tdp: create_field_from_nfl_team_seasonlogs('tdp'),
  nfl_team_seasonlogs_ra: create_field_from_nfl_team_seasonlogs('ra'),
  nfl_team_seasonlogs_ry: create_field_from_nfl_team_seasonlogs('ry'),
  nfl_team_seasonlogs_tdr: create_field_from_nfl_team_seasonlogs('tdr'),
  nfl_team_seasonlogs_fuml: create_field_from_nfl_team_seasonlogs('fuml'),
  nfl_team_seasonlogs_trg: create_field_from_nfl_team_seasonlogs('trg'),
  nfl_team_seasonlogs_rec: create_field_from_nfl_team_seasonlogs('rec'),
  nfl_team_seasonlogs_recy: create_field_from_nfl_team_seasonlogs('recy'),
  nfl_team_seasonlogs_tdrec: create_field_from_nfl_team_seasonlogs('tdrec'),
  nfl_team_seasonlogs_twoptc: create_field_from_nfl_team_seasonlogs('twoptc'),
  nfl_team_seasonlogs_prtd: create_field_from_nfl_team_seasonlogs('prtd'),
  nfl_team_seasonlogs_krtd: create_field_from_nfl_team_seasonlogs('krtd'),
  nfl_team_seasonlogs_snp: create_field_from_nfl_team_seasonlogs('snp'),
  nfl_team_seasonlogs_fgm: create_field_from_nfl_team_seasonlogs('fgm'),
  nfl_team_seasonlogs_fgy: create_field_from_nfl_team_seasonlogs('fgy'),
  nfl_team_seasonlogs_fg19: create_field_from_nfl_team_seasonlogs('fg19'),
  nfl_team_seasonlogs_fg29: create_field_from_nfl_team_seasonlogs('fg29'),
  nfl_team_seasonlogs_fg39: create_field_from_nfl_team_seasonlogs('fg39'),
  nfl_team_seasonlogs_fg49: create_field_from_nfl_team_seasonlogs('fg49'),
  nfl_team_seasonlogs_fg50: create_field_from_nfl_team_seasonlogs('fg50'),
  nfl_team_seasonlogs_xpm: create_field_from_nfl_team_seasonlogs('xpm'),
  nfl_team_seasonlogs_dsk: create_field_from_nfl_team_seasonlogs('dsk'),
  nfl_team_seasonlogs_dint: create_field_from_nfl_team_seasonlogs('dint'),
  nfl_team_seasonlogs_dff: create_field_from_nfl_team_seasonlogs('dff'),
  nfl_team_seasonlogs_drf: create_field_from_nfl_team_seasonlogs('drf'),
  nfl_team_seasonlogs_dtno: create_field_from_nfl_team_seasonlogs('dtno'),
  nfl_team_seasonlogs_dfds: create_field_from_nfl_team_seasonlogs('dfds'),
  nfl_team_seasonlogs_dpa: create_field_from_nfl_team_seasonlogs('dpa'),
  nfl_team_seasonlogs_dya: create_field_from_nfl_team_seasonlogs('dya'),
  nfl_team_seasonlogs_dblk: create_field_from_nfl_team_seasonlogs('dblk'),
  nfl_team_seasonlogs_dsf: create_field_from_nfl_team_seasonlogs('dsf'),
  nfl_team_seasonlogs_dtpr: create_field_from_nfl_team_seasonlogs('dtpr'),
  nfl_team_seasonlogs_dtd: create_field_from_nfl_team_seasonlogs('dtd'),
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
