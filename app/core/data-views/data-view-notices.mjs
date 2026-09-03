import { resolve_nfl_week_dynamic_value } from '#libs-shared/nfl-week-dynamic-values.mjs'

const summarize_year_seas_set = (values) => {
  const years = new Set()
  const seas_types = new Set()
  for (const v of values) {
    const m = /^(\d{4})_([A-Z]+)_/.exec(v)
    if (!m) return null
    years.add(parseInt(m[1], 10))
    seas_types.add(m[2])
  }
  if (!years.size) return null
  const sorted = [...years].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const range = min === max ? `${min}` : `${min}-${max}`
  return `${range} ${[...seas_types].join('/')}`
}

const format_resolved_values = (key, values) => {
  if (!values.length) return ''
  if (key === 'nfl_week_id') {
    return summarize_year_seas_set(values) || ''
  }
  const preview = values.slice(0, 4).join(', ')
  return values.length > 4 ? `${preview}, +${values.length - 4} more` : preview
}

// Delegates to the one shared resolver rather than carrying a fourth copy of
// the same switch. The copies had already drifted: this one anchored
// last_n_nfl_years on the last completed season while the server anchored it on
// the current one, so the preview named a different span than the query used.
//
// The resolver THROWS on an unknown dynamic_type, and that is right on the
// SERVER: an unresolvable dynamic that still reads as an explicit time scope
// leaves the row axis unbounded, which is a silent multi-million-row fan-out.
// That rationale does not reach here. This runs inside a createSelector on the
// data-views render path and a notice preview has no row axis, so the only
// thing the throw can accomplish on the client is turning the next retired
// dynamic type into a page crash. Caught here, and ONLY here -- the server-side
// throw is deliberately untouched.
//
// Returning null puts an unresolvable value on the same path as one that
// resolves to nothing, which the caller already handles by declining to build
// a preview.
const resolve_dynamic_nfl_week_id = (dv) => {
  try {
    return resolve_nfl_week_dynamic_value({
      dynamic_type: dv.dynamic_type,
      value: dv.value
    })
  } catch {
    return null
  }
}

const resolve_param_values = (key, value) => {
  const list = Array.isArray(value) ? value : [value]
  const resolved = []
  for (const v of list) {
    if (v && typeof v === 'object' && v.dynamic_type) {
      if (key !== 'nfl_week_id') return null
      const r = resolve_dynamic_nfl_week_id(v)
      if (!r) return null
      resolved.push(...r)
      continue
    }
    resolved.push(v)
  }
  return resolved
}

const find_filter_param_key_absent_from_columns = ({ where, columns }) => {
  const column_param_keys = new Set()
  for (const col of columns) {
    if (col && typeof col === 'object' && col.params) {
      for (const k of Object.keys(col.params)) column_param_keys.add(k)
    }
  }
  const notices = []
  for (let filter_index = 0; filter_index < where.length; filter_index++) {
    const filter = where[filter_index]
    const params = filter?.params || {}
    for (const key of Object.keys(params)) {
      if (!column_param_keys.has(key)) {
        const filter_value_preview = format_resolved_values(
          key,
          resolve_param_values(key, params[key]) || []
        )
        const scope_part = filter_value_preview
          ? ` (${filter_value_preview})`
          : ''
        notices.push({
          code: 'filter_param_key_absent_from_columns',
          severity: 'info',
          filter_index,
          message: `Filter scopes by "${key}"${scope_part}, but no displayed column shares this scope. Column values may include data outside the filter's scope.`
        })
      }
    }
  }
  return notices
}

const find_filter_param_value_disjoint_from_columns = ({ where, columns }) => {
  const notices = []
  for (let filter_index = 0; filter_index < where.length; filter_index++) {
    const filter = where[filter_index]
    const filter_params = filter?.params || {}
    for (const [key, filter_value] of Object.entries(filter_params)) {
      const resolved_filter = resolve_param_values(key, filter_value)
      if (!resolved_filter || resolved_filter.length === 0) continue

      let any_column_carries_key = false
      let any_overlap = false
      let any_column_dynamic = false
      const column_value_union = new Set()

      for (const col of columns) {
        if (!col || typeof col !== 'object' || !col.params) continue
        if (!(key in col.params)) continue
        any_column_carries_key = true
        const resolved_col = resolve_param_values(key, col.params[key])
        if (!resolved_col) {
          any_column_dynamic = true
          continue
        }
        for (const v of resolved_col) column_value_union.add(v)
        const col_set = new Set(resolved_col)
        if (resolved_filter.some((v) => col_set.has(v))) {
          any_overlap = true
          break
        }
      }

      if (any_column_carries_key && !any_overlap && !any_column_dynamic) {
        const filter_scope = format_resolved_values(key, resolved_filter)
        const column_scope = format_resolved_values(key, [
          ...column_value_union
        ])
        notices.push({
          code: 'filter_param_value_disjoint_from_columns',
          severity: 'info',
          filter_index,
          message: `Filter scopes "${key}" to ${filter_scope}, but columns carry ${column_scope}. Scopes do not overlap; results may be unexpected.`
        })
      }
    }
  }
  return notices
}

// A query-backed view is not editable in the dimensions that would change the
// STATEMENT, and there is no control anywhere that says so -- the picker simply
// offers fewer columns, which reads as a bug rather than as a rule. The notice
// is what makes the boundary legible: everything the outer wrap can carry still
// works, and everything that would rewrite the query does not.
const find_query_backed_view = ({ query_id }) => {
  if (!query_id) return []
  return [
    {
      code: 'view_backed_by_query',
      severity: 'info',
      message:
        'This view is built from a query. You can sort, filter, page, reorder and resize its columns, but you cannot add registry columns or change its row grain.'
    }
  ]
}

// An agent built this view, and the reader is entitled to know before they act
// on it. The claim is deliberately narrow -- it says where the view came from
// and nothing about whether it is right, because the notice cannot know that
// and a reassuring one would be worse than none.
//
// Driven off llm_generated_at, which the SERVER stamps from the generation job
// rather than from anything the client asserts, so the notice cannot be made to
// appear or disappear from the browser. That also means it survives a reload
// and a share link, which a client-state notice would not.
const find_generated_view = ({ llm_generated_at }) => {
  if (!llm_generated_at) return []
  return [
    {
      code: 'view_generated_by_llm',
      severity: 'info',
      message:
        'This view was built by an agent from a written instruction. Check that its columns and filters say what you meant before relying on the numbers.'
    }
  ]
}

// Promoted to a registry at the THIRD rule, which is the threshold
// add-data-view-notice-infrastructure-and-filter-chips set for itself when it
// shipped the first two. Each rule takes the whole context and returns an array,
// so a rule that needs an input the others do not costs nothing to add.
const NOTICE_RULES = [
  find_filter_param_key_absent_from_columns,
  find_filter_param_value_disjoint_from_columns,
  find_query_backed_view,
  find_generated_view
]

export default function get_data_view_notices({
  where,
  columns,
  query_id = null,
  llm_generated_at = null
}) {
  if (!Array.isArray(where) || !Array.isArray(columns)) return []
  const context = { where, columns, query_id, llm_generated_at }
  return NOTICE_RULES.flatMap((rule) => rule(context))
}
