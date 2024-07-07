import * as constants from './constants.mjs'

export const stat_in_year_week =
  (stat_desc) =>
  ({ params = {} } = {}) => {
    const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
    const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
    return `${stat_desc}_in_${year}_week_${week}`
  }
