import db from '#db'
import {
  scoring_column_names,
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

export const LEAGUE_COLUMNS = [
  'num_teams',
  'starter_slots_qb',
  'starter_slots_rb',
  'starter_slots_wr',
  'starter_slots_te',
  'starter_slots_rb_wr_flex',
  'srbwrte',
  'sqbrbwrte',
  'starter_slots_wr_te_flex',
  'starter_slots_dst',
  'starter_slots_k',
  'bench_slot_count',
  'practice_squad_slot_count',
  'reserve_short_term_limit',
  'cap',
  'min_bid'
]

const upsert_and_return_id = async (
  knex,
  table_name,
  insert_columns,
  conflict_columns,
  values
) => {
  const placeholders = insert_columns.map(() => '?').join(', ')
  const conflict_list = conflict_columns.join(', ')
  const sql = `
    INSERT INTO ${table_name} (id, ${insert_columns.join(', ')})
    VALUES (gen_random_uuid()::text, ${placeholders})
    ON CONFLICT (${conflict_list})
    DO UPDATE SET id = ${table_name}.id
    RETURNING id
  `
  const result = await knex.raw(sql, values)
  return result.rows[0].id
}

// The conflict target is config_digest, a generated column carrying an md5 over
// every scoring column, rather than the columns themselves. The config tuple is
// 44 columns and Postgres's max_index_keys is 32, so the full-tuple unique
// index that used to be the dedup oracle can no longer be built. See
// db/adhoc/2026-08-04-kicking-dst-scoring-config.sql for why a digest nothing
// references is not the content-derived identity the guideline forbids.
export const find_or_create_scoring_format = async (knex = db, config) => {
  // resolve_scoring_config fills an absent key from the registry default rather
  // than with null. Every kicking and DST column is NOT NULL and no caller
  // supplies them yet -- the external-league mapper structurally cannot -- so
  // mapping absent to null here would fail every import.
  const resolved = resolve_scoring_config(config)
  const values = SCORING_COLUMNS.map((col) => resolved[col])
  return upsert_and_return_id(
    knex,
    'league_scoring_formats',
    SCORING_COLUMNS,
    ['config_digest'],
    values
  )
}

export const find_or_create_league_format = async (knex = db, config) => {
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
    values
  )
}
