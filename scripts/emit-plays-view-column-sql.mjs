// Emits the SQL every plays-view column definition produces, as stable JSON.
//
// The load-bearing check of the registry collapse: column ids are persisted in
// immutable short URLs, so neither an id nor a byte of emitted SQL may move.
// Run this in a worktree pinned to the pre-change revision and again in the
// working tree, then diff. It reports its own denominator, so a harness that
// stopped reaching columns cannot read as a match.
//
//   NODE_ENV=test node scripts/emit-plays-view-column-sql.mjs > /tmp/before.json
//
// Needs no database: knex builds SQL without connecting.

import plays_view_column_definitions from '#libs-server/plays-view/column-definitions/index.mjs'

const GROUP_BY_VALUES = ['team', 'player', 'year', 'week', 'game', 'play_type']

// The FORM matters as much as the text. Knex quotes a plain string select into
// "nfl_plays"."esbid" as "play_esbid" and passes a db.raw through bare, so two
// fragments that stringify identically can emit different SQL. Recording only
// the text would let a string/raw swap pass as byte-identical.
const render = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return { form: 'string', sql: value }
  if (typeof value === 'function')
    return { form: 'function', sql: `[function ${value.name || ''}]` }
  const form =
    value.constructor?.name === 'Raw' ? 'raw' : value.constructor?.name
  return { form, sql: String(value) }
}

const render_list = (value) =>
  Array.isArray(value) ? value.map(render) : render(value)

const call = (fn, args) => {
  if (typeof fn !== 'function') return render_list(fn)
  try {
    return render_list(fn(args))
  } catch (err) {
    return `[threw ${err.message}]`
  }
}

const out = {}
const column_ids = Object.keys(plays_view_column_definitions).sort()

for (const column_id of column_ids) {
  const definition = plays_view_column_definitions[column_id]
  const entry = {
    column_name: definition.column_name ?? null,
    table_name: definition.table_name ?? null,
    use_having: definition.use_having ?? null,
    sort_column_name: render(definition.sort_column_name),
    main_select: call(definition.main_select, {}),
    main_where: call(definition.main_where, {}),
    has_join: typeof definition.join === 'function'
  }

  if (definition.aggregate_select) {
    entry.aggregate_select = call(definition.aggregate_select, {})
  }

  if (definition.group_by_select) {
    entry.group_by_select = {}
    for (const group_by of GROUP_BY_VALUES) {
      entry.group_by_select[group_by] = call(definition.group_by_select, {
        group_by
      })
    }
  }

  out[column_id] = entry
}

process.stdout.write(
  JSON.stringify({ column_count: column_ids.length, columns: out }, null, 2) +
    '\n'
)
