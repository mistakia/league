/**
 * Sanitize and upsert a user tag for a data view.
 *
 * Sanitization pipeline (per plan spec):
 *   trim → reject if empty → lowercase normalize → reject any code point < 0x20 or > 0x7e → enforce 64-char cap
 *
 * Source-collision rule: if a source='llm' row already exists at (user_id, view_id, tag_name),
 * the insert promotes it to source='user' — user intent wins.
 *
 * @param {object} params
 * @param {number} params.user_id
 * @param {string} params.view_id
 * @param {string} params.tag_name  raw tag_name from client
 * @param {import('knex').Knex} params.db
 * @returns {Promise<{tag_name: string}>} sanitized tag_name that was inserted/updated
 */
export default async function add_user_tag({ user_id, view_id, tag_name, db }) {
  // Sanitization
  const trimmed = (tag_name || '').trim()
  if (!trimmed) {
    const err = new Error('tag_name cannot be empty')
    err.status = 400
    throw err
  }

  const lowered = trimmed.toLowerCase()

  // Reject any character with code point < 0x20 (control chars) or > 0x7e (non-ASCII printable)
  for (const ch of lowered) {
    const cp = ch.codePointAt(0)
    if (cp < 0x20 || cp > 0x7e) {
      const err = new Error(
        'tag_name contains invalid characters (must be printable ASCII)'
      )
      err.status = 400
      throw err
    }
  }

  if (lowered.length > 64) {
    const err = new Error('tag_name exceeds 64-character limit')
    err.status = 400
    throw err
  }

  // Upsert: source-collision rule promotes existing llm row to user
  await db.raw(
    `INSERT INTO user_data_view_tags (user_id, view_id, tag_name, source)
     VALUES (?, ?, ?, 'user')
     ON CONFLICT (user_id, view_id, tag_name) DO UPDATE SET source = 'user'`,
    [user_id, view_id, lowered]
  )

  return { tag_name: lowered }
}
