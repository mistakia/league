import db from '#db'
import {
  scoring_column_names,
  scoring_columns,
  resolve_scoring_config
} from '#libs-shared/scoring-columns.mjs'

// Find-or-create upsert for league_scoring_formats / league_formats.
//
// A DB unique index is the dedup oracle -- config_digest for scoring formats,
// the full config tuple for league formats, which still fits in an index.
// Identity (id) is opaque either way (slug for the named catalog,
// gen_random_uuid() for the long tail).
// ON CONFLICT ... DO UPDATE SET id = <table>.id is a
// no-op-with-returning trick: DO NOTHING returns no row on conflict, so the
// caller cannot retrieve the existing id without a second SELECT.
//
// The DO UPDATE branch is intentionally narrow -- assigning id to itself is a
// no-op write, the trigger trg_cmv_classify_league_format does not fire on
// non-sqb/non-sqbrbwrte/non-scoring_format_id changes, and the row's
// scoring_format_title (not in the unique tuple) is preserved as-is.

// Derived from libs-shared/scoring-columns.mjs rather than listed here, so a
// new scoring column cannot be added to the table and the settings UI while
// silently staying out of the dedup tuple.
//
// The registry's order differs from the hand-written order this replaced, which
// is safe: the INSERT column list and its bound values are built from this same
// array, and Postgres matches an ON CONFLICT column list by set.
export const SCORING_COLUMNS = scoring_column_names

// Columns whose bound value must be JSON text rather than a JS structure. See
// find_or_create_scoring_format below for why.
const JSONB_COLUMNS = new Set(
  scoring_columns
    .filter((entry) => entry.sql_type === 'jsonb')
    .map((entry) => entry.column)
)

export const LEAGUE_COLUMNS = [
  'number_teams',
  'starter_slots_quarterback',
  'starter_slots_running_back',
  'starter_slots_wide_receiver',
  'starter_slots_tight_end',
  'starter_slots_running_back_wide_receiver_flex',
  'srbwrte',
  'sqbrbwrte',
  'starter_slots_wide_receiver_tight_end_flex',
  'starter_slots_defense_special_teams',
  'starter_slots_kicker',
  'bench_slot_count',
  'practice_squad_slot_count',
  'reserve_short_term_limit',
  'salary_cap',
  'min_bid'
]

// `id` is optional and is used ONLY on insert. The named catalog wants its slug
// as the identity (`ppr`, `sfb16_mfl`); everything else gets a uuid.
//
// It cannot be applied on conflict, and must not be: the DO UPDATE branch
// deliberately returns the row's EXISTING id, because that id is referenced by
// seasons and by league_formats and re-pointing it would break those rows. So a
// format already seeded under a uuid keeps the uuid -- adopting a slug for one
// of those is a data migration, not something this function should do silently.
//
// Before this argument existed the named-format loops discarded their catalog
// key entirely, so every named format minted a uuid. The slugs in production
// came from the 2026-05-28 format-id migration, which is why the gap was
// invisible until SFB16 became the first named format added since.
const upsert_and_return_id = async (
  knex,
  table_name,
  insert_columns,
  conflict_columns,
  values,
  id = null
) => {
  const placeholders = insert_columns.map(() => '?').join(', ')
  const conflict_list = conflict_columns.join(', ')
  const id_expression = id ? '?' : 'gen_random_uuid()::text'
  const sql = `
    INSERT INTO ${table_name} (id, ${insert_columns.join(', ')})
    VALUES (${id_expression}, ${placeholders})
    ON CONFLICT (${conflict_list})
    DO UPDATE SET id = ${table_name}.id
    RETURNING id
  `
  const bindings = id ? [id, ...values] : values
  const result = await knex.raw(sql, bindings)
  return result.rows[0].id
}

// The conflict target is config_digest, a generated column carrying an md5 over
// every scoring column, rather than the columns themselves. The config tuple is
// 44 columns and Postgres's max_index_keys is 32, so the full-tuple unique
// index that used to be the dedup oracle can no longer be built. See
// db/adhoc/2026-08-04-kicking-dst-scoring-config.sql for why a digest nothing
// references is not the content-derived identity the guideline forbids.
export const find_or_create_scoring_format = async (
  knex = db,
  config,
  id = null
) => {
  // resolve_scoring_config fills an absent key from the registry default rather
  // than with null. Every kicking and DST column is NOT NULL and no caller
  // supplies them yet -- the external-league mapper structurally cannot -- so
  // mapping absent to null here would fail every import.
  const resolved = resolve_scoring_config(config)
  // A jsonb column has to be serialized at the SQL boundary. The pg driver
  // renders a bound JS ARRAY as a Postgres array literal (`{...}`), which jsonb
  // rejects with `invalid input syntax for type json` -- so `bonuses` cannot be
  // passed through as the array that resolve_scoring_config produces and that
  // calculate-points consumes. Derived from the registry rather than naming the
  // column, so a second jsonb column needs no change here.
  const values = SCORING_COLUMNS.map((col) =>
    JSONB_COLUMNS.has(col) ? JSON.stringify(resolved[col]) : resolved[col]
  )
  return upsert_and_return_id(
    knex,
    'league_scoring_formats',
    SCORING_COLUMNS,
    ['config_digest'],
    values,
    id
  )
}

export const find_or_create_league_format = async (
  knex = db,
  config,
  id = null
) => {
  if (!config.scoring_format_id) {
    throw new Error('scoring_format_id is required')
  }
  const pricing_model = config.pricing_model || 'auction'
  const insert_columns = [
    ...LEAGUE_COLUMNS,
    'scoring_format_id',
    'pricing_model'
  ]
  const conflict_columns = insert_columns
  const values = [
    ...LEAGUE_COLUMNS.map((col) =>
      config[col] === undefined ? null : config[col]
    ),
    config.scoring_format_id,
    pricing_model
  ]
  return upsert_and_return_id(
    knex,
    'league_formats',
    insert_columns,
    conflict_columns,
    values,
    id
  )
}
