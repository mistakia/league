// Physical season-grain column names, keyed by PHYSICAL table name.
//
// The data-view row-axis vocabulary is stable: callers, params, row_axes and CTE
// output all speak 'year' / 'seas_type'. Only the underlying physical columns were
// conformed to season_year / season_type. So a query built against a CTE alias keeps
// the vocabulary names (the CTE aliases them back), while a query built directly
// against one of these physical tables must emit the conformed names.
//
// apply_scope_to_query DEFAULTS its year_column / seas_type_column through these
// resolvers, so a new physical-table emitter cannot silently drift back to the
// pre-rename names by simply forgetting to pass them. That drift is not
// hypothetical: build_role_union_period_cte emitted nfl_plays.year against the
// renamed table and the regenerated query-match goldens blessed it, because a
// golden regenerated from buggy code agrees with the buggy code.
//
// Tables absent from the map fall back to the vocabulary names, which is correct
// for CTE aliases (they alias back) and is why the map must list every physical
// table an emitter can target. test/libs-server.physical-season-columns.spec.mjs
// checks the map against db/schema.postgres.sql in both directions, so a table
// conformed to season_year but left out of the map fails the suite.

const PHYSICAL_YEAR_COLUMN = {
  nfl_games: 'season_year',
  nfl_plays: 'season_year',
  nfl_plays_current_week: 'season_year',
  nfl_plays_passer: 'season_year',
  nfl_plays_player: 'season_year',
  nfl_plays_receiver: 'season_year',
  nfl_plays_rusher: 'season_year',
  nfl_snaps: 'season_year'
}

const PHYSICAL_SEAS_TYPE_COLUMN = {
  nfl_games: 'season_type',
  nfl_plays: 'season_type',
  nfl_plays_current_week: 'season_type'
}

// nfl_snaps and the nfl_plays_{passer,receiver,rusher,player} participant tables
// carry season_year but have NO season-type column at all. They are listed
// explicitly rather than merely omitted so that asking for their seas_type column
// is a loud error instead of a silent fall back to 'seas_type' and a 42703 at
// runtime: a seas_type predicate against them is a bug in the caller. Callers
// that target these tables pass has_seas_type: false, and apply_scope_to_query
// only resolves the seas_type column when it is actually going to emit one.
const TABLES_WITHOUT_SEAS_TYPE = new Set([
  'nfl_plays_passer',
  'nfl_plays_player',
  'nfl_plays_receiver',
  'nfl_plays_rusher',
  'nfl_snaps'
])

export const physical_year_column = (table_name) =>
  PHYSICAL_YEAR_COLUMN[table_name] || 'year'

export const physical_seas_type_column = (table_name) => {
  if (TABLES_WITHOUT_SEAS_TYPE.has(table_name)) {
    throw new Error(
      `${table_name} has no season-type column; pass has_seas_type: false rather than filtering it by seas_type`
    )
  }
  return PHYSICAL_SEAS_TYPE_COLUMN[table_name] || 'seas_type'
}

export const physical_table_names = () => Object.keys(PHYSICAL_YEAR_COLUMN)

export const tables_without_seas_type = () => new Set(TABLES_WITHOUT_SEAS_TYPE)
