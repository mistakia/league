const has_year_filter = (params = {}) => {
  if (!params || params.year == null) return false
  const year_array = Array.isArray(params.year) ? params.year : [params.year]
  return year_array.length > 0
}

const is_historical_team_mode = ({ params = {}, splits = [] } = {}) =>
  has_year_filter(params) || splits.includes('year')

export { is_historical_team_mode }
