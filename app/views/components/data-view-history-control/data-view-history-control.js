import React, { useMemo } from 'react'
import PropTypes from 'prop-types'

import { load_history } from '#libs-shared/data-view-storage/storage.mjs'

import './data-view-history-control.styl'

// Go back one step through the browser-local edit history.
//
// The history reader has existed for months and its only consumer was a test,
// so every snapshot the app wrote was write-only. This is the consumer.
//
// NOT a revert. Revert throws the whole history away and returns to the saved
// state; this walks backwards through it one entry at a time and leaves it
// intact, so a user who steps back too far can keep stepping and does not lose
// the intermediate states.
export default function DataViewHistoryControl({
  view_id,
  table_state,
  step_data_view_history_back
}) {
  // Recomputed when the view or its state changes, which is exactly when the
  // history can have grown or the position moved. Reading localStorage on every
  // render would be wasteful and would also make the disabled state jitter.
  const can_step_back = useMemo(() => {
    if (!view_id) return false
    try {
      return load_history(view_id).length > 1
    } catch {
      return false
    }
    // table_state participates because a new edit appends an entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view_id, table_state])

  if (!can_step_back) return null

  return (
    <button
      type='button'
      className='data-view-history__back'
      onClick={step_data_view_history_back}
    >
      Undo last change
    </button>
  )
}

DataViewHistoryControl.propTypes = {
  view_id: PropTypes.string,
  table_state: PropTypes.object,
  step_data_view_history_back: PropTypes.func.isRequired
}
