import React from 'react'
import PropTypes from 'prop-types'
import IconButton from '@mui/material/IconButton'

import Icon from '@components/icon'

export default function NflWeekSelectorHistoryControls({
  can_undo,
  can_redo,
  on_undo,
  on_redo
}) {
  return (
    <div className='nfl-week-selector-history-controls'>
      <IconButton size='small' disabled={!can_undo} onClick={on_undo}>
        <Icon name='undo' small />
      </IconButton>
      <IconButton size='small' disabled={!can_redo} onClick={on_redo}>
        <Icon name='redo' small />
      </IconButton>
    </div>
  )
}

NflWeekSelectorHistoryControls.propTypes = {
  can_undo: PropTypes.bool.isRequired,
  can_redo: PropTypes.bool.isRequired,
  on_undo: PropTypes.func.isRequired,
  on_redo: PropTypes.func.isRequired
}
