import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { available_years } from '@constants'

export default class StatYearsFilter extends React.Component {
  render = () => {
    const state = {
      single: true,
      type: 'years',
      label: 'YEAR',
      values: []
    }

    for (const year of available_years) {
      state.values.push({
        label: year,
        value: year,
        selected: this.props.years.includes(year)
      })
    }

    return <StatFilter {...state} />
  }
}

StatYearsFilter.propTypes = {
  years: ImmutablePropTypes.list
}
