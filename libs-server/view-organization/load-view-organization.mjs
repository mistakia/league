import { system_view_ids_set } from '#libs-shared/view-organization/system-data-view-ids.mjs'

/**
 * Load view organization data (favorites + tags) for a user.
 *
 * Orphan filter: keeps only rows where view_id is:
 *   - in the user's live user_data_views rows, OR
 *   - in system_view_ids (system views have no DB row but can be favorited/tagged)
 *
 * @param {object} params
 * @param {number} params.user_id
 * @param {import('knex').Knex} params.db
 * @returns {Promise<{favorites: string[], tags_by_view_id: Object<string, Array<{name: string, source: string}>>}>}
 */
export default async function load_view_organization({ user_id, db }) {
  // Load the user's live view_ids for orphan filtering
  const live_view_rows = await db('user_data_views')
    .where({ user_id })
    .select('view_id')

  const live_view_ids = new Set(live_view_rows.map((r) => r.view_id))

  const is_allowed_view_id = (view_id) =>
    live_view_ids.has(view_id) || system_view_ids_set.has(view_id)

  // Load favorites
  const favorite_rows = await db('user_data_view_favorites')
    .where({ user_id })
    .select('view_id')

  const favorites = favorite_rows
    .map((r) => r.view_id)
    .filter(is_allowed_view_id)

  // Load tags
  const tag_rows = await db('user_data_view_tags')
    .where({ user_id })
    .select('view_id', 'tag_name', 'source')

  const tags_by_view_id = {}
  for (const row of tag_rows) {
    if (!is_allowed_view_id(row.view_id)) continue
    if (!tags_by_view_id[row.view_id]) {
      tags_by_view_id[row.view_id] = []
    }
    tags_by_view_id[row.view_id].push({
      name: row.tag_name,
      source: row.source
    })
  }

  return { favorites, tags_by_view_id }
}
