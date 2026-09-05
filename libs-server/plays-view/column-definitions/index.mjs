import db from '#db'
import plays_view_columns from '#libs-shared/plays-view-columns.mjs'
import overrides from './overrides.mjs'

// Every plays-view column's server definition, derived from the shared
// declaration in libs-shared/plays-view-columns.mjs.
//
// A column states its physical table and column ONCE. The select, the WHERE
// expression and the aggregate follow from that pair plus the column id, which
// is also the SQL alias. Only a column whose SQL is a real expression -- a CASE,
// a concatenation across a join, the film URL -- appears in overrides.mjs, and
// only for the parts it cannot derive.
//
// Until 2026-09 this was eight hand-written files restating the same table and
// column up to four times per entry.

// AVG and SUM keep the column's own scale; a boolean counts the plays where it
// held. Every aggregating column filters through HAVING rather than WHERE,
// because its predicate applies to the aggregate and not to the row.
const AGGREGATE_SQL = {
  avg: ({ qualified, column_id }) => `AVG(${qualified}) as ${column_id}`,
  sum: ({ qualified, column_id }) => `SUM(${qualified}) as ${column_id}`,
  bool_count: ({ qualified, column_id }) =>
    `SUM(CASE WHEN ${qualified} = true THEN 1 ELSE 0 END) as ${column_id}`,
  passthrough: ({ qualified }) => qualified
}

const AGGREGATES_USING_HAVING = new Set(['avg', 'sum', 'bool_count'])

const derive = (column_id, declaration) => {
  const { table, column, aggregate } = declaration
  const definition = {}

  if (table && column) {
    const qualified = `${table}.${column}`
    definition.column_name = column
    definition.table_name = table
    // A column whose id already IS its physical column name needs no alias --
    // knex would emit `x as x`, which the original definitions did not.
    definition.main_select = () => [
      column_id === column ? qualified : `${qualified} as ${column_id}`
    ]
    definition.main_where = () => qualified

    if (aggregate && aggregate !== 'override') {
      const build = AGGREGATE_SQL[aggregate]
      if (!build)
        throw new Error(`${column_id}: unknown aggregate ${aggregate}`)
      const sql = build({ qualified, column_id })
      definition.aggregate_select = () => db.raw(sql)
      if (AGGREGATES_USING_HAVING.has(aggregate)) definition.use_having = true
    }
  }

  return definition
}

const column_definitions = {}

for (const [column_id, declaration] of Object.entries(plays_view_columns)) {
  const override = overrides[column_id] || {}
  column_definitions[column_id] = {
    ...derive(column_id, declaration),
    ...override
  }

  // The declaration's sql_override flag and this map must agree, or a reader
  // trusting the declaration would conclude that editing `table` or `column`
  // changes the emitted SQL when it does not.
  const owns_sql = Boolean(override.main_select || override.main_where)
  if (owns_sql !== Boolean(declaration.sql_override)) {
    throw new Error(
      `${column_id}: sql_override is ${Boolean(declaration.sql_override)} in the declaration but the override map ${owns_sql ? 'does' : 'does not'} supply SQL`
    )
  }

  if (Boolean(override.join) !== Boolean(declaration.join)) {
    throw new Error(
      `${column_id}: join is ${Boolean(declaration.join)} in the declaration but ${Boolean(override.join)} in the override map`
    )
  }

  // A column declaring neither a physical table-plus-column nor an overriding
  // main_select derives an EMPTY definition, which reaches the select loop as a
  // column that selects nothing and renders a header over blank cells. Refuse
  // it at import rather than serving it.
  if (!column_definitions[column_id].main_select) {
    throw new Error(
      `${column_id}: declares no table/column pair and no main_select override, so it would select nothing`
    )
  }
}

for (const column_id of Object.keys(overrides)) {
  if (!plays_view_columns[column_id]) {
    throw new Error(`${column_id}: overridden but not declared`)
  }
}

export default column_definitions
