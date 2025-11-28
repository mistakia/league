import {
  available_years,
  current_season,
  nfl_weeks,
  fantasy_positions,
  nfl_season_types
} from '#constants'
import * as table_constants from 'react-table/src/constants.mjs'

export const career_year = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  min: 1,
  max: 25,
  preset_values: [
    {
      label: 'First/Rookie Year',
      values: [1, 1]
    },
    {
      label: 'Second/Sophomore Year',
      values: [2, 2]
    },
    {
      label: 'Third/Junior Year',
      values: [3, 3]
    },
    {
      label: 'First Two Years',
      values: [1, 2]
    },
    {
      label: 'First Three Years',
      values: [1, 3]
    }
  ]
}

export const career_game = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  min: 1,
  max: 500,
  preset_values: [
    {
      label: 'First Game',
      values: [1, 1]
    },
    {
      label: 'First 10 Games',
      values: [1, 10]
    },
    {
      label: 'First 25 Games',
      values: [1, 25]
    }
  ]
}

export const year = {
  values: available_years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: current_season.stats_season_year,
  dynamic_values: [
    {
      dynamic_type: 'last_n_years',
      label: 'Last N Years',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'next_n_years',
      label: 'Next N Years',
      default_value: 3,
      has_value_field: true
    }
  ]
}

export const single_year = {
  values: available_years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: current_season.stats_season_year,
  enable_multi_on_split: ['year']
}

export const week = {
  values: nfl_weeks,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  dynamic_values: [
    {
      dynamic_type: 'last_n_weeks',
      label: 'Last N Weeks',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'next_n_weeks',
      label: 'Next N Weeks',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'current_week',
      label: 'Current Week'
    }
  ]
}

export const single_week = {
  values: nfl_weeks,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: Math.max(current_season.week, 1),
  enable_multi_on_split: ['week'],
  dynamic_values: [
    {
      dynamic_type: 'current_week',
      label: 'Current Week'
    }
  ]
}

export const year_offset = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Year + N',
  min: -30,
  max: 30,
  enable_on_splits: ['year']
}

export const single_year_offset = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Year + N',
  min: -30,
  max: 30,
  default_value: 0,
  is_single: true,
  enable_on_splits: ['year']
}

export const single_position = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  values: fantasy_positions,
  default_value: 'QB'
}

export const seas_type = {
  values: nfl_season_types,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: 'REG'
}

export const single_seas_type = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  values: nfl_season_types,
  default_value: 'REG'
}
