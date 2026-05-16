import { register } from '../source-attach-registry.mjs'

// (X, X, default) for every identity. The cell row already carries the
// canonical reference columns; the source row joins by direct key equality
// against query_context's pid/team/year/week references.

const make_rule = (identity_id) => ({
  cell_identity: identity_id,
  source_grain: identity_id,
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate({ query_context, source, table_alias, builder }) {
    const ref = table_alias || source.table
    const {
      pid_reference,
      team_reference,
      year_reference,
      week_reference
    } = query_context

    let on_called = false
    const join_first = (col, val) => {
      if (!on_called) {
        builder.on(col, '=', val)
        on_called = true
      } else {
        builder.andOn(col, '=', val)
      }
    }

    if (source.key_columns.pid && pid_reference) {
      join_first(`${ref}.${source.key_columns.pid}`, pid_reference)
    }
    if (source.key_columns.team && team_reference) {
      join_first(`${ref}.${source.key_columns.team}`, team_reference)
    }
    if (source.key_columns.year && year_reference) {
      join_first(`${ref}.${source.key_columns.year}`, year_reference)
    }
    if (source.key_columns.week && week_reference) {
      const week_col = `${ref}.${source.key_columns.week}`
      if (source.week_type === 'string') {
        builder.andOn(
          query_context.db.raw(
            `${week_col} = CAST(${week_reference} AS VARCHAR)`
          )
        )
      } else {
        join_first(week_col, week_reference)
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
