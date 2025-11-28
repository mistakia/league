import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { nfl_quarters } from '@constants'

export default class StatQuartersFilter extends React.Component {
  render = () => {
    const state = {
      type: 'quarters',
      label: 'QUARTERS',
      values: []
    }

    for (const quarter of nfl_quarters) {
      state.values.push({
        label: quarter,
        value: quarter,
        selected: this.props.quarters.includes(quarter)
      })
    }

    return <StatFilter {...state} />
  }
}

StatQuartersFilter.propTypes = {
  quarters: ImmutablePropTypes.list
}
