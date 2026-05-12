/**
 * Idempotent favorite toggle for a data view.
 *
 * @param {object} params
 * @param {number} params.user_id
 * @param {string} params.view_id
 * @param {'insert'|'delete'} params.action
 * @param {import('knex').Knex} params.db
 * @returns {Promise<void>}
 */
export default async function toggle_favorite({ user_id, view_id, action, db }) {
  if (action === 'insert') {
    // Idempotent insert — ignore if already favorited
    await db.raw(
      `INSERT INTO user_data_view_favorites (user_id, view_id)
       VALUES (?, ?)
       ON CONFLICT (user_id, view_id) DO NOTHING`,
      [user_id, view_id]
    )
  } else if (action === 'delete') {
    await db('user_data_view_favorites')
      .where({ user_id, view_id })
      .del()
  } else {
    const err = new Error(`toggle_favorite: unknown action "${action}"`)
    err.status = 400
    throw err
  }
}
