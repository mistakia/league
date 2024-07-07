import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import StatFilter from '@components/stat-filter'

export default class StatWeeksFilter extends React.Component {
  render = () => {
    const state = {
      type: 'weeks',
      label: 'WEEKS',
      values: []
    }

    for (const week of constants.nfl_weeks) {
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
