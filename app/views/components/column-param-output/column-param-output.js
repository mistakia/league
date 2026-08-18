import React, { useMemo, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'

import FilterBase from 'react-table/src/filter-base'
import ColumnParamOverrideSection from 'react-table/src/column-param-override-section'
import { render_column_param_item } from 'react-table/src/column-controls-column-param-item'
import { output_column_param } from '#libs-shared'

import './column-param-output.styl'

// Editor for the `output` param, whose value is the object the server
// consumes: { period, aggregation, threshold }.
//
// One chip opening one panel, because the fields are one value rather than
// three params: `rate` has no threshold, `count` requires one, and the two
// aggregations draw their period from different lists. Picking a period is
// what selects the aggregation -- there is no separate aggregation control,
// since every valid pair is reachable by choosing a period from the section it
// belongs to.

const DEFAULT_THRESHOLD = { op: '>=', value: 0 }

export default function ColumnParamOutput({
  column_param_name,
  column_param_definition,
  selected_param_values,
  handle_change = () => {},
  mixed_state = false,
  row_axes = [],
  column,
  column_index,
  set_local_table_state
}) {
  const output = selected_param_values || null
  const aggregation = output?.aggregation || null

  const [trigger_close, set_trigger_close] = useState(false)

  const rate_period_options = useMemo(
    () => column_param_definition?.values || [],
    [column_param_definition]
  )
  const count_period_options =
    column_param_definition?.count_periods ||
    output_column_param.COUNT_PERIOD_OPTIONS

  const label = column_param_definition?.label || column_param_name
  const selected_label = mixed_state
    ? '-'
    : output_column_param.format_output_value({ value: output }) || 'None'

  const handle_select_period = useCallback(
    ({ period, next_aggregation }) => {
      if (next_aggregation === 'rate') {
        return handle_change({ period, aggregation: 'rate', threshold: null })
      }
      return handle_change({
        period,
        aggregation: 'count',
        threshold: output?.threshold || DEFAULT_THRESHOLD
      })
    },
    [handle_change, output]
  )

  const handle_threshold_operator_change = useCallback(
    (op) => {
      const threshold = output?.threshold || DEFAULT_THRESHOLD
      handle_change({ ...output, threshold: { ...threshold, op } })
    },
    [handle_change, output]
  )

  // Committed on blur rather than per keystroke: every commit rewrites table
  // state and refires the query.
  const [threshold_draft, set_threshold_draft] = useState('')
  useEffect(() => {
    set_threshold_draft(
      output?.threshold?.value != null ? String(output.threshold.value) : ''
    )
  }, [output?.threshold?.value])

  const commit_threshold_value = useCallback(() => {
    const parsed = Number(threshold_draft)
    if (threshold_draft === '' || Number.isNaN(parsed)) {
      return set_threshold_draft(
        output?.threshold?.value != null ? String(output.threshold.value) : ''
      )
    }
    if (parsed === output?.threshold?.value) return
    const threshold = output?.threshold || DEFAULT_THRESHOLD
    handle_change({ ...output, threshold: { ...threshold, value: parsed } })
  }, [threshold_draft, output, handle_change])

  const render_period_item = ({ option, item_aggregation }) => {
    const is_selected =
      aggregation === item_aggregation && output?.period === option.value
    const class_names = ['table-filter-item-dropdown-item']
    if (is_selected) class_names.push('selected')

    return (
      <div
        key={`${item_aggregation}_${option.value}`}
        className={class_names.join(' ')}
        onClick={() =>
          handle_select_period({
            period: option.value,
            next_aggregation: item_aggregation
          })
        }
      >
        <Checkbox checked={is_selected} size='small' />
        <div className='table-filter-item-dropdown-item-label'>
          {option.label}
        </div>
      </div>
    )
  }

  // The override panel writes sibling params on one column, so it needs the
  // single-column handles. Where-clause records and bulk edit do not carry
  // them; there the panel is correctly absent.
  const has_single_column_handles = Boolean(
    column && column_index !== undefined && set_local_table_state
  )
  const show_denominator_overrides =
    aggregation === 'rate' &&
    has_single_column_handles &&
    column_param_definition?.param_override_config

  const body = (
    <div className='column-param-output-panel'>
      <div className='table-filter-item-dropdown-head'>
        <div className='controls-button' onClick={() => handle_change(null)}>
          Clear
        </div>
        <div
          className='controls-button close'
          onClick={() => set_trigger_close((prev) => !prev)}
        >
          Close
        </div>
      </div>

      <div className='column-param-output-panel-body'>
        <div className='column-param-output-section'>
          <div className='column-param-output-section-header'>Rate Per</div>
          <div className='column-param-output-options'>
            {rate_period_options.map((option) =>
              render_period_item({ option, item_aggregation: 'rate' })
            )}
          </div>
        </div>

        <div className='column-param-output-section'>
          <div className='column-param-output-section-header'>Count Of</div>
          <div className='column-param-output-options'>
            {count_period_options.map((option) =>
              render_period_item({ option, item_aggregation: 'count' })
            )}
          </div>
          {aggregation === 'count' && (
            <div className='column-param-output-threshold'>
              <div className='column-param-output-threshold-operators'>
                {output_column_param.THRESHOLD_OPERATOR_OPTIONS.map(
                  (operator) => {
                    const class_names = ['column-param-output-threshold-op']
                    if (output?.threshold?.op === operator.value) {
                      class_names.push('selected')
                    }
                    return (
                      <div
                        key={operator.value}
                        className={class_names.join(' ')}
                        onClick={() =>
                          handle_threshold_operator_change(operator.value)
                        }
                      >
                        {operator.label}
                      </div>
                    )
                  }
                )}
              </div>
              <TextField
                className='column-param-output-threshold-value'
                label='Threshold'
                size='small'
                variant='outlined'
                value={threshold_draft}
                onChange={(event) => set_threshold_draft(event.target.value)}
                onBlur={commit_threshold_value}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.target.blur()
                }}
              />
            </div>
          )}
        </div>
      </div>

      {show_denominator_overrides && (
        <ColumnParamOverrideSection
          param_override_config={column_param_definition.param_override_config}
          effective_value={output?.period}
          column={column}
          column_index={column_index}
          set_local_table_state={set_local_table_state}
          row_axes={row_axes}
          render_param_item={render_column_param_item}
        />
      )}
    </div>
  )

  return <FilterBase {...{ label, selected_label, body, trigger_close }} />
}

ColumnParamOutput.propTypes = {
  column_param_name: PropTypes.string,
  column_param_definition: PropTypes.object,
  selected_param_values: PropTypes.object,
  handle_change: PropTypes.func,
  mixed_state: PropTypes.bool,
  row_axes: PropTypes.array,
  column: PropTypes.object,
  column_index: PropTypes.number,
  set_local_table_state: PropTypes.func
}
