import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import { decompose_nfl_weeks } from '#libs-shared/nfl-week-identifier.mjs'

export default function get_effective_years({
  params = {},
  data_view_options = {}
} = {}) {
  const nfl_week = resolve_nfl_week_id_from_year_param(params)
  const { years: all_years } = nfl_week.length
    ? decompose_nfl_weeks({ nfl_weeks: nfl_week })
    : { years: [] }
  return data_view_options.year_range && data_view_options.year_range.length
    ? [...new Set([...data_view_options.year_range, ...all_years])].sort(
        (a, b) => a - b
      )
    : all_years
}
