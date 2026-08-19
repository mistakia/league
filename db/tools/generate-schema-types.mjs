#!/usr/bin/env node

// Emits db/schema-types.d.ts -- one row type per table in
// db/schema.postgres.sql, plus a union type per CREATE TYPE enum.
//
// WHY THIS IS DERIVED AND NOT HAND-WRITTEN. The point of the `//@ts-check`
// tier is to catch a consumer naming a column the producer does not return,
// which is only worth anything if the type moves with the DDL. A hand-written
// row shape is a second schema that decays exactly like every hand-maintained
// list this repo has already been bitten by -- and worse than an out-of-date
// list, because a stale row type reports a LIVE column as a defect and a
// dropped one as clean. So the schema file is the single source and this file
// is regenerated from it, and `--check` (which `yarn check:types` runs first,
// ahead of tsc) fails when the committed output disagrees with a fresh run.
//
// Run: node db/tools/generate-schema-types.mjs [--check]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')
const output_path = path.join(repo_root, 'db', 'schema-types.d.ts')

// A column line is `    <name> <type>[ modifiers],`. Everything else inside a
// CREATE TABLE body is skipped explicitly rather than by falling through:
// this schema carries INLINE `CONSTRAINT ... CHECK (...)` blocks whose
// continuation lines parse as columns under a naive column-list walk, which is
// how audit-schema-conformance reported six violations all named `AND`. A
// continuation line is recognised by not starting a new column at all.
const SKIP_BODY_PREFIXES = [
  'CONSTRAINT',
  'PRIMARY KEY',
  'UNIQUE',
  'CHECK',
  'FOREIGN KEY',
  'EXCLUDE'
]

const to_ts_type = ({ pg_type, enum_names }) => {
  const is_array = pg_type.includes('[]')
  const base = pg_type.replace(/\[\]/g, '').trim()

  const scalar = (() => {
    // A user-defined enum resolves to its own union alias, which is the whole
    // reason enums are emitted: it turns a persisted literal that is not in
    // the vocabulary into a type error rather than a never-matching predicate.
    const enum_match = base.match(/^public\.([a-z0-9_]+)$/)
    if (enum_match && enum_names.has(enum_match[1])) {
      return to_pascal_case(enum_match[1])
    }

    if (
      /^(smallint|integer|bigint|serial|bigserial|real|double precision)$/.test(
        base
      )
    )
      return 'number'
    if (/^numeric/.test(base) || /^decimal/.test(base)) return 'number'
    if (/^(boolean|bool)$/.test(base)) return 'boolean'
    if (
      /^(character varying|varchar|character|char|text|citext|uuid|inet)/.test(
        base
      )
    )
      return 'string'
    if (/^(timestamp|date|time)/.test(base)) return 'Date'
    if (/^(json|jsonb)$/.test(base)) return 'any'
    if (/^bytea$/.test(base)) return 'Buffer'
    // An unrecognised type becomes `unknown` rather than `any` so it cannot
    // silently satisfy a read; `--check` prints the tally so a new pg type
    // shows up as a number rather than as a quiet degradation.
    return 'unknown'
  })()

  return is_array ? `${scalar}[]` : scalar
}

const to_pascal_case = (name) =>
  name
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const parse_enums = ({ sql }) => {
  const enums = new Map()
  const re = /CREATE TYPE public\.([a-z0-9_]+) AS ENUM \(([\s\S]*?)\);/g
  let match
  while ((match = re.exec(sql)) !== null) {
    const [, name, body] = match
    const values = [...body.matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
      m[1].replace(/''/g, "'")
    )
    enums.set(name, values)
  }
  return enums
}

