import * as table_constants from 'react-table/src/constants.mjs'

import db from '#db'

// Resolve a pg result's field descriptors to the client's data_type integers.
//
// WHY NOT information_schema. It is keyed by (table, column) and therefore
// cannot describe an EXPRESSION: count(*), a + b, a CASE and every UNION arm
// have no row there at all, and an enum column reports the useless literal
// 'USER-DEFINED'. Generated SQL is expression-heavy by construction, so that
// derivation fails on the common case rather than on an edge.
//
// WHY NOT A STATIC OID MAP. The enum OIDs move across a dump and restore.
//
// So: resolve the OIDs the query actually returned against the live catalog
// that produced them. format_type gives exactly the SQL-standard spellings
// below ('integer', 'character varying', 'timestamp without time zone'), and
// typcategory buckets whatever it cannot name. OID instability does not apply
// because the OID is never persisted as a mapping key -- a re-created enum gets
// a new OID and simply misses the memo.

const { TABLE_DATA_TYPES } = table_constants

const TYPE_NAME_TO_DATA_TYPE = new Map([
  ['smallint', TABLE_DATA_TYPES.NUMBER],
  ['integer', TABLE_DATA_TYPES.NUMBER],
  ['bigint', TABLE_DATA_TYPES.NUMBER],
  ['numeric', TABLE_DATA_TYPES.NUMBER],
  ['real', TABLE_DATA_TYPES.NUMBER],
  ['double precision', TABLE_DATA_TYPES.NUMBER],
  ['text', TABLE_DATA_TYPES.TEXT],
  ['character varying', TABLE_DATA_TYPES.TEXT],
  ['character', TABLE_DATA_TYPES.TEXT],
  ['name', TABLE_DATA_TYPES.TEXT],
  ['uuid', TABLE_DATA_TYPES.TEXT],
  ['boolean', TABLE_DATA_TYPES.BOOLEAN],
  ['date', TABLE_DATA_TYPES.DATE],
  ['timestamp without time zone', TABLE_DATA_TYPES.DATE],
  ['timestamp with time zone', TABLE_DATA_TYPES.DATE],
  ['json', TABLE_DATA_TYPES.JSON],
  ['jsonb', TABLE_DATA_TYPES.JSON]
])

// The fallback, for a type format_type names but this file has never seen --
// most importantly an enum, which is category 'E' and whose name is whatever the
// schema called it.
const TYPCATEGORY_TO_DATA_TYPE = new Map([
  ['N', TABLE_DATA_TYPES.NUMBER],
  ['S', TABLE_DATA_TYPES.TEXT],
  ['E', TABLE_DATA_TYPES.TEXT],
  ['B', TABLE_DATA_TYPES.BOOLEAN],
  ['D', TABLE_DATA_TYPES.DATE],
  // An array renders as its JSON spelling on the client, which is the only
  // representation the table has for one.
  ['A', TABLE_DATA_TYPES.JSON]
])

// Add-only, module-level, keyed by OID. Never invalidated: an OID that has been
// reused by a different type would be a restore into the same process, which
// cannot happen, and a re-created enum takes a new OID and misses.
const memoized_types_by_oid = new Map()

// Exported for the spec, which must be able to prove the memo is what it says.
export const reset_pg_field_type_memo = () => memoized_types_by_oid.clear()

// Thrown by default when neither the name table nor typcategory can bucket an
// OID. Named, and carrying the OID, because the caller that recovers from it
// (the query-backed deriver, which falls back to an authored data_type) must be
// able to tell it apart from a connection failure.
export class UnbucketablePgTypeError extends Error {
  constructor({ oid, type_name, typcategory }) {
    super(
      `unbucketable pg type for oid ${oid}: format_type '${type_name}', typcategory '${typcategory}'`
    )
    this.name = 'UnbucketablePgTypeError'
    this.oid = oid
    this.pg_type_name = type_name
  }
}

