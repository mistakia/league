import React from 'react'

import { constants } from '@common'
import StatFilter from '@components/stat-filter'

export default class StatYearsFilter extends React.Component {
  render = () => {
    const state = {
      single: true,
      type: 'years',
      label: 'YEARS',
      values: []
    }

    for (const year of constants.years) {
      state.values.push({
        label: year,
        value: year,
        selected: this.props.years.includes(year)
      })
    }

    return <StatFilter {...state} />
  }
}
