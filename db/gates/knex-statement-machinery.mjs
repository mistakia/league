// Knex statement extraction and alias binding, shared by the gates that need to
// resolve a column reference through the statement it sits in.
//
// Extracted from check-knex-column-resolution.mjs, which remains its primary
// consumer and whose header documents WHY each piece is shaped the way it is --
// the paren-balance statement walk (a regex tail truncates on a line of `})`),
// the alias-REPLACES-table-name rule, and the shadowed-prefix exclusion. This
// file is a move, not a rewrite: the second consumer is
// scan-stranded-vocabulary-literals.mjs, which asks a different question about
// the same bindings, and reimplementing alias binding for it would have given
// the two scanners independent bugs.

import fs from 'fs'
import path from 'path'

// The identifiers that OPEN a knex statement. `db` and `trx` are what this repo
// writes; `knex` is accepted because it is the library's own convention and
// would otherwise be a silent hole if someone used it.
export const BUILDER_IDENTIFIERS = ['db', 'trx', 'knex']

// Every method that BINDS a table name to a scope. `.from` is here rather than
// only at the head because a statement may open on a builder and take its
// relation later.
export const TABLE_BINDING_METHODS = [
  'from',
  'into',
  'join',
  'leftJoin',
  'leftOuterJoin',
  'rightJoin',
  'rightOuterJoin',
  'innerJoin',
  'fullOuterJoin',
  'crossJoin'
]

// A statement long enough to contain its own projection and predicates.
export const STATEMENT_SCAN_LIMIT = 8000

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

export const parse_schema = (sql) => {
  const tables = new Map()
  const create_re =
    /CREATE TABLE (?:public\.)?"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\);/g
  let match
  while ((match = create_re.exec(sql)) !== null) {
    const [, table_name, body] = match
    const columns = new Set()
    for (const raw_line of body.split('\n')) {
      const line = raw_line.trim()
      if (!line || line.startsWith('CONSTRAINT') || line.startsWith('PRIMARY'))
        continue
      const column_match = line.match(/^"?([a-z_0-9]+)"?\s+/i)
      if (column_match) columns.add(column_match[1])
    }
    tables.set(table_name, columns)
  }
  return tables
}

// A partitioned child repeats every column of its parent. Binding to one is
// correct but reporting under its name is noise; resolve to the parent.
export const partition_parent = (name, tables) => {
  const stripped = name
    .replace(/_year_\d{4}$/, '')
    .replace(/_y\d{4}$/, '')
    .replace(/_default$/, '')
  return stripped !== name && tables.has(stripped) ? stripped : name
}

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

export const walk_files = (roots, extensions, repo_root) => {
  const files = []
  const visit = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full_path = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full_path)
      else if (extensions.some((ext) => entry.name.endsWith(ext)))
        files.push(full_path)
    }
  }
  for (const root of roots) visit(path.join(repo_root, root))
  return files.sort()
}

// ---------------------------------------------------------------------------
// statement extraction
// ---------------------------------------------------------------------------

