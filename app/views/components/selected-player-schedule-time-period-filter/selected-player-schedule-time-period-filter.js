import React from 'react'
import PropTypes from 'prop-types'

import Filter from '@components/filter'

const TIME_PERIODS = [
  { value: '', label: 'Season' },
  { value: 'LAST_THREE', label: 'Last 3' },
  { value: 'LAST_FOUR', label: 'Last 4' },
  { value: 'LAST_EIGHT', label: 'Last 8' }
]

export default function SelectedPlayerScheduleTimePeriodFilter({
  selected_time_period = '',
  on_time_period_change
}) {
  const filter_values = TIME_PERIODS.map((period) => ({
    label: period.label,
    value: period.value,
    selected: selected_time_period === period.value
  }))

  const handle_filter_change = ({ values }) => {
    // Single select - take the first (and only) value
    on_time_period_change(values.length > 0 ? values[0] : '')
  }

  return (
    <Filter
      type='time_period'
      label='PERIOD'
      values={filter_values}
      filter={handle_filter_change}
      single
    />
  )
}

SelectedPlayerScheduleTimePeriodFilter.propTypes = {
  selected_time_period: PropTypes.string,
  on_time_period_change: PropTypes.func.isRequired
}
