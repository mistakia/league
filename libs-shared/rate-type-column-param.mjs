import * as table_constants from 'react-table/src/constants.mjs'

const base_rate_type_param = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: null
}

export const offensive_rate_type_param = {
  ...base_rate_type_param,
  values: [
    { value: null, label: 'None' },
    { value: 'per_game', label: 'Per Game' },
    { value: 'per_team_off_play', label: 'Per Team Offensive Play' },
    { value: 'per_team_off_pass_play', label: 'Per Team Pass Play' },
    { value: 'per_team_off_rush_play', label: 'Per Team Rush Play' },
    { value: 'per_team_off_drive', label: 'Per Team Offensive Drive' },
    { value: 'per_team_off_series', label: 'Per Team Offensive Series' },
    { value: 'per_team_half', label: 'Per Team Half' },
    { value: 'per_team_quarter', label: 'Per Team Quarter' }
  ]
}

export const defensive_rate_type_param = {
  ...base_rate_type_param,
  values: [
    { value: null, label: 'None' },
    { value: 'per_game', label: 'Per Game' },
    { value: 'per_team_def_play', label: 'Per Team Defensive Play' },
    { value: 'per_team_def_drive', label: 'Per Team Defensive Drive' },
    { value: 'per_team_def_series', label: 'Per Team Defensive Series' }
  ]
}
