import db from '#db'

// Find-or-create upsert for league_scoring_formats / league_formats.
//
// The DB unique index across the full config tuple is the dedup oracle;
// identity (id) is opaque (slug for the named catalog, gen_random_uuid() for
// the long tail). ON CONFLICT ... DO UPDATE SET id = <table>.id is a
// no-op-with-returning trick: DO NOTHING returns no row on conflict, so the
// caller cannot retrieve the existing id without a second SELECT.
//
// The DO UPDATE branch is intentionally narrow -- assigning id to itself is a
// no-op write, the trigger trg_cmv_classify_league_format does not fire on
// non-sqb/non-sqbrbwrte/non-scoring_format_id changes, and the row's
// scoring_format_title (not in the unique tuple) is preserved as-is.

export const SCORING_COLUMNS = [
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',
  'ra',
  'ry',
  'tdr',
  'rec',
  'rbrec',
  'wrrec',
  'terec',
  'recy',
  'twoptc',
  'tdrec',
  'fuml',
  'prtd',
  'krtd',
  'fum_ret_td',
  'trg',
  'rush_first_down',
  'rec_first_down',
  'exclude_qb_kneels'
]

export const LEAGUE_COLUMNS = [
  'num_teams',
  'sqb',
  'srb',
  'swr',
  'ste',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'sdst',
  'sk',
  'bench',
  'ps',
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

export const find_or_create_scoring_format = async (knex = db, config) => {
  const values = SCORING_COLUMNS.map((col) =>
    config[col] === undefined ? null : config[col]
  )
  return upsert_and_return_id(
    knex,
    'league_scoring_formats',
    SCORING_COLUMNS,
    SCORING_COLUMNS,
    values
  )
}

export const find_or_create_league_format = async (knex = db, config) => {
  if (!config.scoring_format_id) {
    throw new Error('scoring_format_id is required')
  }
  const pricing_model = config.pricing_model || 'auction'
  const insert_columns = [...LEAGUE_COLUMNS, 'scoring_format_id', 'pricing_model']
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
