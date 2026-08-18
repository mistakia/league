// Finds literals compared against a CHECK-constrained column that the CHECK
// forbids -- a predicate that parses, EXPLAINs clean, and matches NOTHING.
//
// THE CLASS, and why no existing gate sees it.
//
// `check-league-schema-consumers`, `check-knex-column-resolution`,
// `check-renamed-column-consumers` and `check-rename-alias-residue` all resolve
// column NAMES. Here the name resolves; the bound VALUE is wrong. That is the
// same names-not-types distinction `check-knex-column-resolution`'s own header
// records for retypes -- and its conclusion there was that no static check can
// see the class, because a bound value's validity is a runtime property.
//
// For a column carrying a value-vocabulary CHECK that conclusion does not hold.
// The constraint enumerates the permitted set, so a literal outside it can
// never match, and the schema PROVES it. That is what makes this statically
// decidable where the general retype case is not, and it is the whole reason
// this tool exists rather than a widening of an existing gate's reach.
//
// EXPLAIN cannot substitute for it. The live instance
// (text/nfl/query/defense/elite-defender-callout.sql, fixed in user-base
// a7d7f7845) tested `pff_player_seasonlogs.player_position` against PFF's own
// 'ED' and 'DI' codes: four CASE arms were dead, the file EXPLAINed clean, and
// a human caught it only because the codes looked foreign.
//
// TWO SIGNALS, reported separately and never conflated:
//
//   CAN NEVER MATCH -- the literal is outside the CHECK vocabulary. A defect;
//                      the constraint is the proof.
//   ZERO ROWS       -- the literal is IN the vocabulary but no production row
//                      carries it. Possibly dead, possibly legitimately empty.
//                      NT, DL and DE sit at zero on
//                      pff_player_seasonlogs.player_position today and their
//                      branches are correct. Requires --occupancy, never fails
//                      a run, and is advisory only.
//
// THE JUDGEMENT THIS NEEDS. A vendor mapping legitimately names the vendor's
// vocabulary on one side -- libs-server/sportradar/, the PFF and NGS importers,
// private/scripts/ all map external codes to league ones. A literal compared
// against a league COLUMN is a finding; a KEY in a vendor-to-league map is not.
// Getting that wrong in the noisy direction produces a gate nobody runs, so the
// scanner reports only literals it can bind to a constrained column through a
// resolved alias environment -- a bare map key binds to nothing and is silent
// by construction.
//
// Usage:
//   node db/gates/check-stranded-vocabulary-literals.mjs --sql-root <dir>
//   node db/gates/check-stranded-vocabulary-literals.mjs --json
//   node db/gates/check-stranded-vocabulary-literals.mjs --occupancy <file.json>

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  build_alias_environment,
  collect_statements,
  each_call,
  parse_schema,
  split_top_level,
  walk_files
} from './knex-statement-machinery.mjs'
import {
  vocabulary_constrained_columns,
  vocabulary_index
} from '../tools/vocabulary-constrained-columns.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
// The SQL corpus lives in user-base, which is the grandparent of the checkout's
// parent directory (`repository/active/<checkout>` or
// `repository/active/league-worktrees/<worktree>`), so it is resolved by walking
// up until a `text/nfl/query` exists rather than by a fixed hop count -- a
// worktree sits one level deeper than the main checkout.
const find_user_base_root = () => {
  let dir = repo_root
  for (let hop = 0; hop < 6; hop++) {
    dir = path.join(dir, '..')
    if (fs.existsSync(path.join(dir, 'text', 'nfl', 'query'))) return dir
  }
  return path.join(repo_root, '..', '..')
}
const user_base_root = find_user_base_root()

// ---------------------------------------------------------------------------
// SQL text handling
// ---------------------------------------------------------------------------

// Strip comments before any structural parse. A `--` inside a string literal is
// not a comment, so string literals are walked rather than regexed away; the
// `check-league-schema-consumers` controls record a case where a mutation
// landed inside a comment and reported a working gate as green.
export function strip_comments(sql) {
  let out = ''
  let index = 0
  while (index < sql.length) {
    const ch = sql[index]
    if (ch === "'") {
      let end = index + 1
      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") {
          end += 2
          continue
        }
        if (sql[end] === "'") break
        end += 1
      }
      out += sql.slice(index, end + 1)
      index = end + 1
      continue
    }
    if (ch === '-' && sql[index + 1] === '-') {
      const newline = sql.indexOf('\n', index)
      const stop = newline === -1 ? sql.length : newline
      out += ' '.repeat(stop - index)
      index = stop
      continue
    }
    if (ch === '/' && sql[index + 1] === '*') {
      const close = sql.indexOf('*/', index + 2)
      const stop = close === -1 ? sql.length : close + 2
      // Preserve newlines so line numbers survive.
      out += sql.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
      continue
    }
    out += ch
    index += 1
  }
  return out
}

