import React from 'react'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'

import './player-row-status-column.styl'

export default function PlayerRowStatusColumn({ status, row }) {
  const tid = row.original.tid
  const isRostered = Boolean(tid)

  return (
    <div className='player__row-status-column'>
      {isRostered ? (
        <TeamName abbrv tid={tid} />
      ) : status.waiver.active ||
        status.waiver.poach ||
        status.waiver.practice ||
        status.locked ? (
        'W'
      ) : (
        'FA'
      )}
    </div>
  )
}

PlayerRowStatusColumn.propTypes = {
  status: PropTypes.object,
  row: PropTypes.object
}
