// Catalog of columns whose permitted VALUES are pinned by a CHECK vocabulary.
//
// The oracle for stranded-literal detection: a predicate that binds a literal
// to one of these columns can only match if the literal is in the column's
// permitted set. The constraint proves the negative, so this is a static
// oracle -- it reads db/schema.postgres.sql and needs no database connection.
//
// Partition children are excluded via schema-partitions.mjs rather than a
// relkind filter, because the partitioned PARENT is relkind='p' and a naive
// `relkind='r'` filter drops it while keeping all 27 of its children. As of
// 2026-08-18 production carries 74 such constraints, of which 28 sit on
// children of player_gamelogs, leaving 46 logical constrained columns.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parse_partition_children } from './schema-partitions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const default_schema_path = path.join(__dirname, '..', 'schema.postgres.sql')

// pg_dump writes every table-level CHECK inside the CREATE TABLE body, one per
// line, as `CONSTRAINT <name> CHECK ((...))`. A value-vocabulary constraint is
// the subset whose expression is an `= ANY (ARRAY[...])` membership test.
const CONSTRAINT_LINE =
  /^\s*CONSTRAINT\s+([A-Za-z0-9_]+)\s+CHECK\s+\((.*)\)[,;]?\s*$/
const CREATE_TABLE = /^CREATE TABLE (?:public\.)?([A-Za-z0-9_]+) \(/

// The column under the constraint is the operand LEFT of `= ANY`. It appears
// either bare (`duration = ANY`) or cast (`(player_position)::text = ANY`),
// and a nullable column wraps the whole test in `(col IS NULL) OR (...)`.
const ANY_TEST = /\(?([A-Za-z0-9_]+)\)?(?:::[A-Za-z ]+)?\s*=\s*ANY\s*\(/

// Literals inside the ARRAY[...], each carrying a type cast in the dump.
const ARRAY_LITERAL = /'((?:[^']|'')*)'::(?:character varying|text|bpchar)/g

// An all-integer vocabulary (seasons.restricted_free_agency_window_hours) has
// no quotes and no casts.
const ARRAY_INT_LITERAL = /(?:^|[\s,[])(-?\d+)(?=\s*[,\]])/g

function parse_vocabulary(expression) {
  const array_start = expression.indexOf('ARRAY[')
  if (array_start === -1) return null
  const open = array_start + 'ARRAY'.length
  let depth = 0
  let close = -1
  for (let i = open; i < expression.length; i++) {
    const ch = expression[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1) return null
  const body = expression.slice(open + 1, close)

  const values = []
  let m
  while ((m = ARRAY_LITERAL.exec(body))) values.push(m[1].replace(/''/g, "'"))
  ARRAY_LITERAL.lastIndex = 0
  if (values.length) return { values, kind: 'text' }

  while ((m = ARRAY_INT_LITERAL.exec(body))) values.push(m[1])
  ARRAY_INT_LITERAL.lastIndex = 0
  if (values.length) return { values, kind: 'integer' }

  return null
}

// Every value-vocabulary CHECK in the schema file, INCLUDING the ones sitting
// on partition children. Callers that want the logical set use
// vocabulary_constrained_columns() below.
export function parse_all_vocabulary_constraints(sql) {
  const found = []
  let table = null
  for (const line of sql.split('\n')) {
    const create = CREATE_TABLE.exec(line)
    if (create) {
      table = create[1]
      continue
    }
    if (line.startsWith(');')) {
      table = null
      continue
    }
    if (!table) continue

    const constraint = CONSTRAINT_LINE.exec(line)
    if (!constraint) continue
    const [, constraint_name, expression] = constraint
    if (!/=\s*ANY\s*\(/.test(expression)) continue

    const any_test = ANY_TEST.exec(expression)
    if (!any_test) continue
    const vocabulary = parse_vocabulary(expression)
    if (!vocabulary) continue

    found.push({
      table,
      column: any_test[1],
      constraint: constraint_name,
      nullable: /IS NULL/.test(expression),
      values: vocabulary.values,
      value_kind: vocabulary.kind
    })
  }
  return found
}

// The logical set: one entry per (table, column), partition children folded
// away into their parent.
export function vocabulary_constrained_columns({
  schema_path = default_schema_path
} = {}) {
  const sql = fs.readFileSync(schema_path, 'utf8')
  const children = parse_partition_children(sql)
  const all = parse_all_vocabulary_constraints(sql)
  return {
    columns: all.filter((entry) => !children.has(entry.table)),
    total_constraints: all.length,
    partition_child_constraints: all.filter((entry) =>
      children.has(entry.table)
    ).length
  }
}

// Index keyed `table.column` for the literal scanner.
export function vocabulary_index(columns) {
  const index = new Map()
  for (const entry of columns)
    index.set(`${entry.table}.${entry.column}`, entry)
  return index
}

// Column name -> every constrained table carrying it. The scanner uses this to
// decide whether an unqualified column reference is interesting at all.
export function vocabulary_by_column_name(columns) {
  const index = new Map()
  for (const entry of columns) {
    if (!index.has(entry.column)) index.set(entry.column, [])
    index.get(entry.column).push(entry)
  }
  return index
}