const line_of = (sql, offset) => sql.slice(0, offset).split('\n').length

// ---------------------------------------------------------------------------
// relation binding
// ---------------------------------------------------------------------------

// `FROM <relation> [AS] <alias>` and every join form. `AS` is optional in SQL,
// so a bare second identifier is an alias -- but a keyword sitting where an
// alias would be (`FROM x WHERE`, `FROM x JOIN`) is not one.
const NOT_AN_ALIAS = new Set([
  'where',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'outer',
  'on',
  'using',
  'group',
  'order',
  'having',
  'limit',
  'offset',
  'union',
  'intersect',
  'except',
  'window',
  'returning',
  'set',
  'values',
  'select',
  'lateral',
  'and',
  'or',
  'as',
  'with',
  'fetch',
  'for'
])

const RELATION_RE =
  /\b(?:from|join)\s+(?:only\s+)?([a-z_][a-z_0-9]*)(?:\s+(?:as\s+)?([a-z_][a-z_0-9]*))?/gi

// Every relation reference in a statement fragment, as { relation, alias }.
export function parse_relation_bindings(fragment) {
  const bindings = []
  let match
  RELATION_RE.lastIndex = 0
  while ((match = RELATION_RE.exec(fragment))) {
    const relation = match[1]
    let alias = match[2]
    if (alias && NOT_AN_ALIAS.has(alias.toLowerCase())) alias = undefined
    bindings.push({ relation, alias: alias || relation })
  }
  return bindings
}

// ---------------------------------------------------------------------------
// CTE extraction
// ---------------------------------------------------------------------------

// Split a `WITH` list into named bodies. Depth-counted rather than regexed: a
// CTE body contains parentheses of its own, and a regex tail terminates early
// on the first `)` -- the truncation failure `check-renamed-column-consumers`
// records for statement extraction.
export function parse_ctes(sql) {
  const ctes = []
  const with_match = /\bwith\s+(recursive\s+)?/i.exec(sql)
  if (!with_match) return ctes

  let index = with_match.index + with_match[0].length
  for (;;) {
    const header =
      /^\s*([a-z_][a-z_0-9]*)\s*(?:\([^)]*\)\s*)?as\s*(?:materialized\s+|not\s+materialized\s+)?\(/i.exec(
        sql.slice(index)
      )
    if (!header) break
    const open = index + header[0].length - 1
    let depth = 0
    let close = -1
    for (let i = open; i < sql.length; i++) {
      if (sql[i] === '(') depth++
      else if (sql[i] === ')') {
        depth--
        if (depth === 0) {
          close = i
          break
        }
      }
    }
    if (close === -1) break
    ctes.push({
      name: header[1],
      body: sql.slice(open + 1, close),
      start: open + 1
    })
    const after = /^\s*,/.exec(sql.slice(close + 1))
    if (!after) break
    index = close + 1 + after[0].length
  }
  return ctes
}

// The SELECT list of a fragment -- the text between its top-level SELECT and
// its FROM, at paren depth 0 so a subquery's own SELECT is not mistaken for it.
function select_list_of(fragment) {
  const select = /\bselect\b(\s+distinct(\s+on\s*\([^)]*\))?)?/i.exec(fragment)
  if (!select) return null
  const start = select.index + select[0].length
  let depth = 0
  for (let i = start; i < fragment.length; i++) {
    const ch = fragment[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (
      depth === 0 &&
      /\bfrom\b/i.test(fragment.slice(i, i + 4)) &&
      /\W/.test(fragment[i - 1] || ' ')
    ) {
      return fragment.slice(start, i)
    }
  }
  return fragment.slice(start)
}

const split_select_items = (body) => {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current)
  return parts
}

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

