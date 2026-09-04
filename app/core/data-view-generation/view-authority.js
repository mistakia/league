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

/**
 * Which view to select at mount, as ONE decision rather than two racing ones.
 *
 * View restoration and job restoration used to initialize independently: the
 * data-views saga restored the last-active view, and the generation control
 * separately re-attached to a pending run. Nothing related the two, so a reload
 * during a run could restore view B while re-attaching to a job started on view
 * A -- and the result would then be refused by `may_apply_generation_to_view`
 * above, which is correct but leaves the user watching a run whose answer can
 * never land anywhere they can see.
 *
 * A PENDING RUN OUTRANKS LAST-ACTIVE, and that ordering is the whole rule. The
 * pending record is evidence about what the user was doing when the page went
 * away; last-active is a weaker statement about where they had been. Restoring
 * the run's own view makes the two restorations agree by construction rather
 * than by a check that runs afterwards.
 *
 * Existence is checked against the ACTUAL view set both times, because a stored
 * id can outlive the view it names -- deleted on another device, or never synced
 * to this one. A stale pending id must fall through to last-active rather than
 * selecting nothing.
 *
 * @param {object} args
 * @param {{view_id?: string|null}|null} [args.pending] the stored pending record
 * @param {{view_id?: string|null}|null} [args.last_active] the stored last-active
 * @param {Set<string>} args.all_view_ids every view id that currently exists
 * @param {string} args.default_view_id the fallback when nothing else resolves
 * @returns {string}
 */
export const resolve_view_to_restore = ({
  pending,
  last_active,
  all_view_ids,
  default_view_id
}) => {
  if (pending?.view_id && all_view_ids.has(pending.view_id)) {
    return pending.view_id
  }
  if (last_active?.view_id && all_view_ids.has(last_active.view_id)) {
    return last_active.view_id
  }
  return default_view_id
}
