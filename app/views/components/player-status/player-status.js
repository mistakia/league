import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'

export default function PlayerStatus({ playerMap }) {
  const label =
    constants.nfl_player_status_abbreviations[playerMap.get('nfl_status')] ||
    constants.nfl_player_status_abbreviations[playerMap.get('injury_status')] ||
    constants.nfl_player_status_abbreviations[playerMap.get('game_status')]

  if (
    label ===
    constants.nfl_player_status_abbreviations[
      constants.player_nfl_status.ACTIVE
    ]
  ) {
    return null
  }

  if (!label) {
    return null
  }

  return (
    <PlayerLabel
      type='status'
      label={label}
      description={constants.nfl_player_status_descriptions[label]}
    />
  )
}

PlayerStatus.propTypes = {
  playerMap: ImmutablePropTypes.map
}
