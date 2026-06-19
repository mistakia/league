export const is_year_offset_range = (params) =>
  Boolean(
    params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      params.year_offset[0] !== params.year_offset[1]
  )

// A year_offset range only has meaning for sources that carry a year dimension
// (grain 'player_year' / 'team_year'). Year-less sources (grain 'player' /
// 'team' -- player/team table, contract, dfs, practice, betting markets,
// projected, extended-salary, careerlogs) have no per-season row to range over,
// so the correlated-aggregate branch in select-string would mis-fire: it
// re-scans the base `player` table into a `pid = pid` tautology (SUM of the
// column over EVERY player), references a JOIN alias that
// skip_join_for_offset_range has already dropped (invalid SQL), or SUMs a
// year-less text/boolean column (invalid SQL). A UI can only ever attach a
// year_offset to a seasonal source; a hand-crafted URL can inject
// year_offset:[a,b] onto any column, so guard the range branch here rather than
// trusting the request shape.
// A source carries a year dimension that a year_offset range can shift when its
// grain names a year ('player_year' / 'team_year') OR it declares a year_default
// (its own year basis the offset shifts -- e.g. player-projected, whose grain is
// the year-less 'player' but which is keyed by projection year). The grain field
// is overloaded: from-plays / projected sources set it to the wrap SUBJECT
// ('player' / 'team') rather than the year-dimensionality, so neither signal
// alone is sufficient -- take the union. Truly year-less sources (player/team
// table, contract, dfs, practice, betting markets, careerlogs, extended-salary)
// have neither.
export const source_carries_year_dimension = (column_definition) =>
  (typeof column_definition?.source?.grain === 'string' &&
    column_definition.source.grain.includes('year')) ||
  typeof column_definition?.source?.year_default === 'function'

// True when a year_offset range is both present AND meaningful for the column.
// A range is meaningful when the source carries a year dimension (the generic
// correlated-aggregate branch can filter its `year` column) OR the column
// declares a main_select_string_year_offset_range override (it reduces its own
// window -- e.g. the from-plays CTE columns). Used by select-string (whether to
// emit / yield to the offset-range path) and get-data-view-results (whether the
// source JOIN can be dropped) so the two stay consistent: a year-less source
// with no override falls through to its normal single-value join in both places.
export const year_offset_range_applies = (column_definition, params) =>
  is_year_offset_range(params) &&
  (source_carries_year_dimension(column_definition) ||
    typeof column_definition?.main_select_string_year_offset_range ===
      'function')