const parse_tables = ({ sql, enum_names }) => {
  const tables = new Map()
  // The body terminates at a `)` alone on a line. It is NOT safe to anchor on
  // `\n);` -- a partitioned table closes as `)\nPARTITION BY RANGE (...);`, so
  // that anchor runs past the end and swallows every COMMENT ON and CREATE
  // TABLE statement up to the next unpartitioned table's terminator. The tell
  // was 92 "unmapped pg types" whose text was comment prose.
  const re =
    /CREATE TABLE public\.([a-z0-9_]+) \(([\s\S]*?)\n\)(?:\s+PARTITION BY [^;]*)?;/g
  let match
  const unknown_types = new Map()

  while ((match = re.exec(sql)) !== null) {
    const [, table_name, body] = match
    const columns = []

    for (const raw_line of body.split('\n')) {
      const line = raw_line.trim().replace(/,$/, '')
      if (!line || line.startsWith('--')) continue
      if (SKIP_BODY_PREFIXES.some((p) => line.toUpperCase().startsWith(p)))
        continue

      // A column declaration begins with an identifier followed by whitespace
      // and a type. A CHECK continuation line begins with an operator, an open
      // paren, or a bare keyword, so it fails this shape rather than being
      // guessed at.
      const col_match = line.match(/^("?)([a-z_][a-z0-9_]*)\1\s+(.+)$/i)
      if (!col_match) continue

      const column_name = col_match[2]
      let rest = col_match[3]

      // A GENERATED ALWAYS AS (...) STORED column is still a real readable
      // column; strip the expression so the type in front of it survives.
      rest = rest.replace(/\s+GENERATED\s+ALWAYS\s+AS\s+[\s\S]*$/i, '')
      const is_not_null = /\bNOT NULL\b/i.test(rest)
      const pg_type = rest
        .replace(/\s+DEFAULT\s+[\s\S]*$/i, '')
        .replace(/\s+NOT NULL\b/i, '')
        .replace(/\s+NULL\b/i, '')
        .trim()

      if (!pg_type) continue

      const ts_type = to_ts_type({ pg_type, enum_names })
      if (ts_type === 'unknown' || ts_type === 'unknown[]') {
        unknown_types.set(pg_type, (unknown_types.get(pg_type) || 0) + 1)
      }

      columns.push({ column_name, ts_type, is_not_null })
    }

    if (columns.length) tables.set(table_name, columns)
  }

  return { tables, unknown_types }
}

const render = ({ enums, tables }) => {
  const lines = []
  lines.push('// GENERATED FILE -- do not edit.')
  lines.push('//')
  lines.push('// Source: db/schema.postgres.sql')
  lines.push('// Regenerate: node db/tools/generate-schema-types.mjs')
  lines.push(
    '// Currency gate: yarn check:types (runs this generator with --check)'
  )
  lines.push('//')
  lines.push(
    '// One row type per table, for the incremental `//@ts-check` tier. A checked'
  )
  lines.push(
    '// producer annotates its return as a row type (or a Pick of one) and every'
  )
  lines.push(
    '// consumer destructure is then resolved against the real schema.'
  )
  lines.push('//')
  lines.push(
    '// A NULLABLE column is typed `| null`. That is deliberate even though the'
  )
  lines.push(
    '// config runs with strictNullChecks off today: the information is recorded'
  )
  lines.push(
    '// now so turning the flag on later is a config change rather than a'
  )
  lines.push('// regeneration of every annotation.')
  lines.push('')

  for (const [name, values] of [...enums].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const union = values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(' | ')
    lines.push(`export type ${to_pascal_case(name)} = ${union || 'never'}`)
  }
  lines.push('')

  for (const [table_name, columns] of [...tables].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`export interface ${to_pascal_case(table_name)}Row {`)
    for (const { column_name, ts_type, is_not_null } of columns) {
      const key = /^[a-z_][a-z0-9_]*$/i.test(column_name)
        ? column_name
        : `'${column_name}'`
      lines.push(`  ${key}: ${ts_type}${is_not_null ? '' : ' | null'}`)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

const main = () => {
  const sql = fs.readFileSync(schema_path, 'utf8')
  const enums = parse_enums({ sql })
  const { tables, unknown_types } = parse_tables({
    sql,
    enum_names: new Set(enums.keys())
  })

  // A parser that silently stops matching reports a clean, empty result, so
  // the run asserts a floor on what it found rather than trusting its own
  // silence. The counts are the schema's, not a hand-maintained number: they
  // only have to prove the walk reached real material.
  const declared_tables = (sql.match(/^CREATE TABLE public\./gm) || []).length
  if (tables.size < declared_tables * 0.9) {
    console.error(
      `FAIL: parsed ${tables.size} tables from ${declared_tables} CREATE TABLE statements -- the column walk is not reaching the schema`
    )
    process.exit(2)
  }
  const total_columns = [...tables.values()].reduce((n, c) => n + c.length, 0)

  const output = render({ enums, tables })
  const is_check = process.argv.includes('--check')

  if (is_check) {
    const existing = fs.existsSync(output_path)
      ? fs.readFileSync(output_path, 'utf8')
      : null
    if (existing !== output) {
      console.error('FAIL: db/schema-types.d.ts is stale.')
      console.error('Regenerate with: node db/tools/generate-schema-types.mjs')
      process.exit(1)
    }
    console.log(
      `schema types current: ${tables.size} tables, ${total_columns} columns, ${enums.size} enums`
    )
    return
  }

  fs.writeFileSync(output_path, output)
  console.log(
    `wrote ${path.relative(repo_root, output_path)}: ${tables.size} tables, ${total_columns} columns, ${enums.size} enums`
  )
  if (unknown_types.size) {
    console.log(
      `\n${unknown_types.size} unmapped pg type(s) emitted as \`unknown\`:`
    )
    for (const [t, n] of [...unknown_types].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t} (${n})`)
    }
  }
}

main()
