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
 * Two places can hold that state, and BOTH are needed. The snapshot history is
 * written only on an EDIT, so a view the user selected and never modified --
 * the common case for a saved view -- has none, and reading the history alone
 * deferred exactly the case this rule exists for. The last-active record
 * therefore also caches the state of the view as it was made active. The
 * snapshot wins when both are present: it is the edited state, and the cached
 * one is what the view held before those edits.
 *
 * @param {object} args
 * @param {{view_id: string, view_name?: string, table_state?: object}|null}
 *   args.last_active the stored last-active record
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

  // Nothing remembered: the default is the answer and it is available now.
  if (!view_id) {
    return { type: 'default', view_id: default_view_id }
  }

  // A remembered BUILT-IN view. Select that view, not the default one -- they
  // are not the same view, and conflating them is what made the page stop
  // returning users to where they left off. A built-in carries its state in
  // code, so it needs no restore and is selectable at mount like the default.
  //
  // The bug this replaces was worse than one wrong frame, because the early
  // path sets initial_selection_applied and the post-fetch
  // restore_last_active_view_if_default declines to run once it is set. So
  // answering `default` here did not merely paint the wrong view first -- it
  // disabled the path that used to correct it, and the remembered view never
  // loaded at all.
  if (default_view_ids.has(view_id)) {
    return { type: 'default', view_id }
  }

  const table_state =
    snapshot && is_valid_table_state(snapshot.table_state)
      ? snapshot.table_state
      : is_valid_table_state(last_active.table_state)
        ? last_active.table_state
        : null

  if (!table_state) {
    return { type: 'defer' }
  }

  return {
    type: 'restore',
    view_id,
    table_state,
    view_name: last_active.view_name
  }
}
