import * as table_constants from 'react-table/src/constants.mjs'

const base_rate_type_param = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: null
}

const offensive_rate_type_param_values = [
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

export const offensive_rate_type_param = {
  ...base_rate_type_param,
  values: offensive_rate_type_param_values
}

export const defensive_rate_type_param = {
  ...base_rate_type_param,
  values: [
    { value: null, label: 'None' },
    { value: 'per_game', label: 'Per Game' },
    { value: 'per_team_play', label: 'Per Team Play' },
    { value: 'per_team_drive', label: 'Per Team Drive' },
    { value: 'per_team_series', label: 'Per Team Series' }
  ]
}

export const player_rate_type_param = {
  ...base_rate_type_param,
  values: [
    ...offensive_rate_type_param_values,
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
    }
  ]
}
