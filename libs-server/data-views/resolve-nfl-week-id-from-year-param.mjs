import { get_nfl_week_identifiers_for_year } from '#libs-shared/nfl-week-identifier.mjs'

/**
 * Resolves nfl_week_id values from params, falling back to converting
 * year param to nfl_week_id when nfl_week_id is not explicitly set.
 *
 * Play-based columns filter via nfl_week_id rather than year directly.
 * When a column has year param set but no nfl_week_id, this function
 * generates the equivalent nfl_week_id values from the year.
 */
export default function resolve_nfl_week_id_from_year_param(params = {}) {
  let nfl_week = params.nfl_week_id || []
  if (!Array.isArray(nfl_week)) {
    nfl_week = [nfl_week]
  }

  if (!nfl_week.length && params.year) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    const valid_years = year_array
      .map((y) => parseInt(y, 10))
      .filter((y) => !isNaN(y))
    if (valid_years.length) {
      nfl_week = valid_years.flatMap((y) =>
        get_nfl_week_identifiers_for_year({ year: y })
      )
    }
  }

  return nfl_week
}
