import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { player_nfl_status } from '@constants'

export default class StatusFilter extends React.Component {
  render = () => {
    const state = {
      type: 'status',
      label: 'STATUS',
      values: []
    }

    for (const status_key in player_nfl_status) {
      state.values.push({
        label: status_key,
        value: status_key,
        selected: this.props.selected_nfl_statuses.includes(status_key)
      })
    }

    return <PlayerFilter {...state} />
  }
}

StatusFilter.propTypes = {
  selected_nfl_statuses: ImmutablePropTypes.list
}
