import * as table_constants from 'react-table/src/constants.mjs'

export { default as is_play_level_rate_type } from './is-play-level-rate-type.mjs'

const base_rate_type_param = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: null
}

const base_rate_type_param_values = [
  { value: null, label: 'None' },
  { value: 'per_game', label: 'Per Game' },
  { value: 'per_team_play', label: 'Per Team Play' },
  { value: 'per_team_pass_play', label: 'Per Team Pass Play' },
  { value: 'per_team_rush_play', label: 'Per Team Rush Play' },
  { value: 'per_team_drive', label: 'Per Team Drive' },
  { value: 'per_team_series', label: 'Per Team Series' },
  { value: 'per_team_half', label: 'Per Team Half' },
  { value: 'per_team_quarter', label: 'Per Team Quarter' }
]

const player_rate_type_param_values = [
  { value: 'per_player_play', label: 'Per Player Play' },
  { value: 'per_player_route', label: 'Per Player Route' },
  { value: 'per_player_pass_play', label: 'Per Player Pass Play' },
  { value: 'per_player_rush_play', label: 'Per Player Rush Play' }
]

const param_override_config = {
  label: 'Denominator Parameters',
  toggle_param: 'rate_type_match_column_params',
  override_param: 'rate_type_column_params',
  disabled_values: [null, 'per_game', 'per_team_half', 'per_team_quarter'],
  overridable_param_filter: {
    exclude_groups: [
      'Weather',
      'Game',
      'Betting Markets',
      'Pace',
      'Play Timeout'
    ],
    exclude_param_names: [
      'year',
      'week',
      'year_offset',
      'week_offset',
      'seas_type',
      'career_year',
      'career_game',
      'rate_type',
      'rate_type_match_column_params',
      'rate_type_column_params'
    ]
  }
}

export const offensive_rate_type_param = {
  ...base_rate_type_param,
  param_override_config,
  values: base_rate_type_param_values
}

export const defensive_player_rate_type_param = {
  ...base_rate_type_param,
  param_override_config,
  values: [...base_rate_type_param_values, ...player_rate_type_param_values]
}

export const offensive_player_rate_type_param = {
  ...base_rate_type_param,
  param_override_config,
  values: [
    ...base_rate_type_param_values,
    ...player_rate_type_param_values,
    { value: 'per_player_rush_attempt', label: 'Per Player Rush Attempt' },
    { value: 'per_player_pass_attempt', label: 'Per Player Pass Attempt' },
    { value: 'per_player_target', label: 'Per Player Target' },
    {
      value: 'per_player_catchable_target',
      label: 'Per Player Catchable Target'
    },
    { value: 'per_player_deep_target', label: 'Per Player Deep Target' },
    {
      value: 'per_player_catchable_deep_target',
      label: 'Per Player Catchable Deep Target'
    },
    { value: 'per_player_reception', label: 'Per Player Reception' }
  ]
}
