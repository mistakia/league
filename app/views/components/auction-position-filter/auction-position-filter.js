import React from 'react'

import { constants } from '@common'
import AuctionFilter from '@components/auction-filter'

export default class AuctionPositionFilter extends React.Component {
  render = () => {
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
      <AuctionFilter {...state} />
    )
  }
}
