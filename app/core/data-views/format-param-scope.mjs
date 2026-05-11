export default function format_param_scope({ params, column_params }) {
  if (!params || typeof params !== 'object') return ''
  const parts = []
  for (const [key, value] of Object.entries(params)) {
    const def = column_params?.[key]
    if (typeof def?.format_value === 'function') {
      parts.push(def.format_value({ value, def }))
      continue
    }
    if (
      Array.isArray(def?.values) &&
      def.values.length &&
      typeof def.values[0] === 'object'
    ) {
      const lookup = new Map(def.values.map((v) => [v.value, v.label]))
      const value_list = Array.isArray(value) ? value : [value]
      parts.push(
        value_list
          .map((v) => (lookup.has(v) ? lookup.get(v) : String(v)))
          .join(', ')
      )
      continue
    }
    parts.push(
      `${key}: ${Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}`
    )
  }
  return parts.join(' / ')
}
