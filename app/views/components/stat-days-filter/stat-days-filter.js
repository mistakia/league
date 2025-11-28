import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { game_days } from '@constants'

export default class StatDaysFilter extends React.Component {
  render = () => {
    const state = {
      type: 'days',
      label: 'DAYS',
      values: []
    }

    for (const day of game_days) {
      state.values.push({
        label: day,
        value: day,
        selected: this.props.days.includes(day)
      })
    }

    return <StatFilter {...state} />
  }
}

StatDaysFilter.propTypes = {
  days: ImmutablePropTypes.list
}
