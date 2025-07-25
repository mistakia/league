import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

import TeamName from '@components/team-name'
import { getPoachProcessingTime } from '@libs-shared'

import './poach-notice.styl'

export default function PoachNotice({
  poach,
  teamId,
  process_poach,
  showConfirmation
}) {
  const player_map = poach.get('playerMap')
  if (!player_map) return null

  const processing_time = getPoachProcessingTime(poach.submitted)

  const handle_process_poach = (poach) => {
    const playerMap = poach.get('playerMap')
    showConfirmation({
      title: 'Process Poach',
      description: `${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get(
        'pos'
      )}) will be poached. Are you sure you want to proceed? This will remove the player from your roster and add them to the roster of the team that submitted the poach.`,
      on_confirm_func: () => process_poach(poach.get('uid'))
    })
  }

  return (
    <Alert severity='warning'>
      <div className='poach-notice-section'>
        {player_map.get('name', 'N/A')} has a poaching claim that will be
        processed no later than {processing_time.fromNow()} on{' '}
        {processing_time.format('dddd, h:mm a')}. It can be processed at any
        time prior to that by <TeamName tid={poach.get('player_tid')} />.
      </div>
      <div className='poach-notice-section'>
        Submitted by: <TeamName tid={poach.tid} />
      </div>
      {poach.get('player_tid') === teamId && (
        <div className='poach-notice-section'>
          <Button
            variant='contained'
            color='primary'
            onClick={() => handle_process_poach(poach)}
          >
            Process Poach
          </Button>
        </div>
      )}
    </Alert>
  )
}

PoachNotice.propTypes = {
  poach: ImmutablePropTypes.map.isRequired,
  teamId: PropTypes.number.isRequired,
  process_poach: PropTypes.func.isRequired,
  showConfirmation: PropTypes.func.isRequired
}
