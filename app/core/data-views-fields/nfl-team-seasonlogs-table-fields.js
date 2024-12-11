import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  common_column_params,
  nfl_plays_team_column_params
} from '@libs-shared'

const { single_year, single_position } = common_column_params
const { matchup_opponent_type } = nfl_plays_team_column_params

const create_seasonlog_field = ({
  column_title,
  header_label,
  player_value_path,
  size = 70,
  column_groups = [COLUMN_GROUPS.NFL_TEAM_SEASON_STATS]
}) => ({
  column_title,
  column_groups,
  header_label,
  player_value_path,
  size,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: single_year,
    matchup_opponent_type,
    single_position,
    stat_type: {
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'TOTAL',
      values: [
        {
          label: 'Offense Total',
          value: 'TOTAL'
        },
        {
          label: 'Defense Total',
          value: 'AGAINST_TOTAL'
        },
        {
          label: 'Offense Average',
          value: 'AVG'
        },
        {
          label: 'Defense Average',
          value: 'AGAINST_AVG'
        },
        {
          label: 'Defense Allowed Over Average',
          value: 'AGAINST_ADJ'
        }
      ]
    },
    time_type: {
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'SEASON',
      values: [
        {
          label: 'Season',
          value: 'SEASON'
        },
        {
          label: 'Last 3 Weeks',
          value: 'LAST_THREE'
        },
        {
          label: 'Last 4 Weeks',
          value: 'LAST_FOUR'
        },
        {
          label: 'Last 8 Weeks',
          value: 'LAST_EIGHT'
        }
      ]
    }
  },
  splits: ['year']
})

