import * as constants from './constants.mjs'

export const stat_in_year_week =
  (stat_desc) =>
  ({ params = {} } = {}) => {
    const { year = constants.season.year, week = 0 } = params
    return `${stat_desc}_in_${year}_week_${week}`
  }
