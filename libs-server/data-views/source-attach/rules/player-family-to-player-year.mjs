import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, player_year, default). Source rows
// carry their own pid + year columns; cell row exposes pid_reference and
// year_reference (player cell needs player_to_player_year to expose
// year_reference; player_year/player_year_week cells already carry it).

const emit = ({ query_context, source, table_alias, params, builder }) => {
  const ref = table_alias || source.table
  const key_columns = source.key_columns || {}
  const { pid_reference, year_reference, db } = query_context

  builder.on(`${ref}.${key_columns.pid}`, '=', pid_reference)
  emit_year_match({
    builder,
    db,
    year_reference,
    source,
    key_columns,
    params,
    ref
  })
}

// Resolve params.year_offset into [min, max]. Returns null when no offset
// is specified so callers can take their non-offset code path.
const resolve_year_offset_range = (params) => {
  const raw = params && params.year_offset
  if (raw == null) return null
  const arr = Array.isArray(raw) ? raw : [raw, raw]
  if (!arr.length) return null
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}

export const emit_year_match = ({
  builder,
  db,
  year_reference,
  source,
  key_columns,
  params,
  ref,
  is_first = false
}) => {
  if (!key_columns.year) return
  const col = `${ref}.${key_columns.year}`
  const eq = is_first ? builder.on.bind(builder) : builder.andOn.bind(builder)
  const offset_range = resolve_year_offset_range(params)
  if (year_reference) {
    if (offset_range) {
      const [min_off, max_off] = offset_range
      if (min_off === max_off) {
        eq(db.raw(`${col} = ${year_reference} + ?`, [min_off]))
      } else {
        eq(
          db.raw(
            `${col} BETWEEN ${year_reference} + ? AND ${year_reference} + ?`,
            [min_off, max_off]
          )
        )
      }
      return
    }
    eq(col, '=', year_reference)
    return
  }
  if (typeof source.year_default !== 'function') return
  const v = source.year_default(params)
  if (v == null) return
  // Apply year_offset to the literal default year when no year_reference is
  // available. The default is treated as the anchor "base year"; an offset
  // shifts that base.
  const shift = (n) =>
    offset_range && offset_range[0] === offset_range[1]
      ? Number(n) + offset_range[0]
      : Number(n)
  if (Array.isArray(v)) {
    if (offset_range && offset_range[0] !== offset_range[1]) {
      // Range offset against a multi-year default: emit BETWEEN over the
      // unioned shifted bounds.
      const min_anchor = Math.min(...v.map(Number))
      const max_anchor = Math.max(...v.map(Number))
      eq(
        db.raw(`${col} BETWEEN ? AND ?`, [
          min_anchor + offset_range[0],
          max_anchor + offset_range[1]
        ])
      )
      return
    }
    const shifted = v.map(shift)
    if (shifted.length === 1) {
      eq(col, '=', db.raw('?', [shifted[0]]))
    } else if (shifted.length > 1) {
      const in_op = is_first
        ? builder.onIn.bind(builder)
        : builder.andOnIn.bind(builder)
      in_op(col, shifted)
    }
    return
  }
  if (offset_range && offset_range[0] !== offset_range[1]) {
    eq(
      db.raw(`${col} BETWEEN ? AND ?`, [
        Number(v) + offset_range[0],
        Number(v) + offset_range[1]
      ])
    )
    return
  }
  eq(col, '=', db.raw('?', [shift(v)]))
}

register({
  cell_identity: 'player',
  source_grain: 'player_year',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player', to: 'player_year', mode: 'default' }
  ],
  emit_predicate: emit
})

// (player_year, player_year, default) is covered by identity-self.
// player_year_week cell already exposes pid_reference + year_reference via
// the cell identity (player_year_week extends player_year row-shape).
register({
  cell_identity: 'player_year_week',
  source_grain: 'player_year',
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate: emit
})
