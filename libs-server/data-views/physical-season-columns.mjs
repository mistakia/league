// Physical season-grain column names, keyed by PHYSICAL table name.
//
// The data-view row-axis vocabulary is stable: callers, params, row_axes and CTE
// output all speak 'year' / 'seas_type'. Only the underlying physical columns were
// conformed to season_year / season_type. So a query built against a CTE alias keeps
// the vocabulary names (the CTE aliases them back), while a query built directly
// against one of these physical tables must emit the conformed names.
//
// Every apply_scope_to_query call site that targets a PHYSICAL table resolves its
// year_column / seas_type_column through here rather than hardcoding, so a new
// physical-table emitter cannot silently drift back to the pre-rename names. That
// drift is not hypothetical: build_role_union_period_cte emitted nfl_plays.year
// against the renamed table and the regenerated query-match goldens blessed it,
// because a golden regenerated from buggy code agrees with the buggy code.
//
// Tables absent from these maps fall back to the vocabulary names, which is correct
// for CTE aliases (they alias back).
//
// NOTE: nfl_snaps and the nfl_plays_{passer,receiver,rusher,player} participant
// tables carry season_year but have NO season type column at all, so they are
// deliberately omitted -- a seas_type predicate against them is a bug in the caller,
// not something a default should paper over.

const PHYSICAL_YEAR_COLUMN = {
  nfl_plays: 'season_year',
  nfl_plays_current_week: 'season_year',
  nfl_games: 'season_year'
}

const PHYSICAL_SEAS_TYPE_COLUMN = {
  nfl_plays: 'season_type',
  nfl_plays_current_week: 'season_type',
  nfl_games: 'season_type'
}

export const physical_year_column = (table_name) =>
  PHYSICAL_YEAR_COLUMN[table_name] || 'year'

export const physical_seas_type_column = (table_name) =>
  PHYSICAL_SEAS_TYPE_COLUMN[table_name] || 'seas_type'
