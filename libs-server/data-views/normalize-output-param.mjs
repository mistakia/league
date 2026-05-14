import debug from 'debug'

import { translate_rate_type_to_output } from '#libs-shared/data-views-output-tokens.mjs'

const log = debug('data-views:normalize-output')

const extract_rate_type = (rate_type) => {
  if (rate_type == null) return null
  if (Array.isArray(rate_type)) {
    return rate_type.length > 0 ? rate_type[0] : null
  }
  return rate_type
}

export const normalize_output_param = ({ column, splits = [] }) => {
  if (!column || typeof column !== 'object') return column
  const params = column.params || {}
  let next_params = params
  let mutated = false

  if (!params.output && params.rate_type) {
    const token = extract_rate_type(params.rate_type)
    const translated = translate_rate_type_to_output(token)
    if (translated) {
      next_params = { ...next_params, output: translated }
      mutated = true
    } else if (token) {
      log(`Unknown legacy rate_type token: ${token}`)
    }
  }

  if (next_params.output) {
    const { period, aggregation } = next_params.output
    const has_week_split = splits.includes('week')

    if (has_week_split && aggregation === 'rate' && period === 'game') {
      log(
        `Dropping output={period:game,aggregation:rate} under week split for ${column.column_id}`
      )
      const { output: _drop, ...rest } = next_params
      next_params = rest
      mutated = true
    } else if (
      has_week_split &&
      aggregation === 'count' &&
      period === 'season'
    ) {
      throw new Error(
        `output={period:season,aggregation:count} is invalid under week split (column ${column.column_id})`
      )
    }
  }

  if (mutated) {
    return { ...column, params: next_params }
  }
  return column
}

export const normalize_columns = ({ columns, splits = [] }) =>
  columns.map((column) =>
    typeof column === 'object'
      ? normalize_output_param({ column, splits })
      : column
  )
