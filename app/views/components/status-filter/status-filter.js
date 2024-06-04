import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerFilter from '@components/player-filter'

export default class StatusFilter extends React.Component {
  render = () => {
    const state = {
      type: 'status',
      label: 'STATUS',
      values: []
    }

    for (const player_nfl_status in constants.player_nfl_status) {
      state.values.push({
        label: player_nfl_status,
        value: player_nfl_status,
        selected: this.props.selected_nfl_statuses.includes(player_nfl_status)
      })
    }

    return <PlayerFilter {...state} />
  }
}

StatusFilter.propTypes = {
  selected_nfl_statuses: ImmutablePropTypes.list
}
