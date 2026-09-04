// Which view a finished generation is allowed to modify.
//
// A generation runs for up to fifteen minutes and the user is free to switch
// views inside that window. Applying the result to whichever view happens to be
// selected when the answer lands overwrites a view the run was never started
// from, which is data loss on exactly the thing the user is looking at.
//
// `persist_accepted_generation` has always captured the run's originating
// view_id; nothing read it until 2026-09-04, so the field existed and the
// feature read as wired while the result went to the wrong place.
//
// This lives in its own module rather than inside sagas.js because the saga
// tier reaches @core/ws and therefore @core/store, which reads `window` at
// module scope and runs rootSaga on import -- so a spec cannot import it. The
// rule is the part worth testing directly, and here it is importable.

/**
 * True when a finished run may apply its table_state to `data_view`.
 *
 * Both permissive cases are deliberate and neither is a fallback to the old
 * behaviour:
 *
 * - A stored record with a null `view_id` means the run was accepted with no
 *   view selected, so there is no origin view to protect.
 * - No stored record at all means the run predates this field, or the record
 *   belongs to another tab, or storage was cleared. Absence is not evidence of
 *   a mismatch, and refusing on it would break runs that work today.
 *
 * @param {object} args
 * @param {{view_id?: string|null}|null} [args.pending] the stored pending record
 * @param {{view_id?: string|null}|null} [args.data_view] the selected view
 * @returns {boolean}
 */
export const may_apply_generation_to_view = ({ pending, data_view }) => {
  if (!data_view) return false
  if (!pending?.view_id) return true
  return pending.view_id === data_view.view_id
}
