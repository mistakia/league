import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
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

    return <AuctionFilter {...state} />
  }
}

AuctionPositionFilter.propTypes = {
  positions: ImmutablePropTypes.list
}
