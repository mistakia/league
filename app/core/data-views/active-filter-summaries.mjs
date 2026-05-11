import format_param_scope from './format-param-scope.mjs'

const format_value_label = ({ value, def, operator }) => {
  const list = Array.isArray(value) ? value : [value]
  if (def?.values && def.values.length && typeof def.values[0] === 'object') {
    const lookup = new Map(def.values.map((v) => [v.value, v.label]))
    return list.map((v) => lookup.get(v) || String(v)).join(', ')
  }
  if (operator === 'IN' || operator === 'NOT IN') {
    return `[${list.join(', ')}]`
  }
  return list.map((v) => String(v)).join(', ')
}

export default function get_active_filter_summaries({ where, fields }) {
  if (!Array.isArray(where) || !fields) return []
  return where.map((filter, filter_index) => {
    const { column_id, params = {}, value, operator } = filter
    const field = fields[column_id] || {}
    const column_label =
      field.column_title || field.header_label || field.label || column_id
    const value_label = format_value_label({ value, def: field, operator })
    const scope_label = format_param_scope({
      params,
      column_params: field.column_params
    })
    return {
      filter_index,
      column_id,
      column_label,
      operator,
      value_label,
      scope_label
    }
  })
}
