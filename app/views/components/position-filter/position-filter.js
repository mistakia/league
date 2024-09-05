import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'

export default function PositionFilter({ positions, league_positions }) {
  const state = {
    type: 'positions',
    label: 'POSITIONS',
    values: []
  }

  for (const position of league_positions) {
    state.values.push({
      label: position,
      value: position,
      selected: positions.includes(position)
    })
  }

  return <PlayerFilter {...state} />
}

PositionFilter.propTypes = {
  positions: ImmutablePropTypes.list
}
