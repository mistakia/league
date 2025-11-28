import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerLabel from '@components/player-label'
import {
  player_nfl_status,
  nfl_player_status_abbreviations,
  nfl_player_status_descriptions
} from '@constants'

export default function PlayerStatus({ player_map }) {
  const status =
    player_map.get('injury_status') ||
    player_map.get('game_status') ||
    player_map.get('nfl_status')

  if (!status) {
    return null
  }

  const label = nfl_player_status_abbreviations[status]

  if (label === nfl_player_status_abbreviations[player_nfl_status.ACTIVE]) {
    return null
  }

  if (!label) {
    return null
  }

  return (
    <PlayerLabel
      type='status'
      label={label}
      description={nfl_player_status_descriptions[status]}
    />
  )
}

PlayerStatus.propTypes = {
  player_map: ImmutablePropTypes.map
}
