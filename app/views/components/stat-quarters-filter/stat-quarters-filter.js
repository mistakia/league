import React from 'react'

import { constants } from '@common'
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

    return (
      <StatFilter {...state} />
    )
  }
}
