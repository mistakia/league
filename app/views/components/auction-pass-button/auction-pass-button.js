import React from 'react'
import PropTypes from 'prop-types'
import Button from '@mui/material/Button'

export default function AuctionPassButton({
  pass_nomination,
  user_has_passed_current_auction_nomination,
  nominated_pid,
  is_slow_mode
}) {
  // Don't render if not in slow mode or no nomination
  if (!is_slow_mode || !nominated_pid) {
    return null
  }

  const handle_pass_click = () => {
    if (!user_has_passed_current_auction_nomination && pass_nomination) {
      pass_nomination()
    }
  }

  // Show passed state if team has passed
  if (user_has_passed_current_auction_nomination) {
    return (
      <Button
        className='auction-pass-button'
        variant='contained'
        color='primary'
        size='small'
        disabled
      >
        Passed
      </Button>
    )
  }

  // Show pass button for eligible teams
  return (
    <Button
      className='auction-pass-button'
      variant='contained'
      color='primary'
      size='small'
      onClick={handle_pass_click}
    >
      Pass
    </Button>
  )
}

AuctionPassButton.propTypes = {
  pass_nomination: PropTypes.func,
  user_has_passed_current_auction_nomination: PropTypes.bool,
  nominated_pid: PropTypes.string,
  is_slow_mode: PropTypes.bool
}
