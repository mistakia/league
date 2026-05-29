#!/usr/bin/env node

// Verify that every named-catalog entry in libs-shared/named-format-catalog.mjs
// resolves to a DB row whose config tuple matches what the catalog declares.
//
// Catches the latent failure mode the migration retires: a future edit to
// libs-shared/league-format-definitions.mjs could rename a slug, change a
// named entry's config, or introduce a new collision -- none of which the
// find-or-create upsert path will detect (it dedups by config tuple, not by
// slug). Many-to-one resolution is legal: when two source keys share a
// canonical ID (e.g. draftkings + ppr_lower_turnover -> 'draftkings') both
// keys' configs must match the row's config.
//
// Exits non-zero on any mismatch or missing row. Safe to run post-cutover
// (and optionally as a weekly cron in the slot the drift detector vacated).

import db from '#db'
import {
  named_scoring_formats,
  named_league_formats
} from '#libs-shared/named-format-catalog.mjs'
import {
  scoring_formats as source_scoring_formats,
  league_formats as source_league_formats
} from '#libs-shared/league-format-definitions.mjs'
import { is_main } from '#libs-server'
import {
  SCORING_COLUMNS,
  LEAGUE_COLUMNS
} from '#libs-server/find-or-create-format.mjs'

const compare_config = (db_row, source_config, columns) => {
  const mismatches = []
  for (const col of columns) {
    const db_val = db_row[col]
    const src_val = source_config[col] === undefined ? null : source_config[col]
    // Numeric coercion: knex returns numerics as strings on some drivers
    const db_num = typeof db_val === 'string' ? Number(db_val) : db_val
    const src_num = typeof src_val === 'string' ? Number(src_val) : src_val
    if (db_num !== src_num) {
      mismatches.push(`${col}: db=${db_val} source=${src_val}`)
    }
  }
  return mismatches
}

const verify_scoring = async () => {
  const errors = []
  const groups = new Map()
  for (const [source_key, entry] of Object.entries(named_scoring_formats)) {
    if (!groups.has(entry.id)) groups.set(entry.id, [])
    groups.get(entry.id).push(source_key)
  }

  for (const [id, source_keys] of groups.entries()) {
    const row = await db('league_scoring_formats').where({ id }).first()
    if (!row) {
      errors.push(`Missing DB row for scoring id '${id}' (source keys: ${source_keys.join(', ')})`)
      continue
    }
    for (const source_key of source_keys) {
      const source_config = source_scoring_formats[source_key]?.config
      if (!source_config) {
        errors.push(`No source config for scoring source key '${source_key}'`)
        continue
      }
      const mismatches = compare_config(row, source_config, SCORING_COLUMNS)
      if (mismatches.length) {
        errors.push(
          `Scoring '${source_key}' -> id '${id}' mismatches: ${mismatches.join('; ')}`
        )
      }
    }
  }
  return errors
}

const verify_league = async () => {
  const errors = []
  const groups = new Map()
  for (const [source_key, entry] of Object.entries(named_league_formats)) {
    if (!groups.has(entry.id)) groups.set(entry.id, [])
    groups.get(entry.id).push(source_key)
  }

  for (const [id, source_keys] of groups.entries()) {
    const row = await db('league_formats').where({ id }).first()
    if (!row) {
      errors.push(`Missing DB row for league id '${id}' (source keys: ${source_keys.join(', ')})`)
      continue
    }
    for (const source_key of source_keys) {
      const source_config = source_league_formats[source_key]?.config
      if (!source_config) {
        errors.push(`No source config for league source key '${source_key}'`)
        continue
      }
      const mismatches = compare_config(row, source_config, LEAGUE_COLUMNS)
      if (mismatches.length) {
        errors.push(
          `League '${source_key}' -> id '${id}' mismatches: ${mismatches.join('; ')}`
        )
      }
      const catalog_entry = named_league_formats[source_key]
      if (row.pricing_model !== (catalog_entry.pricing_model || 'auction')) {
        errors.push(
          `League '${source_key}' -> id '${id}' pricing_model mismatch: db=${row.pricing_model} catalog=${catalog_entry.pricing_model || 'auction'}`
        )
      }
      if (row.scoring_format_id !== catalog_entry.scoring_format) {
        errors.push(
          `League '${source_key}' -> id '${id}' scoring_format_id mismatch: db=${row.scoring_format_id} catalog=${catalog_entry.scoring_format}`
        )
      }
    }
  }
  return errors
}

const main = async () => {
  const errors = [
    ...(await verify_scoring()),
    ...(await verify_league())
  ]

  if (errors.length) {
    console.error(`verify-named-format-catalog: ${errors.length} error(s)`)
    for (const err of errors) console.error(`  - ${err}`)
    process.exit(1)
  }

  console.log('verify-named-format-catalog: OK')
  process.exit(0)
}

if (is_main(import.meta.url)) {
  main().catch((err) => {
    console.error('verify-named-format-catalog: threw', err)
    process.exit(2)
  })
}

export default main
