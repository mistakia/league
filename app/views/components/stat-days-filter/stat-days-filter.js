import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import StatFilter from '@components/stat-filter'

export default class StatDaysFilter extends React.Component {
  render = () => {
    const state = {
      type: 'days',
      label: 'DAYS',
      values: []
    }

    for (const day of constants.days) {
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
