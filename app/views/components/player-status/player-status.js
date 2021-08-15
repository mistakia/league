import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@common'
import PlayerLabel from '@components/player-label'

export default function PlayerStatus({ player }) {
  const label =
    constants.status[player.status] ||
    constants.status[player.injury_status] ||
    player.gamestatus

  if (!label) {
    return null
  }

  return (
    <PlayerLabel
      type='status'
      label={label}
      description={constants.statusDescriptions[label]}
    />
  )
}

PlayerStatus.propTypes = {
  player: ImmutablePropTypes.record
}
