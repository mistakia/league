import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, player_year, default). Source rows
// carry their own pid + year columns; cell row exposes pid_reference and
// year_reference (player cell needs player_to_player_year to expose
// year_reference; player_year/player_year_week cells already carry it).

const emit = ({ query_context, source, table_alias, builder }) => {
  const ref = table_alias || source.table
  const key_columns = source.key_columns || {}
  const { pid_reference, year_reference } = query_context

  if (!key_columns.pid) {
    throw new Error(
      `player-family-to-player-year requires source.key_columns.pid (source.table=${source.table})`
    )
  }

  builder.on(`${ref}.${key_columns.pid}`, '=', pid_reference)
  if (key_columns.year && year_reference) {
    builder.andOn(`${ref}.${key_columns.year}`, '=', year_reference)
  }
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
