import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import AuctionFilter from '@components/auction-filter'
import { fantasy_positions } from '@constants'

export default class AuctionPositionFilter extends React.Component {
  render = () => {
    const state = {
      type: 'positions',
      label: 'POSITIONS',
      values: []
    }

    for (const position of fantasy_positions) {
      state.values.push({
        label: position,
        value: position,
        selected: this.props.positions.includes(position)
      })
    }

    return <AuctionFilter {...state} />
  }
}

AuctionPositionFilter.propTypes = {
  positions: ImmutablePropTypes.list
}
