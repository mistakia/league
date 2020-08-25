import React from 'react'

import { constants } from '@common'
import PlayerFilter from '@components/player-filter'

export default class StatusFilter extends React.Component {
  render = () => {
    const state = {
      type: 'status',
      label: 'STATUS',
      values: []
    }

    for (const status in constants.status) {
      state.values.push({
        label: status,
        value: status,
        selected: this.props.status.includes(status)
      })
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}
