import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { player_availability_statuses } from '@constants'

export default class AvailabilityFilter extends React.Component {
  render() {
    const state = {
      type: 'availability',
      label: 'AVAILABILITY',
      values: []
    }

    for (const availability of player_availability_statuses) {
      state.values.push({
        label: availability,
        value: availability,
        selected: this.props.availability.includes(availability)
      })
    }

    return <PlayerFilter {...state} />
  }
}

AvailabilityFilter.propTypes = {
  availability: ImmutablePropTypes.list
}
