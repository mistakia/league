import React from 'react'
import PropTypes from 'prop-types'

import Filter from '@components/filter'
import { available_years } from '@constants'

export default function SelectedPlayerScheduleYearFilter({
  selected_years_for_schedule = [],
  on_year_selection_change
}) {
  const filter_values = available_years.map((year) => ({
    label: year.toString(),
    value: year,
    selected: selected_years_for_schedule.includes(year)
  }))

  const handle_filter_change = ({ values }) => {
    on_year_selection_change(values)
  }

  return (
    <Filter
      type='years'
      label='YEAR'
      values={filter_values}
      filter={handle_filter_change}
      single={false}
    />
  )
}

SelectedPlayerScheduleYearFilter.propTypes = {
  selected_years_for_schedule: PropTypes.array,
  on_year_selection_change: PropTypes.func.isRequired
}