export const end_of_call = (source, open_index, limit) => {
  let depth = 0
  for (let index = open_index; index < limit; index++) {
    const character = source[index]
    if (character === '(') depth += 1
    else if (character === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return null
}

// Consume the opening call, then every chained `.method(...)` by PAREN BALANCE.
export const statement_at = (source, start_index) => {
  const limit = Math.min(source.length, start_index + STATEMENT_SCAN_LIMIT)
  const open_index = source.indexOf('(', start_index)
  if (open_index === -1) return source.slice(start_index, limit)
  let end = end_of_call(source, open_index, limit)
  if (end === null) return source.slice(start_index, limit)
  for (;;) {
    const chained = source.slice(end, limit).match(/^\s*\.[a-zA-Z_0-9]+\(/)
    if (!chained) break
    const next_end = end_of_call(source, end + chained[0].length - 1, limit)
    if (next_end === null) break
    end = next_end
  }
  return source.slice(start_index, end)
}

const statement_opener_re = new RegExp(
  `\\b(?:${BUILDER_IDENTIFIERS.join('|')})\\(\\s*['"\`][a-z_0-9]+(?:\\s+as\\s+[a-z_0-9]+)?['"\`]\\s*\\)`,
  'g'
)

export const collect_statements = (source) => {
  const statements = []
  statement_opener_re.lastIndex = 0
  let match
  while ((match = statement_opener_re.exec(source)) !== null) {
    const text = statement_at(source, match.index)
    statements.push({
      text,
      offset: match.index,
      line: source.slice(0, match.index).split('\n').length
    })
    // Do not re-enter a statement we have already consumed.
    statement_opener_re.lastIndex = match.index + text.length
  }
  return statements
}

// ---------------------------------------------------------------------------
// alias environment
// ---------------------------------------------------------------------------

const TABLE_REFERENCE_RE = /['"`]([a-z_0-9]+)(?:\s+as\s+([a-z_0-9]+))?['"`]/i

// Prefixes bound to something other than a physical table, which legitimately
// carry columns the schema does not have.
export const collect_shadowed_prefixes = (statement) => {
  const shadowed = new Set()
  const alias_re = /\.as\(\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*\)/g
  let match
  while ((match = alias_re.exec(statement)) !== null) shadowed.add(match[1])
  const with_re = /\.with(?:Recursive)?\(\s*['"`]([a-z_][a-z_0-9]*)['"`]/g
  while ((match = with_re.exec(statement)) !== null) shadowed.add(match[1])
  return shadowed
}

/**
 * The alias environment a statement declares for itself.
 *
 * Returns { bindings, tables_in_scope, shadowed }. `bindings` maps every prefix
 * a column reference may legally use to its physical table; `tables_in_scope`
 * is the distinct table set, whose SIZE decides whether an unqualified
 * reference is resolvable.
 *
 * Aliasing in SQL REPLACES the table name, so an alias binds only the alias.
 */
export const build_alias_environment = (statement, tables) => {
  const bindings = new Map()
  const tables_in_scope = new Set()
  const shadowed = collect_shadowed_prefixes(statement)

  const bind = (raw_table, alias) => {
    const table = partition_parent(raw_table, tables)
    if (!tables.has(table)) return false
    tables_in_scope.add(table)
    bindings.set(alias || raw_table, table)
    return true
  }

  const head = statement.match(
    new RegExp(
      `^(?:${BUILDER_IDENTIFIERS.join('|')})\\(\\s*['"\`]([a-z_0-9]+)(?:\\s+as\\s+([a-z_0-9]+))?['"\`]`,
      'i'
    )
  )
  if (head) bind(head[1], head[2])

  const binder_re = new RegExp(
    `\\.(?:${TABLE_BINDING_METHODS.join('|')})\\(`,
    'g'
  )
  let match
  while ((match = binder_re.exec(statement)) !== null) {
    const rest = statement.slice(match.index + match[0].length)
    const reference = rest.match(
      new RegExp(`^\\s*${TABLE_REFERENCE_RE.source}`)
    )
    if (!reference) continue
    bind(reference[1], reference[2])
  }

  for (const prefix of shadowed) bindings.delete(prefix)
  return { bindings, tables_in_scope, shadowed }
}

// ---------------------------------------------------------------------------
// argument walking
// ---------------------------------------------------------------------------

// Split an argument list on its TOP-LEVEL commas. Quote-blind, so a comma
// inside a string literal would split wrongly -- harmless for the predicate
// family, which reads only segment 0, and a column name never contains one.
export const split_top_level = (body) => {
  const segments = []
  let depth = 0
  let start = 0
  for (let index = 0; index < body.length; index++) {
    const character = body[index]
    if (character === '(' || character === '[' || character === '{') depth += 1
    else if (character === ')' || character === ']' || character === '}')
      depth -= 1
    else if (character === ',' && depth === 0) {
      segments.push({ text: body.slice(start, index), offset: start })
      start = index + 1
    }
  }
  segments.push({ text: body.slice(start), offset: start })
  return segments
}

// `.onConflict(['pid', 'year'])` and `.onConflict('pid')` are the same list.
export const unwrap_array_argument = (body) => {
  const trimmed = body.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
    return { text: body, offset: 0 }
  const open_index = body.indexOf('[')
  return {
    text: body.slice(open_index + 1, body.lastIndexOf(']')),
    offset: open_index + 1
  }
}

export const each_call = function* (statement, methods) {
  const call_re = /\.([a-zA-Z_0-9]+)\(/g
  let match
  while ((match = call_re.exec(statement)) !== null) {
    if (!methods.has(match[1])) continue
    const open_index = match.index + match[0].length - 1
    const end = end_of_call(statement, open_index, statement.length)
    if (end === null) continue
    yield {
      method: match[1],
      body: statement.slice(open_index + 1, end - 1),
      body_offset: open_index + 1
    }
    // Do not re-enter a call we have consumed.
    call_re.lastIndex = end
  }
}
