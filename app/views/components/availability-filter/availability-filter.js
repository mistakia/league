import React from 'react'

import { constants } from '@common'
import PlayerFilter from '@components/player-filter'

export default class AvailabilityFilter extends React.Component {
  render() {
    const state = {
      type: 'availability',
      label: 'AVAILABILITY',
      values: []
    }

    for (const availability of constants.availability) {
      state.values.push({
        label: availability,
        value: availability,
        selected: this.props.availability.includes(availability)
      })
    }

    return <PlayerFilter {...state} />
  }
}
