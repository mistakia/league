// A calendar day with no year, emitted as a bare `MM-DD` scalar.
//
// This exists instead of reusing TABLE_DATA_TYPES.DATE with
// `datepicker_props: { views: ['month','day'] }` for one decisive reason: a
// DatePicker is bound to a concrete year, so it cannot express February 29 in
// a non-leap year -- which is the case the leap-day fixture exists to cover.
// February therefore offers 29 days here unconditionally, because the value
// names a recurring day rather than a day in some particular year.
import React, { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import FilterBase from 'react-table/src/filter-base'
import { format_column_params } from 'react-table/src/utils/format-column-params.js'
import { current_season } from '#constants'
import { KEEPTRADECUT_AS_OF_WINDOW_DAYS } from '#libs-shared/data-views-constants.mjs'
import {
  MONTH_LABELS,
  DAYS_IN_MONTH,
  parse_month_day,
  to_month_day,
  as_of_window_status,
  as_of_years_in_scope
} from '@core/data-views-fields/month-day.mjs'

import './column-param-month-day.styl'

const format_full_date = (date) =>
  `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`

export default function ColumnParamMonthDay({
  column_param_name,
  column_param_definition,
  selected_param_values,
  handle_change = () => {},
  mixed_state = false,
  row_axes = [],
  column = null
}) {
  const [trigger_close, set_trigger_close] = useState(null)

  const selected = useMemo(
    () => parse_month_day(selected_param_values),
    [selected_param_values]
  )

  const write = useCallback(
    (next) => {
      // null rather than [] when unset: [] is truthy, so an empty list renders
      // the chip as set and the param as present.
      handle_change(next ? to_month_day(next) : null)
    },
    [handle_change]
  )

  const handle_month_change = useCallback(
    (event) => {
      const month = Number(event.target.value)
      if (!month) return write(null)
      // Carry the day forward, clamped into the new month rather than left
      // overrunning it -- an unclamped write is the one value the server
      // rejects.
      const day = Math.min(selected?.day || 1, DAYS_IN_MONTH[month - 1])
      write({ month, day })
    },
    [selected, write]
  )

  const handle_day_change = useCallback(
    (event) => {
      const day = Number(event.target.value)
      const month = selected?.month || 1
      if (!day || day > DAYS_IN_MONTH[month - 1]) return
      write({ month, day })
    },
    [selected, write]
  )

  /*
    The blank a future anchor produces is correct but mute: the value is the
    latest observation in the 30 days BEFORE the chosen day, so a day that has
    not arrived holds none yet and every player renders empty. Said here, at
    configure time, rather than left for the reader to distinguish from a
    coverage gap or a broken join after the query returns.

    Only when a single column is being edited -- `column` is absent for bulk
    edit and where-clause records, and the years in scope are read off that
    column's own sibling params, so without it the warning would be guesswork.
  */
  const window_status = useMemo(() => {
    if (!column) return null
    return as_of_window_status({
      month_day: selected_param_values,
      years: as_of_years_in_scope({
        column_params: typeof column === 'string' ? {} : column.params || {},
        default_year: current_season.year
      })
    })
  }, [column, selected_param_values])

  const handle_clear = useCallback(() => {
    write(null)
    set_trigger_close((prev) => !prev)
  }, [write])

  // Under a week row axis the week branch of the join wins and this param is
  // ignored outright, so the control hides itself rather than offering a
  // setting that does nothing.
  if (row_axes.includes('week')) return null

  const label = column_param_definition?.label || column_param_name
  const selected_label = mixed_state
    ? '-'
    : format_column_params({
        column_def: {
          column_params: { [column_param_name]: column_param_definition }
        },
        column_state_params: { [column_param_name]: selected_param_values },
        variant: 'short',
        default_label: column_param_definition?.default_label || 'Opening day'
      })

  const day_count = DAYS_IN_MONTH[(selected?.month || 1) - 1]

  const body = (
    <div className='column-param-month-day'>
      <div className='table-filter-item-dropdown-head'>
        <div className='controls-button' onClick={handle_clear}>
          Clear
        </div>
        <div
          className='controls-button close'
          onClick={() => set_trigger_close((prev) => !prev)}
        >
          Close
        </div>
      </div>
      <div className='column-param-month-day-selects'>
        <label className='column-param-month-day-field'>
          <span>Month</span>
          <select value={selected?.month || ''} onChange={handle_month_change}>
            <option value=''>--</option>
            {MONTH_LABELS.map((month_label, index) => (
              <option key={month_label} value={index + 1}>
                {month_label}
              </option>
            ))}
          </select>
        </label>
        <label className='column-param-month-day-field'>
          <span>Day</span>
          <select
            value={selected?.day || ''}
            onChange={handle_day_change}
            disabled={!selected}
          >
            <option value=''>--</option>
            {Array.from({ length: day_count }, (ignored, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className='column-param-month-day-note'>
        Resolves each row to this calendar day within its own year. Unset, the
        row&apos;s value is taken as of that season&apos;s NFL opening day.
      </div>
      {window_status?.status === 'not_open' && (
        <div className='column-param-month-day-note warning'>
          This day has not arrived. Its {KEEPTRADECUT_AS_OF_WINDOW_DAYS}-day
          window opens {format_full_date(window_status.window_opens_at)}, so the
          column stays blank for every player until then.
        </div>
      )}
      {window_status?.status === 'partial' && (
        <div className='column-param-month-day-note warning'>
          This day has not arrived. Only players ranked in the{' '}
          {KEEPTRADECUT_AS_OF_WINDOW_DAYS} days before it have a value so far,
          so the column is partly filled.
        </div>
      )}
    </div>
  )

  return (
    <span className='column-param-month-day-chip'>
      <FilterBase {...{ label, selected_label, body, trigger_close }} />
    </span>
  )
}

ColumnParamMonthDay.propTypes = {
  column_param_name: PropTypes.string,
  column_param_definition: PropTypes.object,
  selected_param_values: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.array
  ]),
  handle_change: PropTypes.func,
  mixed_state: PropTypes.bool,
  row_axes: PropTypes.array,
  column: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
}