// A scope maps each visible alias to a column resolver. A physical relation
// resolves any column to itself; a CTE resolves only the columns it projects,
// through the provenance already computed for it.
//
// This propagation is what reaches the live instance: `pff_player_seasonlogs
// pff` -> defender_grades projects `pff.player_position` -> classified_defenders
// selects `dg.*` -> ranked_defenders selects `cd.*` -> the final SELECT's
// `rd.player_position`. Four hops, and a scanner that stopped at the physical
// FROM would see none of them.
function build_scope(fragment, cte_provenance) {
  const scope = new Map()
  for (const { relation, alias } of parse_relation_bindings(fragment)) {
    if (cte_provenance.has(relation)) {
      scope.set(alias, { kind: 'cte', columns: cte_provenance.get(relation) })
    } else {
      scope.set(alias, { kind: 'table', table: relation })
    }
  }
  return scope
}

// Resolve `<qualifier>.<column>` (or a bare column) to a physical
// (table, column), or null when the scope cannot decide.
function resolve_reference(scope, qualifier, column) {
  if (qualifier) {
    const bound = scope.get(qualifier)
    if (!bound) return null
    if (bound.kind === 'table') return { table: bound.table, column }
    return bound.columns.get(column) || null
  }
  // Unqualified: resolvable only when exactly one relation is in scope, for the
  // reason check-knex-column-resolution states -- with a join present the name
  // is genuinely ambiguous and guessing a table invents findings.
  if (scope.size !== 1) return null
  const [only] = scope.values()
  if (only.kind === 'table') return { table: only.table, column }
  return only.columns.get(column) || null
}

// What each CTE projects, as column name -> physical (table, column).
// Iterated to a fixed point so a CTE selecting from another CTE resolves.
function compute_cte_provenance(ctes) {
  const provenance = new Map()
  for (const cte of ctes) provenance.set(cte.name, new Map())

  for (let pass = 0; pass < ctes.length + 1; pass++) {
    let changed = false
    for (const cte of ctes) {
      const scope = build_scope(cte.body, provenance)
      const list = select_list_of(cte.body)
      if (!list) continue
      const columns = provenance.get(cte.name)

      for (const raw of split_select_items(list)) {
        const item = raw.trim()
        if (!item) continue

        // `alias.*` / `*` -- inherit every column the source resolves.
        const star = /^([a-z_][a-z_0-9]*\.)?\*$/i.exec(item)
        if (star) {
          const qualifier = star[1] ? star[1].slice(0, -1) : null
          const sources = qualifier
            ? [scope.get(qualifier)].filter(Boolean)
            : [...scope.values()]
          for (const source of sources) {
            if (source.kind === 'cte') {
              for (const [name, origin] of source.columns) {
                if (!columns.has(name)) {
                  columns.set(name, origin)
                  changed = true
                }
              }
            }
            // A physical `t.*` cannot be enumerated without the full schema
            // column list; the constrained columns are what matter, so they are
            // added by name below when the CTE is read.
            if (source.kind === 'table') {
              const key = `*${source.table}`
              if (!columns.has(key)) {
                columns.set(key, { table: source.table, star: true })
                changed = true
              }
            }
          }
          continue
        }

        // `<expr> AS <name>` or a bare `<qualifier>.<column>`.
        const aliased = /\s+as\s+([a-z_][a-z_0-9]*)\s*$/i.exec(item)
        const output_name = aliased ? aliased[1] : null
        const expression = aliased ? item.slice(0, aliased.index) : item

        const plain =
          /^\s*(?:([a-z_][a-z_0-9]*)\.)?([a-z_][a-z_0-9]*)\s*$/i.exec(
            expression
          )
        if (!plain) continue
        const origin = resolve_reference(scope, plain[1], plain[2])
        if (!origin) continue
        const name = output_name || plain[2]
        const existing = columns.get(name)
        if (
          !existing ||
          existing.table !== origin.table ||
          existing.column !== origin.column
        ) {
          columns.set(name, origin)
          changed = true
        }
      }
    }
    if (!changed) break
  }
  return provenance
}

// A CTE that selected a physical `t.*` carries the star marker; resolving a
// name through it means asking whether that physical table has the column.
function resolve_through_star(bound_columns, column, vocabulary) {
  for (const [key, origin] of bound_columns) {
    if (!key.startsWith('*')) continue
    if (vocabulary.has(`${origin.table}.${column}`))
      return { table: origin.table, column }
  }
  return null
}

// ---------------------------------------------------------------------------
// predicate scanning
// ---------------------------------------------------------------------------

