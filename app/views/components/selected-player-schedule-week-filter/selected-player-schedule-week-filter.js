import React from 'react'
import PropTypes from 'prop-types'

import Filter from '@components/filter'
import { nfl_weeks } from '@constants'

export default function SelectedPlayerScheduleWeekFilter({
  selected_weeks_for_schedule = [],
  on_week_selection_change
}) {
  const filter_values = nfl_weeks.map((week) => ({
    label: week.toString(),
    value: week,
    selected: selected_weeks_for_schedule.includes(week)
  }))

  const handle_filter_change = ({ values }) => {
    on_week_selection_change(values)
  }

  return (
    <Filter
      type='weeks'
      label='WEEKS'
      values={filter_values}
      filter={handle_filter_change}
      single={false}
    />
  )
}

SelectedPlayerScheduleWeekFilter.propTypes = {
  selected_weeks_for_schedule: PropTypes.array,
  on_week_selection_change: PropTypes.func.isRequired
}
