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

    for (const status in constants.status) {
      state.values.push({
        label: status,
        value: status,
        selected: this.props.status.includes(status)
      })
    }

    return <PlayerFilter {...state} />
  }
}

StatusFilter.propTypes = {
  status: ImmutablePropTypes.list
}