// `<ref> = 'X'`, `<ref> <> 'X'`, `<ref> != 'X'`
const COMPARISON_RE =
  /(?:([a-z_][a-z_0-9]*)\.)?([a-z_][a-z_0-9]*)\s*(=|<>|!=)\s*'((?:[^']|'')*)'/gi

// `<ref> [NOT] IN ('A', 'B')`
const IN_RE =
  /(?:([a-z_][a-z_0-9]*)\.)?([a-z_][a-z_0-9]*)\s+(?:not\s+)?in\s*\(([^)]*)\)/gi

const STRING_LITERAL_RE = /'((?:[^']|'')*)'/g

function each_predicate_site(sql) {
  const sites = []
  let match

  COMPARISON_RE.lastIndex = 0
  while ((match = COMPARISON_RE.exec(sql))) {
    sites.push({
      qualifier: match[1],
      column: match[2],
      literals: [match[4].replace(/''/g, "'")],
      offset: match.index,
      form: `${match[3]} '${match[4]}'`
    })
  }

  IN_RE.lastIndex = 0
  while ((match = IN_RE.exec(sql))) {
    const body = match[3]
    // An IN list holding anything other than string literals is a subquery or
    // an expression; binding a literal out of it would be guessing.
    if (!/^[\s',a-z_0-9]*$/i.test(body)) continue
    const literals = []
    STRING_LITERAL_RE.lastIndex = 0
    let literal
    while ((literal = STRING_LITERAL_RE.exec(body)))
      literals.push(literal[1].replace(/''/g, "'"))
    if (!literals.length) continue
    sites.push({
      qualifier: match[1],
      column: match[2],
      literals,
      offset: match.index,
      form: `IN (${literals.map((v) => `'${v}'`).join(', ')})`
    })
  }

  return sites.sort((a, b) => a.offset - b.offset)
}

// ---------------------------------------------------------------------------
// file scanning
// ---------------------------------------------------------------------------

export function scan_sql_text({ sql, relative_path, vocabulary, occupancy }) {
  const findings = []
  const zero_rows = []
  const stripped = strip_comments(sql)
  const ctes = parse_ctes(stripped)
  const provenance = compute_cte_provenance(ctes)

  // Scope for the outer statement: everything after the CTE list.
  const last_cte = ctes.length ? ctes[ctes.length - 1] : null
  const outer_start = last_cte
    ? stripped.indexOf(')', last_cte.start + last_cte.body.length)
    : 0
  const outer = stripped.slice(Math.max(outer_start, 0))

  const regions = [
    {
      text: outer,
      base: Math.max(outer_start, 0),
      scope: build_scope(outer, provenance)
    },
    ...ctes.map((cte) => ({
      text: cte.body,
      base: cte.start,
      scope: build_scope(cte.body, provenance)
    }))
  ]

  for (const region of regions) {
    for (const site of each_predicate_site(region.text)) {
      let origin = resolve_reference(region.scope, site.qualifier, site.column)

      if (!origin && site.qualifier) {
        const bound = region.scope.get(site.qualifier)
        if (bound && bound.kind === 'cte')
          origin = resolve_through_star(bound.columns, site.column, vocabulary)
      }
      if (!origin) continue

      const key = `${origin.table}.${origin.column}`
      const constrained = vocabulary.get(key)
      if (!constrained) continue

      const permitted = new Set(constrained.values)
      const line = line_of(sql, region.base + site.offset)

      for (const literal of site.literals) {
        // `'${position}'` is a template PARAMETER, not a literal -- the value is
        // supplied at render time and the CHECK says nothing about it. Two of
        // these sit in text/nfl/query today and reporting them is the noisy
        // direction that produces a gate nobody runs.
        if (literal.includes('${')) continue
        if (!permitted.has(literal)) {
          findings.push({
            file: relative_path,
            line,
            column: key,
            literal,
            form: site.form,
            constraint: constrained.constraint,
            permitted: constrained.values
          })
          continue
        }
        if (occupancy) {
          const occupied = occupancy[key]
          if (occupied && !occupied.includes(literal)) {
            zero_rows.push({
              file: relative_path,
              line,
              column: key,
              literal,
              form: site.form
            })
          }
        }
      }
    }
  }

  return { findings, zero_rows }
}

// ---------------------------------------------------------------------------
// knex predicate scanning
// ---------------------------------------------------------------------------

// Predicate methods whose first argument is a COLUMN and whose second is a
// VALUE. The asymmetry matters: reading past argument 0 for this family would
// resolve DATA as column names, which check-knex-column-resolution's header
// records as a live hazard on a corpus where transaction and season types are
// all lowercase strings.
const VALUE_PREDICATE_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'andWhereNot',
  'orWhereNot',
  'having',
  'andHaving',
  'orHaving',
  'on',
  'andOn',
  'orOn'
])