export default {
  // Passing Stats
  nfl_team_seasonlogs_pa: create_seasonlog_field({
    column_title: 'Pass Attempts Generated/Allowed By Position',
    header_label: 'PA',
    player_value_path: 'nfl_team_seasonlogs_pa'
  }),
  nfl_team_seasonlogs_pc: create_seasonlog_field({
    column_title: 'Pass Completions Generated/Allowed By Position',
    header_label: 'PC',
    player_value_path: 'nfl_team_seasonlogs_pc'
  }),
  nfl_team_seasonlogs_py: create_seasonlog_field({
    column_title: 'Pass Yards Generated/Allowed By Position',
    header_label: 'PY',
    player_value_path: 'nfl_team_seasonlogs_py'
  }),
  nfl_team_seasonlogs_ints: create_seasonlog_field({
    column_title: 'Interceptions Generated/Allowed By Position',
    header_label: 'INT',
    player_value_path: 'nfl_team_seasonlogs_ints'
  }),
  nfl_team_seasonlogs_tdp: create_seasonlog_field({
    column_title: 'Passing TDs Generated/Allowed By Position',
    header_label: 'TDP',
    player_value_path: 'nfl_team_seasonlogs_tdp'
  }),
  nfl_team_seasonlogs_ra: create_seasonlog_field({
    column_title: 'Rush Attempts Generated/Allowed By Position',
    header_label: 'RA',
    player_value_path: 'nfl_team_seasonlogs_ra'
  }),
  nfl_team_seasonlogs_ry: create_seasonlog_field({
    column_title: 'Rush Yards Generated/Allowed By Position',
    header_label: 'RY',
    player_value_path: 'nfl_team_seasonlogs_ry'
  }),
  nfl_team_seasonlogs_tdr: create_seasonlog_field({
    column_title: 'Rushing TDs Generated/Allowed By Position',
    header_label: 'TDR',
    player_value_path: 'nfl_team_seasonlogs_tdr'
  }),
  nfl_team_seasonlogs_fuml: create_seasonlog_field({
    column_title: 'Fumbles Lost Generated/Allowed By Position',
    header_label: 'FUML',
    player_value_path: 'nfl_team_seasonlogs_fuml'
  }),
  nfl_team_seasonlogs_trg: create_seasonlog_field({
    column_title: 'Targets Generated/Allowed By Position',
    header_label: 'TRG',
    player_value_path: 'nfl_team_seasonlogs_trg'
  }),
  nfl_team_seasonlogs_rec: create_seasonlog_field({
    column_title: 'Receptions Generated/Allowed By Position',
    header_label: 'REC',
    player_value_path: 'nfl_team_seasonlogs_rec'
  }),
  nfl_team_seasonlogs_recy: create_seasonlog_field({
    column_title: 'Receiving Yards Generated/Allowed By Position',
    header_label: 'RECY',
    player_value_path: 'nfl_team_seasonlogs_recy'
  }),
  nfl_team_seasonlogs_tdrec: create_seasonlog_field({
    column_title: 'Receiving TDs Generated/Allowed By Position',
    header_label: 'TDREC',
    player_value_path: 'nfl_team_seasonlogs_tdrec'
  }),
  nfl_team_seasonlogs_twoptc: create_seasonlog_field({
    column_title: 'Two Point Conversions Generated/Allowed By Position',
    header_label: '2PC',
    player_value_path: 'nfl_team_seasonlogs_twoptc'
  }),
  nfl_team_seasonlogs_prtd: create_seasonlog_field({
    column_title: 'Punt Return TDs Generated/Allowed By Position',
    header_label: 'PRTD',
    player_value_path: 'nfl_team_seasonlogs_prtd'
  }),
  nfl_team_seasonlogs_krtd: create_seasonlog_field({
    column_title: 'Kick Return TDs Generated/Allowed By Position',
    header_label: 'KRTD',
    player_value_path: 'nfl_team_seasonlogs_krtd'
  }),
  // nfl_team_seasonlogs_snp: create_seasonlog_field({
  //   column_title: 'Snaps Generated/Allowed By Position',
  //   header_label: 'SNP',
  //   player_value_path: 'nfl_team_seasonlogs_snp'
  // }),
  nfl_team_seasonlogs_fgm: create_seasonlog_field({
    column_title: 'Field Goals Made/Allowed By Position',
    header_label: 'FGM',
    player_value_path: 'nfl_team_seasonlogs_fgm'
  }),
  nfl_team_seasonlogs_fgy: create_seasonlog_field({
    column_title: 'Field Goal Yards Generated/Allowed By Position',
    header_label: 'FGY',
    player_value_path: 'nfl_team_seasonlogs_fgy'
  }),
  nfl_team_seasonlogs_fg19: create_seasonlog_field({
    column_title: 'Field Goals Made 0-19 Yards Generated/Allowed By Position',
    header_label: 'FG19',
    player_value_path: 'nfl_team_seasonlogs_fg19'
  }),
  nfl_team_seasonlogs_fg29: create_seasonlog_field({
    column_title: 'Field Goals Made 20-29 Yards Generated/Allowed By Position',
    header_label: 'FG29',
    player_value_path: 'nfl_team_seasonlogs_fg29'
  }),
  nfl_team_seasonlogs_fg39: create_seasonlog_field({
    column_title: 'Field Goals Made 30-39 Yards Generated/Allowed By Position',
    header_label: 'FG39',
    player_value_path: 'nfl_team_seasonlogs_fg39'
  }),
  nfl_team_seasonlogs_fg49: create_seasonlog_field({
    column_title: 'Field Goals Made 40-49 Yards Generated/Allowed By Position',
    header_label: 'FG49',
    player_value_path: 'nfl_team_seasonlogs_fg49'
  }),
  nfl_team_seasonlogs_fg50: create_seasonlog_field({
    column_title: 'Field Goals Made 50+ Yards Generated/Allowed By Position',
    header_label: 'FG50',
    player_value_path: 'nfl_team_seasonlogs_fg50'
  }),
  nfl_team_seasonlogs_xpm: create_seasonlog_field({
    column_title: 'Extra Points Made Generated/Allowed By Position',
    header_label: 'XPM',
    player_value_path: 'nfl_team_seasonlogs_xpm'
  }),
  nfl_team_seasonlogs_dsk: create_seasonlog_field({
    column_title: 'Defensive Sacks Generated/Allowed By Position',
    header_label: 'DSK',
    player_value_path: 'nfl_team_seasonlogs_dsk'
  }),
  nfl_team_seasonlogs_dint: create_seasonlog_field({
    column_title: 'Defensive Interceptions Generated/Allowed By Position',
    header_label: 'DINT',
    player_value_path: 'nfl_team_seasonlogs_dint'
  }),
  nfl_team_seasonlogs_dff: create_seasonlog_field({
    column_title: 'Defensive Forced Fumbles Generated/Allowed By Position',
    header_label: 'DFF',
    player_value_path: 'nfl_team_seasonlogs_dff'
  }),
  nfl_team_seasonlogs_drf: create_seasonlog_field({
    column_title: 'Defensive Recovered Fumbles Generated/Allowed By Position',
    header_label: 'DRF',
    player_value_path: 'nfl_team_seasonlogs_drf'
  }),
  nfl_team_seasonlogs_dtno: create_seasonlog_field({
    column_title: 'Defensive Three and Outs Generated/Allowed By Position',
    header_label: 'DTNO',
    player_value_path: 'nfl_team_seasonlogs_dtno'
  }),
  nfl_team_seasonlogs_dfds: create_seasonlog_field({
    column_title: 'Defensive Fourth Down Stops Generated/Allowed By Position',
    header_label: 'DFDS',
    player_value_path: 'nfl_team_seasonlogs_dfds'
  }),
  nfl_team_seasonlogs_dpa: create_seasonlog_field({
    column_title: 'Defensive Points Against Generated/Allowed By Position',
    header_label: 'DPA',
    player_value_path: 'nfl_team_seasonlogs_dpa'
  }),
  nfl_team_seasonlogs_dya: create_seasonlog_field({
    column_title: 'Defensive Yards Against Generated/Allowed By Position',
    header_label: 'DYA',
    player_value_path: 'nfl_team_seasonlogs_dya'
  }),
  nfl_team_seasonlogs_dblk: create_seasonlog_field({
    column_title: 'Defensive Blocked Kicks Generated/Allowed By Position',
    header_label: 'DBLK',
    player_value_path: 'nfl_team_seasonlogs_dblk'
  }),
  nfl_team_seasonlogs_dsf: create_seasonlog_field({
    column_title: 'Defensive Safeties Generated/Allowed By Position',
    header_label: 'DSF',
    player_value_path: 'nfl_team_seasonlogs_dsf'
  }),
  nfl_team_seasonlogs_dtpr: create_seasonlog_field({
    column_title: 'Defensive Two Point Returns Generated/Allowed By Position',
    header_label: 'DTPR',
    player_value_path: 'nfl_team_seasonlogs_dtpr'
  }),
  nfl_team_seasonlogs_dtd: create_seasonlog_field({
    column_title: 'Defensive Touchdowns Generated/Allowed By Position',
    header_label: 'DTD',
    player_value_path: 'nfl_team_seasonlogs_dtd'
  }),
  nfl_team_seasonlogs_pass_rating: create_seasonlog_field({
    column_title: 'Passer Rating Generated/Allowed By Position',
    header_label: 'Rating',
    player_value_path: 'nfl_team_seasonlogs_pass_rating'
  }),
  nfl_team_seasonlogs_pass_yards_per_attempt: create_seasonlog_field({
    column_title: 'Pass Yards per Attempt Generated/Allowed By Position',
    header_label: 'Y/A',
    player_value_path: 'nfl_team_seasonlogs_pass_yards_per_attempt'
  }),
  nfl_team_seasonlogs_pass_comp_pct: create_seasonlog_field({
    column_title: 'Pass Completion % Generated/Allowed By Position',
    header_label: 'Comp%',
    player_value_path: 'nfl_team_seasonlogs_pass_comp_pct'
  }),
  nfl_team_seasonlogs_sacks: create_seasonlog_field({
    column_title: 'Sacks Generated/Allowed By Position',
    header_label: 'Sacks',
    player_value_path: 'nfl_team_seasonlogs_sacks'
  }),
  nfl_team_seasonlogs_expected_pass_comp: create_seasonlog_field({
    column_title: 'Expected Pass Completions Generated/Allowed By Position',
    header_label: 'xComp',
    player_value_path: 'nfl_team_seasonlogs_expected_pass_comp'
  }),
  nfl_team_seasonlogs_cpoe: create_seasonlog_field({
    column_title: 'CPOE Generated/Allowed By Position',
    header_label: 'CPOE',
    player_value_path: 'nfl_team_seasonlogs_cpoe'
  }),
  nfl_team_seasonlogs_dropbacks: create_seasonlog_field({
    column_title: 'Dropbacks Generated/Allowed By Position',
    header_label: 'DB',
    player_value_path: 'nfl_team_seasonlogs_dropbacks'
  }),
  nfl_team_seasonlogs_pass_epa: create_seasonlog_field({
    column_title: 'Pass EPA Generated/Allowed By Position',
    header_label: 'EPA',
    player_value_path: 'nfl_team_seasonlogs_pass_epa'
  }),
  nfl_team_seasonlogs_pass_epa_per_db: create_seasonlog_field({
    column_title: 'Pass EPA per Dropback Generated/Allowed By Position',
    header_label: 'EPA/DB',
    player_value_path: 'nfl_team_seasonlogs_pass_epa_per_db'
  }),
  nfl_team_seasonlogs_avg_time_to_throw: create_seasonlog_field({
    column_title: 'Average Time to Throw Generated/Allowed By Position',
    header_label: 'TTT',
    player_value_path: 'nfl_team_seasonlogs_avg_time_to_throw'
  }),
  nfl_team_seasonlogs_avg_time_to_pressure: create_seasonlog_field({
    column_title: 'Average Time to Pressure Generated/Allowed By Position',
    header_label: 'TTP',
    player_value_path: 'nfl_team_seasonlogs_avg_time_to_pressure'
  }),
  nfl_team_seasonlogs_avg_time_to_sack: create_seasonlog_field({
    column_title: 'Average Time to Sack Generated/Allowed By Position',
    header_label: 'TTS',
    player_value_path: 'nfl_team_seasonlogs_avg_time_to_sack'
  }),
  nfl_team_seasonlogs_pressures_against: create_seasonlog_field({
    column_title: 'Pressures Against Generated/Allowed By Position',
    header_label: 'Press',
    player_value_path: 'nfl_team_seasonlogs_pressures_against'
  }),
  nfl_team_seasonlogs_pressure_rate_against: create_seasonlog_field({
    column_title: 'Pressure Rate Against Generated/Allowed By Position',
    header_label: 'Press%',
    player_value_path: 'nfl_team_seasonlogs_pressure_rate_against'
  }),
  nfl_team_seasonlogs_blitz_rate: create_seasonlog_field({
    column_title: 'Blitz Rate Generated/Allowed By Position',
    header_label: 'Blitz%',
    player_value_path: 'nfl_team_seasonlogs_blitz_rate'
  }),
  nfl_team_seasonlogs_pass_drops: create_seasonlog_field({
    column_title: 'Pass Drops Generated/Allowed By Position',
    header_label: 'Drops',
    player_value_path: 'nfl_team_seasonlogs_pass_drops'
  }),
  nfl_team_seasonlogs_drop_rate: create_seasonlog_field({
    column_title: 'Drop Rate Generated/Allowed By Position',
    header_label: 'Drop%',
    player_value_path: 'nfl_team_seasonlogs_drop_rate'
  }),
  nfl_team_seasonlogs_pass_completed_air_yards: create_seasonlog_field({
    column_title: 'Pass Completed Air Yards Generated/Allowed By Position',
    header_label: 'CAY',
    player_value_path: 'nfl_team_seasonlogs_pass_completed_air_yards'
  }),
  nfl_team_seasonlogs_pass_yards_after_catch: create_seasonlog_field({
    column_title: 'Pass Yards After Catch Generated/Allowed By Position',
    header_label: 'YAC',
    player_value_path: 'nfl_team_seasonlogs_pass_yards_after_catch'
  }),
  nfl_team_seasonlogs_expected_pass_yards_after_catch: create_seasonlog_field({
    column_title: 'Expected Pass YAC Generated/Allowed By Position',
    header_label: 'xYAC',
    player_value_path: 'nfl_team_seasonlogs_expected_pass_yards_after_catch'
  }),
  nfl_team_seasonlogs_pass_yards_after_catch_pct: create_seasonlog_field({
    column_title: 'Pass YAC % Generated/Allowed By Position',
    header_label: 'YAC%',
    player_value_path: 'nfl_team_seasonlogs_pass_yards_after_catch_pct'
  }),
  nfl_team_seasonlogs_air_yards_per_pass_att: create_seasonlog_field({
    column_title: 'Air Yards per Pass Attempt Generated/Allowed By Position',
    header_label: 'AY/Att',
    player_value_path: 'nfl_team_seasonlogs_air_yards_per_pass_att'
  }),
  nfl_team_seasonlogs_avg_target_separation: create_seasonlog_field({
    column_title: 'Average Target Separation Generated/Allowed By Position',
    header_label: 'Sep',
    player_value_path: 'nfl_team_seasonlogs_avg_target_separation'
  }),
  nfl_team_seasonlogs_deep_pass_att_pct: create_seasonlog_field({
    column_title: 'Deep Pass Attempt % Generated/Allowed By Position',
    header_label: 'Deep%',
    player_value_path: 'nfl_team_seasonlogs_deep_pass_att_pct'
  }),
  nfl_team_seasonlogs_tight_window_pct: create_seasonlog_field({
    column_title: 'Tight Window % Generated/Allowed By Position',
    header_label: 'Tight%',
    player_value_path: 'nfl_team_seasonlogs_tight_window_pct'
  }),
  nfl_team_seasonlogs_play_action_pct: create_seasonlog_field({
    column_title: 'Play Action % Generated/Allowed By Position',
    header_label: 'PA%',
    player_value_path: 'nfl_team_seasonlogs_play_action_pct'
  }),
  nfl_team_seasonlogs_rush_epa: create_seasonlog_field({
    column_title: 'Rush EPA Generated/Allowed By Position',
    header_label: 'REPA',
    player_value_path: 'nfl_team_seasonlogs_rush_epa'
  }),
  nfl_team_seasonlogs_rush_epa_per_attempt: create_seasonlog_field({
    column_title: 'Rush EPA per Attempt Generated/Allowed By Position',
    header_label: 'REPA/Att',
    player_value_path: 'nfl_team_seasonlogs_rush_epa_per_attempt'
  }),
  nfl_team_seasonlogs_expected_rush_yards: create_seasonlog_field({
    column_title: 'Expected Rush Yards Generated/Allowed By Position',
    header_label: 'xRY',
    player_value_path: 'nfl_team_seasonlogs_expected_rush_yards'
  }),
  nfl_team_seasonlogs_expected_rush_yards_per_attempt: create_seasonlog_field({
    column_title:
      'Expected Rush Yards per Attempt Generated/Allowed By Position',
    header_label: 'xRY/Att',
    player_value_path: 'nfl_team_seasonlogs_expected_rush_yards_per_attempt'
  }),
  nfl_team_seasonlogs_rush_yards_over_expected: create_seasonlog_field({
    column_title: 'Rush Yards Over Expected Generated/Allowed By Position',
    header_label: 'RYOE',
    player_value_path: 'nfl_team_seasonlogs_rush_yards_over_expected'
  }),
  nfl_team_seasonlogs_rush_yards_over_expected_per_attempt:
    create_seasonlog_field({
      column_title:
        'Rush Yards Over Expected per Attempt Generated/Allowed By Position',
      header_label: 'RYOE/Att',
      player_value_path:
        'nfl_team_seasonlogs_rush_yards_over_expected_per_attempt'
    }),
  nfl_team_seasonlogs_rush_yards_after_contact: create_seasonlog_field({
    column_title: 'Rush Yards After Contact Generated/Allowed By Position',
    header_label: 'YAC',
    player_value_path: 'nfl_team_seasonlogs_rush_yards_after_contact'
  }),
  nfl_team_seasonlogs_rush_yards_after_contact_per_attempt:
    create_seasonlog_field({
      column_title:
        'Rush Yards After Contact per Attempt Generated/Allowed By Position',
      header_label: 'YAC/Att',
      player_value_path:
        'nfl_team_seasonlogs_rush_yards_after_contact_per_attempt'
    }),
  nfl_team_seasonlogs_rush_yards_before_contact: create_seasonlog_field({
    column_title: 'Rush Yards Before Contact Generated/Allowed By Position',
    header_label: 'YBC',
    player_value_path: 'nfl_team_seasonlogs_rush_yards_before_contact'
  }),
  nfl_team_seasonlogs_rush_yards_before_contact_per_attempt:
    create_seasonlog_field({
      column_title:
        'Rush Yards Before Contact per Attempt Generated/Allowed By Position',
      header_label: 'YBC/Att',
      player_value_path:
        'nfl_team_seasonlogs_rush_yards_before_contact_per_attempt'
    }),
  nfl_team_seasonlogs_rush_success_rate: create_seasonlog_field({
    column_title: 'Rush Success Rate Generated/Allowed By Position',
    header_label: 'RSR',
    player_value_path: 'nfl_team_seasonlogs_rush_success_rate'
  }),
  nfl_team_seasonlogs_rush_attempts_yards_10_plus: create_seasonlog_field({
    column_title: 'Rush Attempts 10+ Yards Generated/Allowed By Position',
    header_label: '10+',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_yards_10_plus'
  }),
  nfl_team_seasonlogs_rush_attempts_speed_15_plus_mph: create_seasonlog_field({
    column_title: 'Rush Attempts 15+ MPH Generated/Allowed By Position',
    header_label: '15+MPH',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_speed_15_plus_mph'
  }),
  nfl_team_seasonlogs_rush_attempts_speed_20_plus_mph: create_seasonlog_field({
    column_title: 'Rush Attempts 20+ MPH Generated/Allowed By Position',
    header_label: '20+MPH',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_speed_20_plus_mph'
  }),
  nfl_team_seasonlogs_rush_avg_time_to_line_of_scrimmage:
    create_seasonlog_field({
      column_title:
        'Average Time to Line of Scrimmage Generated/Allowed By Position',
      header_label: 'TTLOS',
      player_value_path:
        'nfl_team_seasonlogs_rush_avg_time_to_line_of_scrimmage'
    }),
  nfl_team_seasonlogs_rush_attempts_inside_tackles_pct: create_seasonlog_field({
    column_title:
      'Rush Attempts Inside Tackles % Generated/Allowed By Position',
    header_label: 'Inside%',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_inside_tackles_pct'
  }),
  nfl_team_seasonlogs_rush_attempts_stacked_box_pct: create_seasonlog_field({
    column_title:
      'Rush Attempts vs Stacked Box % Generated/Allowed By Position',
    header_label: 'Stack%',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_stacked_box_pct'
  }),
  nfl_team_seasonlogs_rush_attempts_under_center_pct: create_seasonlog_field({
    column_title: 'Rush Attempts Under Center % Generated/Allowed By Position',
    header_label: 'UC%',
    player_value_path: 'nfl_team_seasonlogs_rush_attempts_under_center_pct'
  }),
  nfl_team_seasonlogs_longest_rush: create_seasonlog_field({
    column_title: 'Longest Rush Generated/Allowed By Position',
    header_label: 'Long',
    player_value_path: 'nfl_team_seasonlogs_longest_rush'
  }),
  nfl_team_seasonlogs_rush_yards_per_attempt: create_seasonlog_field({
    column_title: 'Rush Yards per Attempt Generated/Allowed By Position',
    header_label: 'Y/A',
    player_value_path: 'nfl_team_seasonlogs_rush_yards_per_attempt'
  }),
  nfl_team_seasonlogs_rush_yards_10_plus_rate: create_seasonlog_field({
    column_title: 'Rush Yards 10+ Rate Generated/Allowed By Position',
    header_label: '10+%',
    player_value_path: 'nfl_team_seasonlogs_rush_yards_10_plus_rate'
  }),
  nfl_team_seasonlogs_routes: create_seasonlog_field({
    column_title: 'Routes Run Generated/Allowed By Position',
    header_label: 'Routes',
    player_value_path: 'nfl_team_seasonlogs_routes'
  }),
  nfl_team_seasonlogs_receiving_passer_rating: create_seasonlog_field({
    column_title: 'Receiving Passer Rating Generated/Allowed By Position',
    header_label: 'Rating',
    player_value_path: 'nfl_team_seasonlogs_receiving_passer_rating'
  }),
  nfl_team_seasonlogs_catch_rate: create_seasonlog_field({
    column_title: 'Catch Rate Generated/Allowed By Position',
    header_label: 'Catch%',
    player_value_path: 'nfl_team_seasonlogs_catch_rate'
  }),
  nfl_team_seasonlogs_expected_catch_rate: create_seasonlog_field({
    column_title: 'Expected Catch Rate Generated/Allowed By Position',
    header_label: 'xCatch%',
    player_value_path: 'nfl_team_seasonlogs_expected_catch_rate'
  }),
  nfl_team_seasonlogs_catch_rate_over_expected: create_seasonlog_field({
    column_title: 'Catch Rate Over Expected Generated/Allowed By Position',
    header_label: 'CROE',
    player_value_path: 'nfl_team_seasonlogs_catch_rate_over_expected'
  }),
  nfl_team_seasonlogs_recv_yards_per_reception: create_seasonlog_field({
    column_title: 'Receiving Yards per Reception Generated/Allowed By Position',
    header_label: 'Y/R',
    player_value_path: 'nfl_team_seasonlogs_recv_yards_per_reception'
  }),
  nfl_team_seasonlogs_recv_yards_per_route: create_seasonlog_field({
    column_title: 'Receiving Yards per Route Generated/Allowed By Position',
    header_label: 'Y/Rt',
    player_value_path: 'nfl_team_seasonlogs_recv_yards_per_route'
  }),
  nfl_team_seasonlogs_recv_epa: create_seasonlog_field({
    column_title: 'Receiving EPA Generated/Allowed By Position',
    header_label: 'RecEPA',
    player_value_path: 'nfl_team_seasonlogs_recv_epa'
  }),
  nfl_team_seasonlogs_recv_epa_per_target: create_seasonlog_field({
    column_title: 'Receiving EPA per Target Generated/Allowed By Position',
    header_label: 'EPA/Tgt',
    player_value_path: 'nfl_team_seasonlogs_recv_epa_per_target'
  }),
  nfl_team_seasonlogs_recv_epa_per_route: create_seasonlog_field({
    column_title: 'Receiving EPA per Route Generated/Allowed By Position',
    header_label: 'EPA/Rt',
    player_value_path: 'nfl_team_seasonlogs_recv_epa_per_route'
  }),
  nfl_team_seasonlogs_recv_drops: create_seasonlog_field({
    column_title: 'Receiving Drops Generated/Allowed By Position',
    header_label: 'Drops',
    player_value_path: 'nfl_team_seasonlogs_recv_drops'
  }),
  nfl_team_seasonlogs_recv_drop_rate: create_seasonlog_field({
    column_title: 'Receiving Drop Rate Generated/Allowed By Position',
    header_label: 'Drop%',
    player_value_path: 'nfl_team_seasonlogs_recv_drop_rate'
  }),
  nfl_team_seasonlogs_recv_yards_after_catch: create_seasonlog_field({
    column_title: 'Receiving Yards After Catch Generated/Allowed By Position',
    header_label: 'YAC',
    player_value_path: 'nfl_team_seasonlogs_recv_yards_after_catch'
  }),
  nfl_team_seasonlogs_expected_recv_yards_after_catch: create_seasonlog_field({
    column_title: 'Expected Receiving YAC Generated/Allowed By Position',
    header_label: 'xYAC',
    player_value_path: 'nfl_team_seasonlogs_expected_recv_yards_after_catch'
  }),
  nfl_team_seasonlogs_recv_yards_after_catch_over_expected:
    create_seasonlog_field({
      column_title: 'Receiving YAC Over Expected Generated/Allowed By Position',
      header_label: 'YACOE',
      player_value_path:
        'nfl_team_seasonlogs_recv_yards_after_catch_over_expected'
    }),
  nfl_team_seasonlogs_recv_yards_after_catch_per_reception:
    create_seasonlog_field({
      column_title: 'Receiving YAC per Reception Generated/Allowed By Position',
      header_label: 'YAC/Rec',
      player_value_path:
        'nfl_team_seasonlogs_recv_yards_after_catch_per_reception'
    }),
  nfl_team_seasonlogs_recv_avg_target_separation: create_seasonlog_field({
    column_title: 'Average Target Separation Generated/Allowed By Position',
    header_label: 'Sep',
    player_value_path: 'nfl_team_seasonlogs_recv_avg_target_separation'
  }),
  nfl_team_seasonlogs_recv_air_yards: create_seasonlog_field({
    column_title: 'Receiving Air Yards Generated/Allowed By Position',
    header_label: 'AirYds',
    player_value_path: 'nfl_team_seasonlogs_recv_air_yards'
  }),
  nfl_team_seasonlogs_recv_air_yards_per_target: create_seasonlog_field({
    column_title:
      'Receiving Air Yards per Target Generated/Allowed By Position',
    header_label: 'AirYds/Tgt',
    player_value_path: 'nfl_team_seasonlogs_recv_air_yards_per_target'
  }),
  nfl_team_seasonlogs_target_rate: create_seasonlog_field({
    column_title: 'Target Rate Generated/Allowed By Position',
    header_label: 'Tgt%',
    player_value_path: 'nfl_team_seasonlogs_target_rate'
  }),
  nfl_team_seasonlogs_avg_route_depth: create_seasonlog_field({
    column_title: 'Average Route Depth Generated/Allowed By Position',
    header_label: 'AvgDepth',
    player_value_path: 'nfl_team_seasonlogs_avg_route_depth'
  }),
  nfl_team_seasonlogs_endzone_targets: create_seasonlog_field({
    column_title: 'Endzone Targets Generated/Allowed By Position',
    header_label: 'EZTgt',
    player_value_path: 'nfl_team_seasonlogs_endzone_targets'
  }),
  nfl_team_seasonlogs_endzone_recs: create_seasonlog_field({
    column_title: 'Endzone Receptions Generated/Allowed By Position',
    header_label: 'EZRec',
    player_value_path: 'nfl_team_seasonlogs_endzone_recs'
  }),
  nfl_team_seasonlogs_team_target_share: create_seasonlog_field({
    column_title: 'Team Target Share Generated/Allowed By Position',
    header_label: 'TgtShare',
    player_value_path: 'nfl_team_seasonlogs_team_target_share'
  }),
  nfl_team_seasonlogs_team_air_yard_share: create_seasonlog_field({
    column_title: 'Team Air Yard Share Generated/Allowed By Position',
    header_label: 'AirShare',
    player_value_path: 'nfl_team_seasonlogs_team_air_yard_share'
  }),
  nfl_team_seasonlogs_recv_deep_target_pct: create_seasonlog_field({
    column_title: 'Deep Target Percentage Generated/Allowed By Position',
    header_label: 'Deep%',
    player_value_path: 'nfl_team_seasonlogs_recv_deep_target_pct'
  }),
  nfl_team_seasonlogs_recv_tight_window_pct: create_seasonlog_field({
    column_title: 'Tight Window Percentage Generated/Allowed By Position',
    header_label: 'Tight%',
    player_value_path: 'nfl_team_seasonlogs_recv_tight_window_pct'
  }),
  nfl_team_seasonlogs_longest_reception: create_seasonlog_field({
    column_title: 'Longest Reception Generated/Allowed By Position',
    header_label: 'Long',
    player_value_path: 'nfl_team_seasonlogs_longest_reception'
  }),
  nfl_team_seasonlogs_recv_yards_15_plus_rate: create_seasonlog_field({
    column_title: 'Reception Rate 15+ Yards Generated/Allowed By Position',
    header_label: '15+%',
    player_value_path: 'nfl_team_seasonlogs_recv_yards_15_plus_rate'
  })
}
