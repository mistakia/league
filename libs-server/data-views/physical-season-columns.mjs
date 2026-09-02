// Physical season-grain column names, keyed by PHYSICAL table name.
//
// The data-view row-axis vocabulary is stable: callers, params, row_axes and CTE
// output all speak 'year' / 'seas_type'. Only the underlying physical columns were
// conformed to season_year / season_type. So a query built against a CTE alias keeps
// the vocabulary names (the CTE aliases them back), while a query built directly
// against one of these physical tables must emit the conformed names.
//
// apply_scope_to_query DEFAULTS its season_year_column / season_type_column
// through these resolvers, so a new physical-table emitter cannot drift back to the
// pre-rename names by simply forgetting to pass them. That drift is not
// hypothetical: build_role_union_period_cte emitted nfl_plays.year against the
// renamed table and the regenerated query-match goldens blessed it, because a
// golden regenerated from buggy code agrees with the buggy code.
//
// Tables absent from the map fall back to the vocabulary names in the COLUMN
// resolvers, which is correct for CTE aliases (they alias back) and is why the
// map must list every physical table an emitter can target. The PROJECTION
// resolvers refuse an absent name instead -- see the note above them for why
// the two halves differ. test/libs-server.physical-season-columns.spec.mjs
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
  nfl_snaps: 'season_year',
  player_gamelogs: 'season_year'
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
// that target these tables pass has_season_type: false, and apply_scope_to_query
// only resolves the seas_type column when it is actually going to emit one.
const TABLES_WITHOUT_SEAS_TYPE = new Set([
  'nfl_plays_passer',
  'nfl_plays_player',
  'nfl_plays_receiver',
  'nfl_plays_rusher',
  'nfl_snaps',
  'player_gamelogs'
])

// nfl_week_id is a GENERATED column and only two tables carry one. Declared as
// an inclusion set rather than an exclusion set because the map's fallback for
// an unregistered name is a CTE alias, and a CTE alias projects the vocabulary
// columns without ever projecting nfl_week_id -- so "absent from the map" has to
// mean "no nfl_week_id" or an emitter targeting an alias emits a 42703. Callers
// pass has_nfl_week_id: false for a table that carries none; apply_scope_to_query
// then leaves the (year, seas_type) predicates to do the pruning on their own.
const TABLES_WITH_NFL_WEEK_ID = new Set(['nfl_games', 'nfl_plays'])

export const physical_year_column = (table_name) =>
  PHYSICAL_YEAR_COLUMN[table_name] || 'year'

export const physical_seas_type_column = (table_name) => {
  if (TABLES_WITHOUT_SEAS_TYPE.has(table_name)) {
    throw new Error(
      `${table_name} has no season-type column; pass has_season_type: false rather than filtering it by seas_type`
    )
  }
  return PHYSICAL_SEAS_TYPE_COLUMN[table_name] || 'seas_type'
}

export const physical_has_seas_type = (table_name) =>
  !TABLES_WITHOUT_SEAS_TYPE.has(table_name)

export const physical_has_nfl_week_id = (table_name) =>
  TABLES_WITH_NFL_WEEK_ID.has(table_name)

// The PROJECTION half of the boundary, single-sourced for the same reason the
// predicate half is. apply_scope_to_query has defaulted its predicate columns
// through the resolvers above since the conform, so a new physical table cannot
// drift back to the pre-rename name in a WHERE clause. The projection side had
// no such resolver: every CTE that emits the row axis hand-wrote
// '<table>.season_year as year', which is the same drift surface with none of
// the defence -- and build_period_cte imported this module four times while
// still hand-writing the literal twice.
//
// `as year` is not a compatibility alias and must not be read as one. The
// data-view row-axis vocabulary is 'year' because a short URL encodes it and a
// short URL is IMMUTABLE once shared -- see the June 2026 splits -> row_axes
// incident in the header of db/gates/check-data-view-url-param-coverage.mjs,
// where 188 of 682 production URLs rendered at the wrong grain for six weeks.
// The vocabulary stays; only the physical side moves. This function IS that
// boundary, expressed once.
//
// Emit the GROUP BY through physical_year_group_by rather than hand-writing it
// beside a derived projection: the two must name the same physical column or
// Postgres rejects the statement, so deriving one and hardcoding the other
// reintroduces exactly the divergence this module exists to prevent.
// Two shapes, because the emitters genuinely have two. Most select a qualified
// expression against a joined statement; a few interpolate into a raw column
// list whose FROM is already the physical table, where a qualified name would
// change the emitted SQL for no gain and this repo pins generated SQL in
// query-match goldens. Pick the one matching the site rather than requalifying
// it -- a golden churned for cosmetics is a golden nobody reads.
// The PREDICATE resolvers above fall back for an unregistered name and the
// PROJECTION resolvers below refuse one, and the asymmetry is deliberate rather
// than an oversight. apply_scope_to_query is handed the relation the predicate
// must be QUALIFIED BY, which is routinely a CTE alias -- the cohort expansion
// joins player_gamelogs as `pg`, and every from-plays source-attach passes a
// hashed `tXXXX` -- so its fallback is exercised on every request and is what
// makes an alias emit the vocabulary names the CTE aliased back. A projection
// is the opposite: it exists to name the PHYSICAL column of a physical table,
// so an unregistered name there is a caller error every time. There were no
// alias callers when this refusal landed, and a CTE that genuinely wants to
// re-project its own aliased-back column writes `<alias>.year as year`
// directly -- the residue scan in the spec anchors on `season_year as year`
// and does not flag it.
//
// The direction this closes: a misspelling or an alias silently produced
// `<name>.year as year`, which satisfies the schema-conformance ratchet
// (nothing about it is a conformed column name) and then throws 42703 at
// runtime, or worse resolves against a real `year` column meaning something
// else. Hit while routing a projection through this helper as advised.
const assert_registered = (table_name, helper_name) => {
  if (!Object.prototype.hasOwnProperty.call(PHYSICAL_YEAR_COLUMN, table_name)) {
    throw new Error(
      `${helper_name}: ${table_name} is not a registered physical table. Register it in physical-season-columns, or -- if this is a CTE alias that already aliases year back -- write the projection directly rather than deriving it here.`
    )
  }
}

export const physical_year_projection = (table_name) => {
  assert_registered(table_name, 'physical_year_projection')
  return `${table_name}.${physical_year_column(table_name)} as year`
}

export const physical_year_projection_unqualified = (table_name) => {
  assert_registered(table_name, 'physical_year_projection_unqualified')
  return `${physical_year_column(table_name)} as year`
}

export const physical_seas_type_projection_unqualified = (table_name) => {
  assert_registered(table_name, 'physical_seas_type_projection_unqualified')
  return `${physical_seas_type_column(table_name)} as seas_type`
}

export const physical_year_group_by = (table_name) => {
  assert_registered(table_name, 'physical_year_group_by')
  return `${table_name}.${physical_year_column(table_name)}`
}

export const physical_table_names = () => Object.keys(PHYSICAL_YEAR_COLUMN)

export const tables_without_seas_type = () => new Set(TABLES_WITHOUT_SEAS_TYPE)

export const tables_with_nfl_week_id = () => new Set(TABLES_WITH_NFL_WEEK_ID)
