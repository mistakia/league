/**
 * Knex modifier restricting a `draft` query to picks that are still
 * outstanding assets — ones a team can trade, and that are still owed a
 * selection.
 *
 * Two columns have to agree, and the second is the one that is easy to
 * forget. `pid IS NULL` means no player was selected, which covers both "not
 * yet" and "never will be": per the 2023-09-03 commissioner ruling a pick
 * unused when its draft window closes expires to free agency. `expired_at`
 * records that close. Filtering on `pid` alone therefore reports every
 * long-dead pick as a live asset — which is exactly what put four expired
 * 2021/2023 picks on a team page and through trade validation in August 2026.
 *
 * Use this rather than hand-writing the predicate, so the definition of
 * "outstanding" lives in one place.
 *
 * Pass a table name when the query joins another table, so the columns stay
 * qualified and cannot go ambiguous as the join grows.
 *
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {string} [table] - Table to qualify the columns with.
 *
 * @example
 * const picks = await db('draft')
 *   .where({ lid })
 *   .modify(where_outstanding_draft_pick)
 *
 * @example
 * const frontier = await db('draft')
 *   .join('teams', 'draft.tid', 'teams.team_id')
 *   .modify(where_outstanding_draft_pick, 'draft')
 */
export default function where_outstanding_draft_pick(query, table) {
  const prefix = table ? `${table}.` : ''
  return query.whereNull(`${prefix}pid`).whereNull(`${prefix}expired_at`)
}
