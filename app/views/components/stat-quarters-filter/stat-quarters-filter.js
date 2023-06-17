import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import StatFilter from '@components/stat-filter'

export default class StatQuartersFilter extends React.Component {
  render = () => {
    const state = {
      type: 'quarters',
      label: 'QUARTERS',
      values: []
    }

    for (const quarter of constants.quarters) {
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
