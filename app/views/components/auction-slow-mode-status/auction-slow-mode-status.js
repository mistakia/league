import React from 'react'
import PropTypes from 'prop-types'
import Chip from '@mui/material/Chip'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

import './auction-slow-mode-status.styl'

export default function AuctionSlowModeStatus({ is_slow_mode, nominated_pid }) {
  // Don't render if not in slow mode or no nomination
  if (!is_slow_mode || !nominated_pid) {
    return null
  }

  return (
    <div className='auction-slow-mode-status'>
      <Chip
        icon={<FiberManualRecordIcon />}
        label='Live'
        color='error'
        variant='filled'
        size='small'
        sx={{
          '& .MuiChip-icon': {
            color: 'inherit',
            animation: 'blink 1s infinite'
          }
        }}
      />
    </div>
  )
}

AuctionSlowModeStatus.propTypes = {
  is_slow_mode: PropTypes.bool,
  nominated_pid: PropTypes.string
}
