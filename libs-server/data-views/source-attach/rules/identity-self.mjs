import { register } from '../source-attach-registry.mjs'

// (X, X, default) for every identity. The cell row already carries the
// canonical reference columns; the source row joins by direct key equality
// against query_context's pid/team/year/week references.

const REF_FOR = {
  pid: 'pid_reference',
  team: 'team_reference',
  year: 'year_reference',
  week: 'week_reference'
}

// Predicate emission order is fixed so callers see a deterministic ON / AND
// sequence and the first ON pairs with the most-specific cell key.
const KEY_ORDER = ['pid', 'team', 'year', 'week']

const make_rule = (identity_id) => ({
  cell_identity: identity_id,
  source_grain: identity_id,
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate({ query_context, source, table_alias, builder }) {
    const ref = table_alias || source.table
    const key_columns = source.key_columns || {}
    const { db } = query_context

    let first_emitted = false
    for (const key of KEY_ORDER) {
      const source_col = key_columns[key]
      const cell_ref = query_context[REF_FOR[key]]
      if (!source_col || !cell_ref) continue

      const lhs = `${ref}.${source_col}`
      if (key === 'week' && source.week_type === 'string') {
        builder.andOn(db.raw(`${lhs} = CAST(${cell_ref} AS VARCHAR)`))
        continue
      }
      if (!first_emitted) {
        builder.on(lhs, '=', cell_ref)
        first_emitted = true
      } else {
        builder.andOn(lhs, '=', cell_ref)
      }
    }
  }
})

for (const id of [
  'player',
  'player_year',
  'player_year_week',
  'team',
  'team_year',
  'team_year_week'
]) {
  register(make_rule(id))
}
