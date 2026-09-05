import deep_equal from '@core/utils/deep_equal'

/**
 * Where the current table_state sits in the browser-local edit history, and
 * which entry a step in either direction lands on.
 *
 * THE POSITION IS DERIVED, NOT TRACKED. There is no cursor in the store, and
 * deliberately: a cursor has to be reset on a new edit, on a view change, on a
 * restore and on a save, and every one of those is a rule that can be missed —
 * a stale cursor then steps into a different view's history.
 *
 * WHAT THIS REPLACED OSCILLATED BETWEEN TWO STATES. The old derivation walked
 * down from the newest entry skipping anything equal to the current state and
 * stepped to the first entry that DIFFERED, which is not the position of the
 * current state — it is the position of the newest state that is not it. From
 * the newest entry that reads as "one back", so the first press looked right;
 * from anywhere else it lands on the newest entry, so the second press went
 * FORWARD to where the user started and the third went back again. An undo
 * button that alternates between two states forever, and the reason forward
 * navigation could not be added on top of it.
 */
const find_position = (history, table_state) => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (deep_equal(history[index].table_state, table_state)) return index
  }
  return -1
}

/**
 * The index a step lands on, or -1 when the step is not available.
 *
 * Consecutive twins are skipped over: a save writes a `server_save` entry for a
 * state a `user_edit` entry already holds, and landing on one would look like
 * the control doing nothing.
 *
 * When the current state is in the history not at all — an edit the debounced
 * writer has not persisted yet, or a generated view just applied — going BACK
 * means returning to the newest recorded state, and going forward means
 * nothing, because there is nothing ahead of a state that was never recorded.
 */
export const resolve_history_step = ({ history, table_state, direction }) => {
  if (!Array.isArray(history) || history.length === 0) return -1

  const position = find_position(history, table_state)
  if (position === -1) return direction === 'forward' ? -1 : history.length - 1

  const step = direction === 'forward' ? 1 : -1
  let index = position + step
  while (
    index >= 0 &&
    index < history.length &&
    deep_equal(history[index].table_state, table_state)
  ) {
    index += step
  }
  if (index < 0 || index >= history.length) return -1
  return index
}

/**
 * What the control shows: which entry is on screen and how many there are.
 *
 * `position` is 1-based for display and 0 when the current state is not in the
 * history — an unrecorded edit sitting past the newest entry rather than at one
 * of them, which is exactly what "0 of 7" says.
 */
export const describe_history_position = ({ history, table_state }) => {
  if (!Array.isArray(history) || history.length === 0) {
    return { position: 0, total: 0 }
  }
  return {
    position: find_position(history, table_state) + 1,
    total: history.length
  }
}
