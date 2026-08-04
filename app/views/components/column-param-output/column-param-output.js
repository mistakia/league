import React, { useMemo, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import TextField from '@mui/material/TextField'

import ColumnParamSelectFilter from 'react-table/src/column-param-select-filter'
import ColumnParamSelectFilterWithOverrides from 'react-table/src/column-param-select-filter-with-overrides'
import { output_column_param } from '@libs-shared'

import './column-param-output.styl'

// Editor for the `output` param, whose value is the object the server
// consumes: { period, aggregation, threshold }.
//
// It is three controls over one value rather than three params, because the
// three fields are not independently valid -- `rate` has no threshold, `count`
// requires one, and the two aggregations draw their period from different
// lists. Emitting them as separate params would let the UI produce
// combinations the output-aggregator registry has no entry for.

const DEFAULT_THRESHOLD = { op: '>=', value: 0 }

const first_value = (value) => (Array.isArray(value) ? value[0] : value)

const build_select_definition = ({ label, values }) => ({
  label,
  single: true,
  default_value: null,
  values
})

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

  const rate_period_options = useMemo(
    () => column_param_definition?.values || [],
    [column_param_definition]
  )
  const count_period_options =
    column_param_definition?.count_periods ||
    output_column_param.COUNT_PERIOD_OPTIONS

  const aggregation_definition = useMemo(
    () =>
      build_select_definition({
        label: column_param_definition?.label || column_param_name,
        values: [
          { value: null, label: 'None' },
          ...(column_param_definition?.aggregations ||
            output_column_param.AGGREGATION_OPTIONS)
        ]
      }),
    [column_param_definition, column_param_name]
  )

  const count_period_definition = useMemo(
    () =>
      build_select_definition({
        label: 'Count Of',
        values: count_period_options
      }),
    [count_period_options]
  )

  const threshold_operator_definition = useMemo(
    () =>
      build_select_definition({
        label: 'Threshold',
        values: output_column_param.THRESHOLD_OPERATOR_OPTIONS
      }),
    []
  )

  // The rate period select doubles as the denominator-override panel, so it
  // needs the single-column handles. Where-clause records and bulk edit do not
  // carry them; there the plain select is the correct degradation.
  const has_single_column_handles = Boolean(
    column && column_index !== undefined && set_local_table_state
  )

  const rate_period_definition = useMemo(
    () => ({
      label: 'Rate Per',
      single: true,
      default_value: null,
      values: rate_period_options,
      param_override_config: column_param_definition?.param_override_config
    }),
    [rate_period_options, column_param_definition]
  )

  const handle_aggregation_change = useCallback(
    (value) => {
      const next_aggregation = first_value(value)
      if (!next_aggregation) return handle_change(null)

      if (next_aggregation === 'rate') {
        const keeps_period = rate_period_options.some(
          (option) => option.value === output?.period
        )
        return handle_change({
          period: keeps_period ? output.period : rate_period_options[0]?.value,
          aggregation: 'rate',
          threshold: null
        })
      }

      const keeps_period = count_period_options.some(
        (option) => option.value === output?.period
      )
      return handle_change({
        period: keeps_period ? output.period : count_period_options[0]?.value,
        aggregation: 'count',
        threshold: output?.threshold || DEFAULT_THRESHOLD
      })
    },
    [handle_change, output, rate_period_options, count_period_options]
  )

  const handle_period_change = useCallback(
    (value) => {
      const period = first_value(value)
      if (!period) return handle_change(null)
      return handle_change({ ...output, period })
    },
    [handle_change, output]
  )

  const handle_threshold_operator_change = useCallback(
    (value) => {
      const op = first_value(value)
      if (!op) return
      const threshold = output?.threshold || DEFAULT_THRESHOLD
      return handle_change({ ...output, threshold: { ...threshold, op } })
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

  return (
    <div className='column-param-output'>
      <ColumnParamSelectFilter
        column_param_name={column_param_name}
        column_param_definition={aggregation_definition}
        selected_param_values={aggregation}
        handle_change={handle_aggregation_change}
        mixed_state={mixed_state}
        row_axes={row_axes}
      />

      {aggregation === 'rate' &&
        (has_single_column_handles &&
        rate_period_definition.param_override_config ? (
          <ColumnParamSelectFilterWithOverrides
            column_param_name='period'
            column_param_definition={rate_period_definition}
            selected_param_values={output?.period}
            handle_change={handle_period_change}
            column={column}
            column_index={column_index}
            set_local_table_state={set_local_table_state}
            row_axes={row_axes}
          />
        ) : (
          <ColumnParamSelectFilter
            column_param_name='period'
            column_param_definition={rate_period_definition}
            selected_param_values={output?.period}
            handle_change={handle_period_change}
            row_axes={row_axes}
          />
        ))}

      {aggregation === 'count' && (
        <>
          <ColumnParamSelectFilter
            column_param_name='period'
            column_param_definition={count_period_definition}
            selected_param_values={output?.period}
            handle_change={handle_period_change}
            row_axes={row_axes}
          />
          <ColumnParamSelectFilter
            column_param_name='threshold_op'
            column_param_definition={threshold_operator_definition}
            selected_param_values={output?.threshold?.op}
            handle_change={handle_threshold_operator_change}
            row_axes={row_axes}
          />
          <TextField
            className='column-param-output__threshold-value'
            label='Value'
            size='small'
            variant='outlined'
            value={threshold_draft}
            onChange={(event) => set_threshold_draft(event.target.value)}
            onBlur={commit_threshold_value}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.target.blur()
            }}
          />
        </>
      )}
    </div>
  )
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