const data_type_for = ({ oid, type_name, typcategory }) => {
  const by_name = TYPE_NAME_TO_DATA_TYPE.get(type_name)
  if (by_name) return by_name

  const by_category = TYPCATEGORY_TO_DATA_TYPE.get(typcategory)
  if (by_category) return by_category

  // Deliberately a throw, not a null. Returning null here is a silent-drop
  // shape: the column reaches the client with no type, renders as nothing, and
  // nobody learns which type was missing. This throw is exactly the point where
  // an authored column annotation must supply data_type instead.
  throw new UnbucketablePgTypeError({ oid, type_name, typcategory })
}

/**
 * @param {object} opts
 * @param {Array<{ name: string, dataTypeID: number }>} opts.fields - the pg
 *   result's raw field descriptors, in projection order
 * @param {object} [opts.query_runner] - seam; defaults to the MAIN pool rather
 *   than the sandbox one. pg_catalog is PUBLIC-readable either way, and running
 *   the lookup on the main pool keeps it outside the sandbox's READ ONLY
 *   transaction, where it would otherwise share the statement timeout with the
 *   query it is describing.
 * @param {boolean} [opts.allow_unresolved] - when true, an OID neither the name
 *   table nor typcategory can bucket yields `data_type: null` plus
 *   `unbucketable: true` on that ONE field instead of failing the batch. This is
 *   NOT a softening of the no-silent-null rule: it exists because the throw is
 *   batch-wide and names an OID rather than a column, so a caller that can
 *   recover per column (the query-backed deriver, reading an authored
 *   data_type) cannot tell WHICH alias to recover. The obligation moves to that
 *   caller, which must reject a null it has no annotation for. Nothing else may
 *   pass this.
 * @returns {Promise<Array<{ name: string, data_type_oid: number, pg_type_name: string, data_type: number|null, unbucketable?: boolean }>>}
 */
export default async function resolve_pg_field_types({
  fields,
  query_runner = db,
  allow_unresolved = false
}) {
  if (!fields || !fields.length) return []

  const unresolved_oids = [
    ...new Set(
      fields
        .map((field) => field.dataTypeID)
        .filter((oid) => !memoized_types_by_oid.has(oid))
    )
  ]

  if (unresolved_oids.length) {
    const { rows } = await query_runner.raw(
      'SELECT oid, format_type(oid, NULL) AS type_name, typcategory FROM pg_type WHERE oid = ANY(?)',
      [unresolved_oids]
    )
    for (const row of rows) {
      const oid = Number(row.oid)
      // The memo holds the resolution ATTEMPT, not only its success, so that
      // allow_unresolved and the default throw see the same one round trip and
      // a batch mixing the two cannot resolve one OID twice.
      let data_type = null
      let unbucketable = false
      try {
        data_type = data_type_for({
          oid,
          type_name: row.type_name,
          typcategory: row.typcategory
        })
      } catch (error) {
        if (!(error instanceof UnbucketablePgTypeError)) throw error
        unbucketable = true
      }
      memoized_types_by_oid.set(oid, {
        type_name: row.type_name,
        typcategory: row.typcategory,
        data_type,
        unbucketable
      })
    }
  }

  return fields.map((field) => {
    const resolved = memoized_types_by_oid.get(field.dataTypeID)
    if (!resolved) {
      throw new Error(
        `pg type oid ${field.dataTypeID} for column ${field.name} is absent from pg_type`
      )
    }
    if (resolved.unbucketable && !allow_unresolved) {
      throw new UnbucketablePgTypeError({
        oid: field.dataTypeID,
        type_name: resolved.type_name,
        typcategory: resolved.typcategory
      })
    }
    return {
      // pg's camelCase dataTypeID is converted once, here, so nothing
      // downstream sees pg's spelling.
      name: field.name,
      data_type_oid: field.dataTypeID,
      pg_type_name: resolved.type_name,
      data_type: resolved.data_type,
      ...(resolved.unbucketable ? { unbucketable: true } : {})
    }
  })
}
