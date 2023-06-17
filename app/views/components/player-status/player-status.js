import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'

export default function PlayerStatus({ playerMap }) {
  const label =
    constants.status[playerMap.get('status')] ||
    constants.status[playerMap.get('injury_status')] ||
    constants.status[playerMap.get('gamestatus')]

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
  playerMap: ImmutablePropTypes.map
}
