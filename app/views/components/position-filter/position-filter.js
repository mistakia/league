import React from 'react'

import { constants } from '@common'
import PlayerFilter from '@components/player-filter'

export default class PositionFilter extends React.Component {
  render () {
    const state = {
      type: 'positions',
      label: 'POSITIONS',
      values: []
    }

    for (const position of constants.positions) {
      state.values.push({
        label: position,
        value: position,
        selected: this.props.positions.includes(position)
      })
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}
