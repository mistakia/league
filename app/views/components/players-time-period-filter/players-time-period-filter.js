import React from 'react'
import PropTypes from 'prop-types'

import Filter from '@components/filter'

const TIME_PERIODS = [
  { value: '', label: 'Season' },
  { value: 'LAST_THREE', label: 'Last 3' },
  { value: 'LAST_FOUR', label: 'Last 4' },
  { value: 'LAST_EIGHT', label: 'Last 8' }
]

export default function PlayersTimePeriodFilter({
  opponent_time_period,
  set_opponent_time_period
}) {
  const values = TIME_PERIODS.map((period) => ({
    label: period.label,
    value: period.value,
    selected: opponent_time_period === period.value
  }))

  const handle_filter = ({ values: selected_values }) => {
    const value = selected_values[0] !== undefined ? selected_values[0] : ''
    set_opponent_time_period(value)
  }

  return (
    <Filter
      single
      type='opponent_time_period'
      label='MATCHUP'
      values={values}
      filter={handle_filter}
    />
  )
}

PlayersTimePeriodFilter.propTypes = {
  opponent_time_period: PropTypes.string,
  set_opponent_time_period: PropTypes.func
}
