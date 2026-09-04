import { is_valid_table_state } from '#libs-shared/data-view-storage/validate.mjs'

/**
 * Which view the data-views page should show on its FIRST frame, decided from
 * browser storage alone.
 *
 * Pure and separate from the saga so the rule can be specced: the saga around
 * it reaches `@core/ws`, which reads `window` at module scope and so cannot be
 * imported from a spec at all.
 *
 * Three outcomes, and the third is the one worth naming. `defer` means the
 * browser knows WHICH view the user left on but not what is in it -- selecting
 * on that alone would resolve through get_selected_data_view's default fallback
 * and query the DEFAULT view's state under the remembered view's id. The
 * post-fetch path handles that case with the server's copy in hand.
 *
 * @param {object} args
 * @param {{view_id: string, view_name?: string}|null} args.last_active the
 *   stored last-active record
 * @param {{table_state: object}|null} args.snapshot the newest stored snapshot
 *   for that view
 * @param {string} args.default_view_id the view to fall back to
 * @param {Set<string>} args.default_view_ids ids of the built-in views, which
 *   are never stored
 * @returns {{type: 'default'|'restore'|'defer', view_id?: string,
 *   table_state?: object, view_name?: string}}
 */
export default function resolve_initial_view_selection({
  last_active,
  snapshot,
  default_view_id,
  default_view_ids
}) {
  const view_id = last_active && last_active.view_id

  // Nothing remembered, or a built-in view, which carries its state in code.
  // Either way the default is the answer and it is available now.
  if (!view_id || default_view_ids.has(view_id)) {
    return { type: 'default', view_id: default_view_id }
  }

  if (!snapshot || !is_valid_table_state(snapshot.table_state)) {
    return { type: 'defer' }
  }

  return {
    type: 'restore',
    view_id,
    table_state: snapshot.table_state,
    view_name: last_active.view_name
  }
}
