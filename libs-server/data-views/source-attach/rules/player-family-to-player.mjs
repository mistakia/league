import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, player, default). Source rows carry
// only a pid column; cell row exposes pid_reference. No year predicate is
// emitted because the source has no year column.

const emit = ({ query_context, source, table_alias, builder }) => {
  const ref = table_alias || source.table
  const key_columns = source.key_columns || {}
  const { pid_reference } = query_context

  if (!key_columns.pid) {
    throw new Error(
      `player-family-to-player requires source.key_columns.pid (source.table=${source.table})`
    )
  }

  builder.on(`${ref}.${key_columns.pid}`, '=', pid_reference)
}

// (player, player, default) is covered by identity-self.
register({
  cell_identity: 'player_year',
  source_grain: 'player',
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate: emit
})

register({
  cell_identity: 'player_year_week',
  source_grain: 'player',
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate: emit
})