const LIST_PREDICATE_METHODS = new Set([
  'whereIn',
  'andWhereIn',
  'orWhereIn',
  'whereNotIn',
  'andWhereNotIn',
  'orWhereNotIn'
])

const OBJECT_PREDICATE_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'on',
  'andOn',
  'orOn'
])

const QUOTED_STRING_RE = /^\s*['"`]((?:[^'"`\\]|\\.)*)['"`]\s*$/
const COLUMN_ARGUMENT_RE =
  /^\s*['"`](?:([a-z_][a-z_0-9]*)\.)?([a-z_][a-z_0-9]*)['"`]\s*$/i

// Resolve a knex column reference through the statement's alias environment,
// with the SAME single-table restriction check-knex-column-resolution uses for
// an unqualified name: with a join present the name is genuinely ambiguous and
// guessing a table invents findings.
function resolve_knex_reference(environment, qualifier, column) {
  if (qualifier) {
    const table = environment.bindings.get(qualifier)
    return table ? { table, column } : null
  }
  if (environment.tables_in_scope.size !== 1) return null
  const [table] = environment.tables_in_scope
  return { table, column }
}

function scan_knex_source({
  source,
  relative_path,
  tables,
  vocabulary,
  occupancy
}) {
  const findings = []
  const zero_rows = []

  for (const statement of collect_statements(source)) {
    const environment = build_alias_environment(statement.text, tables)
    if (!environment.tables_in_scope.size) continue

    const sites = []

    // `.where('col', 'X')` / `.where('t.col', '=', 'X')`
    for (const call of each_call(statement.text, VALUE_PREDICATE_METHODS)) {
      const segments = split_top_level(call.body)
      if (segments.length < 2) continue
      const reference = COLUMN_ARGUMENT_RE.exec(segments[0].text)
      if (!reference) continue
      // A three-argument form puts the operator in the middle.
      const value_segment = segments.length >= 3 ? segments[2] : segments[1]
      const literal = QUOTED_STRING_RE.exec(value_segment.text)
      if (!literal) continue
      sites.push({
        qualifier: reference[1],
        column: reference[2],
        literals: [literal[1]],
        form: `.${call.method}('${reference[0].trim().replace(/['"`]/g, '')}', '${literal[1]}')`,
        offset: call.body_offset
      })
    }

    // `.whereIn('col', ['X', 'Y'])`
    for (const call of each_call(statement.text, LIST_PREDICATE_METHODS)) {
      const segments = split_top_level(call.body)
      if (segments.length < 2) continue
      const reference = COLUMN_ARGUMENT_RE.exec(segments[0].text)
      if (!reference) continue
      const list = segments[1].text.trim()
      if (!list.startsWith('[') || !list.endsWith(']')) continue
      const literals = []
      let all_literal = true
      for (const item of split_top_level(list.slice(1, -1))) {
        if (!item.text.trim()) continue
        const literal = QUOTED_STRING_RE.exec(item.text)
        if (!literal) {
          all_literal = false
          break
        }
        literals.push(literal[1])
      }
      if (!all_literal || !literals.length) continue
      sites.push({
        qualifier: reference[1],
        column: reference[2],
        literals,
        form: `.${call.method}('${reference[2]}', [${literals.map((v) => `'${v}'`).join(', ')}])`,
        offset: call.body_offset
      })
    }

    // `.where({ col: 'X' })` -- the object-shorthand form. Only an explicit
    // `key: 'literal'` pair binds a value; `{ lid, year }` shorthand names a
    // variable whose value is unknowable statically.
    for (const call of each_call(statement.text, OBJECT_PREDICATE_METHODS)) {
      const body = call.body.trim()
      if (!body.startsWith('{') || !body.endsWith('}')) continue
      for (const pair of split_top_level(body.slice(1, -1))) {
        const match = /^\s*['"`]?([a-z_][a-z_0-9]*)['"`]?\s*:\s*(.+)$/is.exec(
          pair.text
        )
        if (!match) continue
        const literal = QUOTED_STRING_RE.exec(match[2])
        if (!literal) continue
        sites.push({
          qualifier: null,
          column: match[1],
          literals: [literal[1]],
          form: `.${call.method}({ ${match[1]}: '${literal[1]}' })`,
          offset: call.body_offset
        })
      }
    }

    for (const site of sites) {
      const origin = resolve_knex_reference(
        environment,
        site.qualifier,
        site.column
      )
      if (!origin) continue
      const key = `${origin.table}.${origin.column}`
      const constrained = vocabulary.get(key)
      if (!constrained) continue

      const permitted = new Set(constrained.values)
      const line =
        statement.line +
        statement.text.slice(0, site.offset).split('\n').length -
        1

      for (const literal of site.literals) {
        if (literal.includes('${')) continue
        if (!permitted.has(literal)) {
          findings.push({
            file: relative_path,
            line,
            column: key,
            literal,
            form: site.form,
            constraint: constrained.constraint,
            permitted: constrained.values
          })
          continue
        }
        if (occupancy) {
          const occupied = occupancy[key]
          if (occupied && !occupied.includes(literal)) {
            zero_rows.push({
              file: relative_path,
              line,
              column: key,
              literal,
              form: site.form
            })
          }
        }
      }
    }
  }

  return { findings, zero_rows }
}

