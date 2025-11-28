import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerLabel from '@components/player-label'
import { player_nfl_status } from '@constants'

export default function PlayerStatus({ player_map }) {
  const label =
    player_nfl_status.abbreviations[player_map.get('injury_status')] ||
    player_nfl_status.abbreviations[player_map.get('game_status')] ||
    player_nfl_status.abbreviations[player_map.get('nfl_status')]

  if (label === player_nfl_status.abbreviations[player_nfl_status.ACTIVE]) {
    return null
  }

  if (!label) {
    return null
  }

  return (
    <PlayerLabel
      type='status'
      label={label}
      description={player_nfl_status.descriptions[label]}
    />
  )
}

PlayerStatus.propTypes = {
  player_map: ImmutablePropTypes.map
}
