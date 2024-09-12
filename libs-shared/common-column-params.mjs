import * as constants from './constants.mjs'
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
  values: constants.years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: constants.season.stats_season_year,
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
  values: constants.years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: constants.season.stats_season_year,
  enable_multi_on_split: ['year']
}

export const week = {
  values: constants.nfl_weeks,
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
    }
  ]
}

export const single_week = {
  values: constants.nfl_weeks,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: Math.max(constants.season.week, 1),
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
  default_value: 0,
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