const walk_sql_files = (root) => {
  const files = []
  const visit = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.name.endsWith('.sql')) files.push(full)
    }
  }
  visit(root)
  return files.sort()
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

// Run on EVERY invocation. Half of what this scanner does is decide a literal
// is NOT a league column comparison, so the controls run in both directions:
// a planted out-of-vocabulary literal must be REPORTED, and a vendor-to-league
// map key must stay SILENT. A control that only proves the reporting half would
// pass a scanner that reports everything, which is the noisy failure the class
// is most vulnerable to.
const CONTROLS = [
  {
    name: 'a planted out-of-vocabulary literal in .where(col, value) is reported',
    kind: 'knex',
    expect: 'red',
    source: `const q = db('pff_player_seasonlogs').where('player_position', 'ED').select('pid')`
  },
  {
    name: 'a planted out-of-vocabulary literal in .whereIn through a table alias is reported',
    kind: 'knex',
    expect: 'red',
    source: `const q = db('pff_player_seasonlogs as pff').whereIn('pff.player_position', ['DI', 'EDGE']).select('pid')`
  },
  {
    name: 'a planted out-of-vocabulary literal in object shorthand is reported',
    kind: 'knex',
    expect: 'red',
    source: `const q = db('player').where({ primary_position: 'OT' }).select('pid')`
  },
  {
    name: 'a retired season_type spelling is reported',
    kind: 'knex',
    expect: 'red',
    source: `const q = db('pff_player_seasonlogs').where('season_type', 'REGULAR').select('pid')`
  },
  {
    name: 'a vendor-to-league map key is NOT reported',
    kind: 'knex',
    expect: 'silent',
    source: `const PFF_POSITION_MAP = { ED: 'EDGE', DI: 'DT' }\nconst position = PFF_POSITION_MAP[row.player_position]`
  },
  {
    name: 'a permitted literal is NOT reported',
    kind: 'knex',
    expect: 'silent',
    source: `const q = db('pff_player_seasonlogs').where('player_position', 'EDGE').select('pid')`
  },
  {
    name: 'an unqualified literal in a MULTI-table statement is NOT resolved',
    kind: 'knex',
    expect: 'silent',
    source: `const q = db('pff_player_seasonlogs').join('player', 'a', 'b').where({ player_position: 'ED' })`
  },
  {
    name: 'a planted out-of-vocabulary literal in SQL, through a CTE chain, is reported',
    kind: 'sql',
    expect: 'red',
    source: `WITH a AS (SELECT pff.player_position FROM pff_player_seasonlogs pff),\n b AS (SELECT a.* FROM a)\nSELECT * FROM b WHERE b.player_position = 'ED'`
  },
  {
    name: 'a SQL template parameter is NOT reported',
    kind: 'sql',
    expect: 'silent',
    source: `SELECT * FROM player p WHERE p.primary_position = '\${position}'`
  }
]

