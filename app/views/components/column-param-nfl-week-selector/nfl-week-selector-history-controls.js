import React from 'react'
import PropTypes from 'prop-types'

import IconButton from '@components/icon-button'

export default function NflWeekSelectorHistoryControls({
  can_undo,
  can_redo,
  on_undo,
  on_redo
}) {
  return (
    <div className='nfl-week-selector-history-controls'>
      <IconButton
        icon='undo'
        small
        label='Undo'
        disabled={!can_undo}
        onClick={on_undo}
      />
      <IconButton
        icon='redo'
        small
        label='Redo'
        disabled={!can_redo}
        onClick={on_redo}
      />
    </div>
  )
}

NflWeekSelectorHistoryControls.propTypes = {
  can_undo: PropTypes.bool.isRequired,
  can_redo: PropTypes.bool.isRequired,
  on_undo: PropTypes.func.isRequired,
  on_redo: PropTypes.func.isRequired
}
