import React from 'react'
import PropTypes from 'prop-types'

import Filter from '@components/filter'
import { current_season } from '@constants'
import {
  get_nfl_week_identifiers_for_year,
  parse_nfl_week_identifier,
  get_postseason_week_label
} from '@libs-shared/nfl-week-identifier.mjs'

const default_year = current_season.week
  ? current_season.year
  : current_season.year - 1

const PARSED_IDS = [
  ...get_nfl_week_identifiers_for_year({
    year: default_year,
    seas_type: 'REG'
  }),
  ...get_nfl_week_identifiers_for_year({
    year: default_year,
    seas_type: 'POST'
  })
].map((id) => {
  const parsed = parse_nfl_week_identifier({ identifier: id })
  const label = parsed
    ? parsed.seas_type === 'POST'
      ? `${parsed.seas_type} ${get_postseason_week_label({ week: parsed.week })}`
      : `${parsed.seas_type} ${parsed.week}`
    : id
  return { id, label }
})

export default function SelectedPlayerScheduleWeekFilter({
  selected_weeks_for_schedule = [],
  on_week_selection_change
}) {
  const filter_values = PARSED_IDS.map(({ id, label }) => ({
    label,
    value: id,
    selected: selected_weeks_for_schedule.includes(id)
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
