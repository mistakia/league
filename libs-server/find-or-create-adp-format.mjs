import db from '#db'
import { adp_format } from '#libs-shared'

const { ADP_FORMAT_TUPLE_COLUMNS } = adp_format

// Find-or-create upsert for the adp_format dimension.
//
// Mirrors find-or-create-format.mjs exactly: identity (id) is opaque
// (gen_random_uuid()), the UNIQUE NULLS NOT DISTINCT index across the full axis
// tuple is the dedup oracle, and ON CONFLICT ... DO UPDATE SET id =
// adp_format.id is the no-op-with-returning trick (DO NOTHING returns no row on
// conflict, so the existing id could not otherwise be retrieved without a
// second SELECT). Never a content-derived hash -- see
// user:guideline/schema/avoid-content-derived-identity.md.
//
// NULLS NOT DISTINCT (PG 16.14+) lets the null scoring_format_id / num_teams
// columns participate in the conflict target directly, so ON CONFLICT targets
// the plain column tuple with no COALESCE sentinels.

export const find_or_create_adp_format = async (knex = db, config = {}) => {
  const columns = ADP_FORMAT_TUPLE_COLUMNS
  const values = columns.map((col) =>
    config[col] === undefined ? null : config[col]
  )
  const placeholders = columns.map(() => '?').join(', ')
  const conflict_list = columns.join(', ')
  const sql = `
    INSERT INTO adp_format (id, ${columns.join(', ')})
    VALUES (gen_random_uuid()::text, ${placeholders})
    ON CONFLICT (${conflict_list})
    DO UPDATE SET id = adp_format.id
    RETURNING id
  `
  const result = await knex.raw(sql, values)
  return result.rows[0].id
}
