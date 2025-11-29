import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { nfl_weeks } from '@constants'

export default class StatWeeksFilter extends React.Component {
  render = () => {
    const state = {
      type: 'weeks',
      label: 'WEEKS',
      values: []
    }

    for (const week of nfl_weeks) {
      state.values.push({
        label: week,
        value: week,
        selected: this.props.week.includes(week)
      })
    }

    return <StatFilter {...state} />
  }
}

StatWeeksFilter.propTypes = {
  week: ImmutablePropTypes.list
}
