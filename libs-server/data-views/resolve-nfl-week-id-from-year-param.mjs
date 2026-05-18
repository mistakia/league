import { get_nfl_week_identifiers_for_year } from '#libs-shared/nfl-week-identifier.mjs'

/**
 * Resolves nfl_week_id values from params, falling back to converting
 * year + seas_type params to nfl_week_id when nfl_week_id is not
 * explicitly set.
 *
 * nfl_week_id is the canonical filter at the params layer. When the user
 * supplies only year (and optionally seas_type), this expands to the full
 * cross-product of (year, seas_type) weeks. seas_type defaults to ['REG'];
 * the apply helper emits derived year/seas_type predicates alongside the
 * IN-list to engage partition pruning and (year, seas_type, ...) composite
 * indexes on nfl_plays.
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
      const seas_type_array = Array.isArray(params.seas_type)
        ? params.seas_type
        : params.seas_type
          ? [params.seas_type]
          : ['REG']
      nfl_week = valid_years.flatMap((y) =>
        seas_type_array.flatMap((st) =>
          get_nfl_week_identifiers_for_year({ year: y, seas_type: st })
        )
      )
    }
  }

  return nfl_week
}
