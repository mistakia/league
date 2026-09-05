import React, { useMemo } from 'react'
import PropTypes from 'prop-types'

import { load_history } from '#libs-shared/data-view-storage/storage.mjs'
import {
  resolve_history_step,
  describe_history_position
} from '@core/data-views/history-position.mjs'

import './data-view-history-control.styl'

// Walk the browser-local edit history in both directions.
//
// NOT a revert. Revert throws the whole history away and returns to the saved
// state; this walks through it one entry at a time and leaves it intact, so a
// user who steps back too far can step forward again rather than losing the
// states they passed.
//
// The readout is not decoration. Both buttons are enabled for most of a
// history, so without a position the control says only that stepping is
// possible — never where the view sits or how far there is left to go, which is
// the whole question a user pressing undo repeatedly is asking.
export default function DataViewHistoryControl({
  view_id,
  table_state,
  step_data_view_history_back,
  step_data_view_history_forward
}) {
  // Recomputed when the view or its state changes, which is exactly when the
  // history can have grown or the position moved. Reading localStorage on every
  // render would be wasteful and would also make the disabled state jitter.
  //
  // Resolved through the same helper the saga steps with, so a button that is
  // offered is a button that moves.
  const { can_step_back, can_step_forward, position, total } = useMemo(() => {
    const empty = {
      can_step_back: false,
      can_step_forward: false,
      position: 0,
      total: 0
    }
    if (!view_id) return empty
    try {
      const history = load_history(view_id)
      return {
        can_step_back:
          resolve_history_step({ history, table_state, direction: 'back' }) !==
          -1,
        can_step_forward:
          resolve_history_step({
            history,
            table_state,
            direction: 'forward'
          }) !== -1,
        ...describe_history_position({ history, table_state })
      }
    } catch {
      return empty
    }
    // table_state participates because a new edit appends an entry and every
    // step moves the position.
  }, [view_id, table_state])

  if (!can_step_back && !can_step_forward) return null

  return (
    <div className='data-view-history'>
      <button
        type='button'
        className='data-view-history__step'
        disabled={!can_step_back}
        onClick={step_data_view_history_back}
        aria-label='Go back one change'
      >
        Undo
      </button>
      <button
        type='button'
        className='data-view-history__step'
        disabled={!can_step_forward}
        onClick={step_data_view_history_forward}
        aria-label='Go forward one change'
      >
        Redo
      </button>
      <span className='data-view-history__position'>
        {/* Position 0 is an edit the debounced writer has not persisted yet,
            which sits past the newest entry rather than at one of them. */}
        {position === 0
          ? `unsaved · ${total} changes`
          : `${position} of ${total}`}
      </span>
    </div>
  )
}

DataViewHistoryControl.propTypes = {
  view_id: PropTypes.string,
  table_state: PropTypes.object,
  step_data_view_history_back: PropTypes.func.isRequired,
  step_data_view_history_forward: PropTypes.func.isRequired
}