const run_negative_controls = ({ tables, vocabulary }) => {
  const results = []
  for (const control of CONTROLS) {
    const result =
      control.kind === 'knex'
        ? scan_knex_source({
            source: control.source,
            relative_path: 'synthetic',
            tables,
            vocabulary,
            occupancy: null
          })
        : scan_sql_text({
            sql: control.source,
            relative_path: 'synthetic',
            vocabulary,
            occupancy: null
          })
    const reported = result.findings.length > 0
    const passed = control.expect === 'red' ? reported : !reported
    results.push({ ...control, reported, passed })
  }
  return results
}

const parse_argv = () => {
  const argv = process.argv.slice(2)
  const options = { roots: [], json: false, occupancy: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sql-root') options.roots.push(argv[++i])
    else if (argv[i] === '--json') options.json = true
    else if (argv[i] === '--occupancy') options.occupancy = argv[++i]
  }
  return options
}

const main = () => {
  const options = parse_argv()
  const { columns, total_constraints, partition_child_constraints } =
    vocabulary_constrained_columns()
  const vocabulary = vocabulary_index(columns)

  const occupancy = options.occupancy
    ? JSON.parse(fs.readFileSync(options.occupancy, 'utf8'))
    : null

  const roots = options.roots.length
    ? options.roots
    : [path.join(user_base_root, 'text', 'nfl', 'query')]

  let files_read = 0
  let js_files_read = 0
  let statements_read = 0
  const findings = []
  const zero_rows = []

  // The knex half, over the server roots. `libs-shared` is deliberately absent
  // for the reason check-knex-column-resolution asserts: it is isomorphic and
  // reaches the SPA bundle, where there is no knex.
  const tables = parse_schema(
    fs.readFileSync(path.join(repo_root, 'db', 'schema.postgres.sql'), 'utf8')
  )
  const server_roots = ['api', 'libs-server', 'scripts', 'jobs', 'app']
  for (const file of walk_files(server_roots, ['.mjs', '.js'], repo_root)) {
    const source = fs.readFileSync(file, 'utf8')
    js_files_read += 1
    statements_read += collect_statements(source).length
    const result = scan_knex_source({
      source,
      relative_path: path.relative(repo_root, file),
      tables,
      vocabulary,
      occupancy
    })
    findings.push(...result.findings)
    zero_rows.push(...result.zero_rows)
  }

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      console.error(`TOOLING ERROR: root does not exist: ${root}`)
      process.exit(2)
    }
    for (const file of walk_sql_files(root)) {
      files_read += 1
      const sql = fs.readFileSync(file, 'utf8')
      const result = scan_sql_text({
        sql,
        relative_path: path.relative(user_base_root, file),
        vocabulary,
        occupancy
      })
      findings.push(...result.findings)
      zero_rows.push(...result.zero_rows)
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ findings, zero_rows, files_read }, null, 2))
    return findings.length ? 1 : 0
  }

  console.log('SURFACE')
  console.log(`  value-vocabulary CHECK constraints: ${total_constraints}`)
  console.log(
    `  on partition children:              ${partition_child_constraints}`
  )
  console.log(`  LOGICAL constrained columns:        ${columns.length}`)
  console.log(`  .sql files read:                    ${files_read}`)
  console.log(`  JS files read:                      ${js_files_read}`)
  console.log(`  knex statements parsed:             ${statements_read}`)
  console.log('')

  console.log(`CAN NEVER MATCH -- ${findings.length}`)
  for (const finding of findings) {
    console.log(
      `  ${finding.file}:${finding.line}  ${finding.column} ${finding.form}`
    )
    console.log(
      `      '${finding.literal}' is not in ${finding.constraint} (${finding.permitted.join(', ')})`
    )
  }
  if (!findings.length) console.log('  none')
  console.log('')

  const controls = run_negative_controls({ tables, vocabulary })
  const failed_controls = controls.filter((control) => !control.passed)
  console.log('NEGATIVE CONTROLS')
  for (const control of controls) {
    const verdict = control.expect === 'red' ? 'WENT RED' : 'STAYED SILENT'
    console.log(
      `  [${control.passed ? 'ok' : 'FAIL'}] ${verdict}  ${control.name}`
    )
  }
  console.log('')

  console.log(
    `ZERO ROWS (advisory, never fails) -- ${occupancy ? zero_rows.length : 'not measured, pass --occupancy'}`
  )
  for (const row of zero_rows) {
    console.log(
      `  ${row.file}:${row.line}  ${row.column} ${row.form} -- '${row.literal}' has no production row`
    )
  }

  return findings.length || failed_controls.length ? 1 : 0
}

process.exit(main())
