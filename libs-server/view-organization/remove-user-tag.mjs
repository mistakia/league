/**
 * Remove a user-authored tag from a data view.
 *
 * Only deletes rows with source='user'. LLM-generated tags (source='llm') are
 * preserved so users cannot accidentally remove LLM suggestions. To remove an
 * LLM tag, the LLM job must re-run and exclude it from the output.
 *
 * @param {object} params
 * @param {number} params.user_id
 * @param {string} params.view_id
 * @param {string} params.tag_name
 * @param {import('knex').Knex} params.db
 * @returns {Promise<void>}
 */
export default async function remove_user_tag({
  user_id,
  view_id,
  tag_name,
  db
}) {
  await db('user_data_view_tags')
    .where({ user_id, view_id, tag_name, source: 'user' })
    .del()
}
