import { register } from '../source-attach-registry.mjs'
import { resolve_year_offset_range } from '../../param-utils.mjs'

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
      // Range offset against a multi-year default: enumerate the full
      // cross-product of {year_default values} x {offset range values}
      // into an IN (...) list so that only combinations actually in the
      // cross-product are matched. A BETWEEN over [min_anchor+min_off,
      // max_anchor+max_off] over-includes years that fall in the range
      // but are not reachable by any (anchor, offset) pair.
      const [min_off, max_off] = offset_range
      const years = new Set()
      for (const anchor of v.map(Number)) {
        for (let off = min_off; off <= max_off; off++) {
          years.add(anchor + off)
        }
      }
      const in_op = is_first
        ? builder.onIn.bind(builder)
        : builder.andOnIn.bind(builder)
      in_op(
        col,
        [...years].sort((a, b) => a - b)
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
