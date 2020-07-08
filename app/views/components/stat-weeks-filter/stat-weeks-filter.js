import React from 'react'

import { constants } from '@common'
import StatFilter from '@components/stat-filter'

export default class StatWeeksFilter extends React.Component {
  render = () => {
    const state = {
      type: 'weeks',
      label: 'WEEKS',
      values: []
    }

    for (const week of constants.nflWeeks) {
      state.values.push({
        label: week,
        value: week,
        selected: this.props.week.includes(week)
      })
    }

    return (
      <StatFilter {...state} />
    )
  }
}
