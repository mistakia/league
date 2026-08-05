#!/usr/bin/env node
//
// check-api-response-shapes.mjs
//
// Gates the swagger response schemas in `api/` against two oracles that nothing
// else in this repo checks:
//
//   GATE 1  swagger internal consistency — every `required` name, every `$ref`
//           and every response `example` key must resolve against the schema's
//           own resolved `properties`. No database, no adjudication, and no way
//           for it to produce a false positive: it compares the spec to itself.
//
//   GATE 2  table-backed response drift — for a route handler that is a provable
//           wholesale single-table read (`db('t').where(...)` echoed straight to
//           `res.send`), the response key set is EXACTLY that table's column set,
//           so every documented property must be a column in
//           `db/schema.gres.sql`. Legitimate exceptions are adjudicated in
//           `api-response-shape-adjudications.json`, never filtered by name.
//
// Both gates exist because `api/swagger` declares response schemas across 53
// route files and nothing validated a response against them, which is what made
// the `leagues.hosted` -> `is_hosted` rename a user-visible outage while every
// server-side oracle stayed green.
//
// ORACLE CHOICE — static, schema-file-anchored, deliberately NOT executed.
//
//   An executed oracle (boot the API, hit each route, validate the body) sounds
//   stronger and is weaker here. In a fresh test database nearly every list
//   route answers `[]`, which validates vacuously against `type: array`, so the
//   gate would run green across the whole surface while being structurally
//   unable to see a renamed column — the exact failure this repo has recorded
//   three times. Its power would be bounded by fixture coverage, not by the
//   spec.
//
//   For the shape that actually carries the risk — a handler echoing a
//   `SELECT *` row to the client — the response key set is completely stated by
//   `db/schema.postgres.sql`. Static comparison is therefore a COMPLETE oracle
//   for those routes, strictly better than execution, and it needs no database,
//   no auth and no container, so it runs per-cluster in about a second.
//
// COVERAGE IS REPORTED, NOT IMPLIED. Gate 2 can only cover routes whose response
// shape is statically determinable. The run always prints the denominator — how
// many operations declare a checkable 200 schema, how many gate 2 reaches, and
// how many it does not — because a gate over part of the surface that reads as
// full coverage is worse than no gate.
//
// Usage:
//
//   node db/adhoc/check-api-response-shapes.mjs            # both gates
//   node db/adhoc/check-api-response-shapes.mjs --gate 1
//   node db/adhoc/check-api-response-shapes.mjs --coverage # denominator only
//   node db/adhoc/check-api-response-shapes.mjs --json
//
// Exit 1 on any finding. Uses console.log deliberately, never `debug` — the
// ESM import graph clobbers the namespace set before a module-scope
// `debug.enable` runs, and an oracle whose verdict depends on winning that
// negotiation has no audit trail.
//
// NEGATIVE CONTROL. Never accept a green from this you have not shown can go
// red. `--self-test` mutates the spec in memory in three ways this gate is
// supposed to catch and asserts each one is reported; run it whenever you touch
// this file, and delete an adjudication and confirm its property reappears
// whenever you add one.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// `@babel/core` and not `@babel/parser`: the parser is only a TRANSITIVE
// dependency here, and a bare import of one resolves fine from this checkout
// while failing in a CI checkout or on a host — the hazard this repo already
// hit with `node-fetch`. `@babel/core` is a declared devDependency, so this
// import is honest and adds nothing to the lockfile. `configFile: false` makes
// it a pure parse rather than a run of the repo's React/JSX babel config.
import { parseSync as parse_js } from '@babel/core'
import swaggerJSDoc from 'swagger-jsdoc'

import specs from '#api/swagger/config.mjs'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const routes_dir = path.join(repo_root, 'api', 'routes')
const schema_file = path.join(repo_root, 'db', 'schema.postgres.sql')
const spa_service_file = path.join(
  repo_root,
  'app',
  'core',
  'api',
  'service.js'
)
const adjudications_file = path.join(
  repo_root,
  'db',
  'adhoc',
  'api-response-shape-adjudications.json'
)

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

// COVERAGE FLOOR — the single most important line in this file.
//
// Gate 2's reach depends on a static analysis of route handlers. If that
// analysis breaks — a refactor changes how handlers are written, the parser
// changes, a bug drops a case — `covered` silently falls toward zero, gate 2
// reports nothing, and the run prints GATE OK. That is precisely the failure
// this program has recorded three times: a gate reporting success while
// structurally unable to detect the thing it measures.
//
// So a DROP in coverage is itself a failure. Raise this when a change genuinely
// extends reach; never lower it to make a run pass. Lowering it is the same act
// as `--rebaseline` on the conformance ratchet, and it is wrong for the same
// reason.
const GATE_2_MINIMUM_COVERED_ROUTES = 5

// Same reasoning for gate 1: it walks the spec, so an import or resolution
// change could quietly leave it walking nothing.
const GATE_1_MINIMUM_SCHEMAS_CHECKED = 90

// Chain members that leave the row's COLUMN SET exactly as the table declares
// it. Filtering, ordering and pagination qualify; nothing else does.
//
// This is an ALLOWLIST on purpose, and the first version of this gate got it
// wrong. A denylist of projecting methods (`select`, `join`, `pluck`, ...) let
// `res.send(nominations.map((n) => ({ ... })))` through, because `map` was not
// on the list — the route builds an entirely new object per row and the gate
// reported five confident findings against a table whose columns the response
// never carries. A denylist cannot be complete: every method anyone ever chains
// is a new blind spot, and the failure is silent and looks like coverage. With
// an allowlist an unrecognised method makes the route uncovered, which is the
// safe direction and is counted honestly in the denominator.
//
// `first` is absent because it changes cardinality, not shape — but it is also
// not needed by any route this covers today, so it stays out until one needs it
// and someone re-reasons about it.
const SHAPE_PRESERVING_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'whereIn',
  'whereNotIn',
  'whereNull',
  'whereNotNull',
  'whereBetween',
  'whereNotBetween',
  'whereRaw',
  'whereExists',
  'orderBy',
  'orderByRaw',
  'limit',
  'offset'
])

// ---------------------------------------------------------------------------
// schema.postgres.sql
// ---------------------------------------------------------------------------

// Parses CREATE TABLE bodies out of the exported schema. Views are collected
// separately and are NOT usable as a gate-2 anchor: a view's output columns come
// from its SELECT list, so a name-only parse of the dump cannot state them
// reliably, and a gate that guessed would report confident nonsense.
const parse_schema_tables = (sql) => {
  const tables = new Map()
  const table_re =
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\);/gi
  let match
  while ((match = table_re.exec(sql))) {
    const columns = []
    for (const raw_line of match[2].split('\n')) {
      const line = raw_line.trim()
      const column_match = /^"?([a-z0-9_]+)"?\s+[a-z]/i.exec(line)
      if (!column_match) continue
      if (
        /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE|PARTITION)$/i.test(
          column_match[1]
        )
      ) {
        continue
      }
      columns.push(column_match[1])
    }
    tables.set(match[1], columns)
  }
  return tables
}

const parse_schema_views = (sql) =>
  new Set(
    [
      ...sql.matchAll(
        /CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:public\.)?"?([a-z0-9_]+)"?/gi
      )
    ].map((m) => m[1])
  )

// ---------------------------------------------------------------------------
// swagger schema resolution
// ---------------------------------------------------------------------------

const ref_target = (ref) => {
  const parts = ref.replace(/^#\//, '').split('/')
  let node = specs
  for (const part of parts) {
    if (node == null) return null
    node = node[part]
  }
  return node
}

// Resolves a schema node down to the set of property names it can produce,
// following $ref / allOf / oneOf / anyOf and unwrapping arrays. Returns null
// when the node declares no properties at all (a bare `type: object`, a scalar,
// a free-form map) — that is "uncheckable", which is a coverage fact rather than
// a finding, and the caller counts it as such.
const resolve_properties = (node, seen = new Set()) => {
  if (!node || typeof node !== 'object') return null

  if (node.$ref) {
    if (seen.has(node.$ref)) return null
    seen.add(node.$ref)
    return resolve_properties(ref_target(node.$ref), seen)
  }

  if (node.type === 'array') return resolve_properties(node.items, seen)

  const collected = new Set()
  let any = false

  if (node.properties) {
    any = true
    for (const key of Object.keys(node.properties)) collected.add(key)
  }

  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (!Array.isArray(node[key])) continue
    for (const branch of node[key]) {
      const branch_props = resolve_properties(branch, new Set(seen))
      if (!branch_props) continue
      any = true
      for (const name of branch_props) collected.add(name)
    }
  }

  return any ? collected : null
}

// The `required` names a schema declares, including those inherited through
// allOf branches. Kept separate from resolve_properties because gate 1's whole
// point is comparing the two.
const resolve_required = (node, seen = new Set()) => {
  if (!node || typeof node !== 'object') return []

  if (node.$ref) {
    if (seen.has(node.$ref)) return []
    seen.add(node.$ref)
    return resolve_required(ref_target(node.$ref), seen)
  }

  if (node.type === 'array') return resolve_required(node.items, seen)

  const names = Array.isArray(node.required) ? [...node.required] : []
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (!Array.isArray(node[key])) continue
    for (const branch of node[key]) {
      names.push(...resolve_required(branch, new Set(seen)))
    }
  }
  return names
}

// Every named component schema plus every inline schema anywhere in the spec,
// so gate 1 sees inline declarations too.
//
// A node reached through allOf/oneOf/anyOf is NOT yielded on its own. Such a
// branch legitimately carries `required` for properties declared on its PARENT
// — `anyOf: [{ required: [username] }, { required: [email] }]` over a parent
// declaring both is the standard "one of these two" idiom and is correct.
// Checking the branch in isolation reports it as a defect, which is a false
// positive that would train a reader to ignore this gate. resolve_required
// already collects branch requirements up to the parent, so the parent's own
// check covers them.
const walk_all_schema_nodes = function* (
  node,
  trail,
  seen = new Set(),
  in_branch = false
) {
  if (!node || typeof node !== 'object') return
  if (seen.has(node)) return
  seen.add(node)

  if (
    !in_branch &&
    (node.properties || node.required || node.allOf || node.oneOf || node.anyOf)
  ) {
    yield { node, trail }
  }

  // allOf/oneOf/anyOf hold an ARRAY of branches, so the flag has to survive the
  // array level to reach the branch objects themselves; below a branch it is
  // dropped, because a branch's own nested schemas are ordinary again.
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref') continue
    if (!value || typeof value !== 'object') continue
    const next_in_branch =
      key === 'allOf' || key === 'oneOf' || key === 'anyOf'
        ? true
        : Array.isArray(node)
          ? in_branch
          : false
    yield* walk_all_schema_nodes(value, `${trail}.${key}`, seen, next_in_branch)
  }
}

// ---------------------------------------------------------------------------
// route file -> (method, table) for provable wholesale reads
// ---------------------------------------------------------------------------

const walk_files = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk_files(full, acc)
    else if (entry.name.endsWith('.mjs')) acc.push(full)
  }
  return acc
}

// Walks a member chain down to its root, collecting every method called along
// the way. Returns `{ table }` when the root is `db('<literal>')` and
// `{ alias }` when it is a bare identifier, because knex builders here are
// routinely bound once and extended later:
//
//     const query = db('waivers').where({ lid })
//     query.where(function () { ... })          // extension, separate statement
//     const waivers = await query               // alias
//     res.send(waivers)
//
// A chain analysis that only looked at the initializer would see `await query`,
// find no `db(` root, and report the route as not statically determinable —
// which is the shape of a gate that is silently blind rather than wrong.
const describe_chain = (node) => {
  const methods = []
  let cursor = node
  for (;;) {
    if (!cursor || typeof cursor.type !== 'string') return null
    if (cursor.type === 'AwaitExpression') {
      cursor = cursor.argument
      continue
    }
    if (
      cursor.type === 'TSNonNullExpression' ||
      cursor.type === 'ParenthesizedExpression'
    ) {
      cursor = cursor.expression
      continue
    }
    if (cursor.type === 'CallExpression') {
      if (cursor.callee.type === 'MemberExpression') {
        if (cursor.callee.property.type === 'Identifier') {
          methods.push(cursor.callee.property.name)
        }
        cursor = cursor.callee.object
        continue
      }
      if (
        cursor.callee.type === 'Identifier' &&
        cursor.callee.name === 'db' &&
        cursor.arguments.length &&
        cursor.arguments[0].type === 'StringLiteral'
      ) {
        return { table: cursor.arguments[0].value, methods }
      }
      return null
    }
    if (cursor.type === 'MemberExpression') {
      cursor = cursor.object
      continue
    }
    if (cursor.type === 'Identifier') {
      return { alias: cursor.name, methods }
    }
    return null
  }
}

const walk_ast = function* (node, parent = null) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) yield* walk_ast(child, parent)
    return
  }
  if (typeof node.type !== 'string') return
  yield { node, parent }
  for (const [key, value] of Object.entries(node)) {
    if (
      key === 'loc' ||
      key === 'leadingComments' ||
      key === 'trailingComments'
    )
      continue
    if (value && typeof value === 'object') yield* walk_ast(value, node)
  }
}

// Normalizes an express router path onto the swagger spelling, so a handler can
// be matched to the operation that documents it: `/:pickId` -> `/{pickId}`, and
// the trailing `/?` this codebase writes everywhere is dropped.
const normalize_router_path = (raw) => {
  let path_value = raw.replace(/\/\?$/, '').replace(/\?$/, '')
  path_value = path_value.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
  if (path_value === '/' || path_value === '') return ''
  return path_value.replace(/\/$/, '')
}

// A handler qualifies when a variable is bound from a chain rooted at
// db('<table>') carrying only shape-preserving methods, and that same variable
// is what reaches res.send(). Anything else — an explicit column list, a join, a
// mapped object, a computed field — is not statically determinable and is
// counted as uncovered rather than guessed at.
//
// Analysis is scoped to ONE `router.<method>(...)` registration at a time, both
// so a handler can be paired with the operation that documents it and so a
// variable name reused across two handlers in the same file cannot leak a table
// from one into the other.
const analyze_route_file = (file) => {
  const source = fs.readFileSync(file, 'utf8')
  let ast
  try {
    ast = parse_js(source, {
      sourceType: 'module',
      configFile: false,
      babelrc: false,
      filename: file
    })
  } catch (error) {
    return { parse_error: error.message, handlers: [] }
  }

  const registrations = []
  for (const { node } of walk_ast(ast.program)) {
    if (node.type !== 'CallExpression') continue
    const callee = node.callee
    if (
      callee.type !== 'MemberExpression' ||
      callee.object.type !== 'Identifier' ||
      callee.object.name !== 'router' ||
      callee.property.type !== 'Identifier' ||
      !HTTP_METHODS.includes(callee.property.name)
    ) {
      continue
    }
    const first = node.arguments[0]
    if (!first || first.type !== 'StringLiteral') continue
    registrations.push({
      method: callee.property.name,
      path: normalize_router_path(first.value),
      node
    })
  }

  const handlers = []
  for (const registration of registrations) {
    const table = analyze_handler_subtree(registration.node)
    if (!table) continue
    handlers.push({
      method: registration.method,
      path: registration.path,
      table
    })
  }

  return { parse_error: null, handlers }
}

// Returns the table when this one registration provably echoes a wholesale read
// of it, otherwise null.
const analyze_handler_subtree = (root) => {
  // variable name -> { table? , alias?, methods[] }
  const bindings = new Map()
  // variable names reassigned after binding are untrustworthy
  const tainted = new Set()

  for (const { node } of walk_ast(root)) {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.init
    ) {
      const chain = describe_chain(node.init)
      if (chain) {
        bindings.set(node.id.name, {
          table: chain.table,
          alias: chain.alias,
          methods: [...chain.methods]
        })
      } else if (bindings.has(node.id.name)) {
        // rebound to something unanalysable
        tainted.add(node.id.name)
      }
      continue
    }
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'Identifier'
    ) {
      tainted.add(node.left.name)
    }
  }

  // Chain EXTENSIONS made as their own statements (`query.where(...)`,
  // `query.select(...)`) mutate the builder in place, so they belong to the
  // binding's method list. Missing these is how a `.select()` applied on a
  // later line would slip past and make an explicitly projected route look
  // wholesale.
  for (const { node } of walk_ast(root)) {
    if (node.type !== 'CallExpression') continue
    if (node.callee.type !== 'MemberExpression') continue
    const chain = describe_chain(node)
    if (!chain || !chain.alias) continue
    const binding = bindings.get(chain.alias)
    if (!binding) continue
    binding.methods.push(...chain.methods)
  }

  // Resolve alias hops to a table, carrying every method seen on the way.
  const resolve_binding = (name, depth = 0) => {
    if (depth > 8) return null
    const binding = bindings.get(name)
    if (!binding) return null
    if (binding.table) return { table: binding.table, methods: binding.methods }
    if (!binding.alias) return null
    if (tainted.has(binding.alias)) return null
    const upstream = resolve_binding(binding.alias, depth + 1)
    if (!upstream) return null
    return {
      table: upstream.table,
      methods: [...upstream.methods, ...binding.methods]
    }
  }

  // Every success-path `res.send`. If ANY of them is not a provable wholesale
  // read the handler is disqualified outright — a route with two exits, one
  // wholesale and one mapped, does not have a single determinable shape, and
  // covering it on the strength of the wholesale exit would be a gate reporting
  // on a body it cannot see.
  const tables = new Set()
  let disqualified = false

  for (const { node } of walk_ast(root)) {
    if (node.type !== 'CallExpression') continue
    const callee = node.callee
    if (
      callee.type !== 'MemberExpression' ||
      callee.property.type !== 'Identifier' ||
      callee.property.name !== 'send'
    ) {
      continue
    }
    // Skip error exits: `res.status(4xx|5xx).send(...)`.
    const receiver = callee.object
    if (receiver.type === 'CallExpression') {
      const status_arg = receiver.arguments[0]
      if (
        status_arg &&
        status_arg.type === 'NumericLiteral' &&
        status_arg.value >= 300
      )
        continue
    } else if (receiver.type !== 'Identifier' || receiver.name !== 'res') {
      continue
    }

    const arg = node.arguments[0]
    // `res.send([])` is an empty-result early exit and says nothing about shape.
    if (arg && arg.type === 'ArrayExpression' && !arg.elements.length) continue
    if (!arg || arg.type !== 'Identifier' || tainted.has(arg.name)) {
      disqualified = true
      continue
    }
    const resolved = resolve_binding(arg.name)
    if (
      !resolved ||
      !resolved.methods.every((m) => SHAPE_PRESERVING_METHODS.has(m))
    ) {
      disqualified = true
      continue
    }
    tables.add(resolved.table)
  }

  if (disqualified || tables.size !== 1) return null
  return [...tables][0]
}

// ---------------------------------------------------------------------------
// per-file swagger: which operations does each route file declare
// ---------------------------------------------------------------------------

// Re-runs swagger-jsdoc over ONE file, so the operation -> file mapping comes
// from the same parser that builds the real spec rather than from a regex over
// the JSDoc. This is the `check-data-view-url-param-coverage` discipline: use
// the producer, do not re-implement it.
const operations_declared_by = (file) => {
  const relative = path.relative(repo_root, file)
  let partial
  try {
    partial = swaggerJSDoc({
      definition: { openapi: '3.0.0', info: { title: 'x', version: '0' } },
      apis: [relative]
    })
  } catch {
    return []
  }
  const operations = []
  for (const [route_path, methods] of Object.entries(partial.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue
      operations.push({ path: route_path, method, operation })
    }
  }
  return operations
}

const success_schema = (operation) => {
  const response =
    operation.responses &&
    (operation.responses['200'] || operation.responses[200])
  if (!response) return { schema: null, reason: 'no 200 response' }
  const json = response.content && response.content['application/json']
  if (!json || !json.schema)
    return { schema: null, reason: 'no application/json schema' }
  return { schema: json.schema, reason: null }
}

// ---------------------------------------------------------------------------
// tier
// ---------------------------------------------------------------------------

// Whether the SPA fetches this path. `app/core/api/service.js` is the single
// surface the client calls the API through, so a path whose distinctive static
// segments all appear there reaches the browser and its drift is user-visible.
// The tier orders triage only — a `server_only` finding still fails the gate.
const build_tier_resolver = () => {
  let service_source = ''
  try {
    service_source = fs.readFileSync(spa_service_file, 'utf8')
  } catch {
    return () => 'unknown'
  }
  return (route_path) => {
    const segments = route_path
      .split('/')
      .filter((s) => s && !s.startsWith('{') && s.length > 2)
    if (!segments.length) return 'unknown'
    return segments.every((s) => service_source.includes(s))
      ? 'reaches_spa'
      : 'server_only'
  }
}

// ---------------------------------------------------------------------------
// adjudications
// ---------------------------------------------------------------------------

const load_adjudications = () => {
  if (!fs.existsSync(adjudications_file)) return {}
  const parsed = JSON.parse(fs.readFileSync(adjudications_file, 'utf8'))
  return parsed.adjudications || {}
}

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------

const run_gate_1 = () => {
  const findings = []
  let schemas_checked = 0

  for (const { node, trail } of walk_all_schema_nodes(specs, 'spec')) {
    schemas_checked++
    const properties = resolve_properties(node)
    const required = resolve_required(node)
    if (!required.length) continue
    if (!properties) {
      findings.push({
        gate: 1,
        kind: 'required_without_properties',
        location: trail,
        detail: `declares required [${required.join(', ')}] but resolves to no properties`
      })
      continue
    }
    for (const name of required) {
      if (properties.has(name)) continue
      findings.push({
        gate: 1,
        kind: 'required_not_a_property',
        location: trail,
        property: name,
        detail: `required '${name}' is not among the schema's ${properties.size} resolved properties`
      })
    }
  }

  // Unresolvable $refs. A dangling $ref makes every downstream check vacuous,
  // so it is a hard failure rather than a coverage note.
  const seen_refs = new Set()
  const collect_refs = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collect_refs)
    if (typeof node.$ref === 'string') seen_refs.add(node.$ref)
    for (const value of Object.values(node)) collect_refs(value)
  }
  collect_refs(specs)
  for (const ref of seen_refs) {
    if (ref_target(ref) == null) {
      findings.push({
        gate: 1,
        kind: 'unresolvable_ref',
        location: ref,
        detail: `$ref '${ref}' does not resolve`
      })
    }
  }

  return { findings, schemas_checked }
}

const run_gate_2 = ({ tables, views, adjudications, tier_of }) => {
  const findings = []
  const covered = []
  const uncovered = []

  const files = walk_files(routes_dir)

  for (const file of files) {
    const relative = path.relative(repo_root, file)
    const { parse_error, handlers } = analyze_route_file(file)

    if (parse_error) {
      findings.push({
        gate: 2,
        kind: 'route_file_unparseable',
        location: relative,
        detail: parse_error
      })
      continue
    }

    const operations = operations_declared_by(file)
    const documented = operations.filter(
      (o) => success_schema(o.operation).schema
    )

    for (const op of operations) {
      const { schema, reason } = success_schema(op.operation)
      if (!schema) {
        uncovered.push({
          file: relative,
          path: op.path,
          method: op.method,
          reason
        })
      }
    }

    // Pair a documented operation with a handler by METHOD plus path suffix:
    // the router mounts at a prefix the file cannot see, so the swagger path is
    // the router path with that prefix in front of it. A pairing that is not
    // unique is reported as uncovered rather than guessed at.
    const pair_for = (op) => {
      const matches = handlers.filter(
        (h) =>
          h.method === op.method &&
          (h.path === ''
            ? true
            : op.path === h.path || op.path.endsWith(h.path))
      )
      return matches.length === 1 ? matches[0] : null
    }

    for (const op of documented) {
      const handler = pair_for(op)
      if (!handler) {
        uncovered.push({
          file: relative,
          path: op.path,
          method: op.method,
          reason: handlers.some((h) => h.method === op.method)
            ? 'more than one wholesale handler matches this path; cannot pair unambiguously'
            : 'response shape not statically determinable (projection, join, mapped object, or multiple exits)'
        })
        continue
      }

      const table = handler.table

      if (views.has(table) && !tables.has(table)) {
        uncovered.push({
          file: relative,
          path: op.path,
          method: op.method,
          reason: `reads view '${table}'; a view's output columns are not stated by the schema dump`
        })
        continue
      }

      const columns = tables.get(table)
      if (!columns) {
        findings.push({
          gate: 2,
          kind: 'unknown_table',
          location: relative,
          detail: `handler reads '${table}', which is not in db/schema.postgres.sql`
        })
        continue
      }

      const { schema } = success_schema(op.operation)
      const properties = resolve_properties(schema)
      if (!properties) {
        uncovered.push({
          file: relative,
          path: op.path,
          method: op.method,
          reason: '200 schema declares no properties'
        })
        continue
      }

      const schema_name =
        (schema.$ref && schema.$ref.split('/').pop()) ||
        (schema.items &&
          schema.items.$ref &&
          schema.items.$ref.split('/').pop()) ||
        `${op.method} ${op.path}`

      const column_set = new Set(columns)
      const tier = tier_of(op.path)

      const documented_but_absent = []
      for (const name of properties) {
        if (column_set.has(name)) continue
        const key = `${schema_name}.${name}`
        if (adjudications[key]) continue
        documented_but_absent.push(name)
      }

      const present_but_undocumented = columns.filter((c) => !properties.has(c))

      covered.push({
        file: relative,
        path: op.path,
        method: op.method,
        table,
        schema_name,
        tier,
        documented: properties.size,
        columns: columns.length
      })

      for (const name of documented_but_absent) {
        findings.push({
          gate: 2,
          kind: 'documented_property_not_a_column',
          location: `${relative} ${op.method.toUpperCase()} ${op.path}`,
          schema_name,
          property: name,
          table,
          tier,
          detail: `${schema_name}.${name} is documented on the response, but '${table}' has no such column — the handler echoes the row wholesale, so this field is never emitted`
        })
      }

      for (const name of present_but_undocumented) {
        findings.push({
          gate: 2,
          kind: 'column_not_documented',
          location: `${relative} ${op.method.toUpperCase()} ${op.path}`,
          schema_name,
          property: name,
          table,
          tier,
          severity: 'warning',
          detail: `'${table}.${name}' is emitted on the wire but absent from ${schema_name}`
        })
      }
    }
  }

  return { findings, covered, uncovered }
}

// ---------------------------------------------------------------------------
// negative control
// ---------------------------------------------------------------------------

// Three deliberate mutations of the live spec, each one an instance of what a
// gate here is supposed to catch. A green this file has not been shown able to
// turn red is not evidence.
const run_self_test = (context) => {
  const cases = []

  // 1. gate 1: a required name that is not a property.
  {
    const target = Object.values(specs.components.schemas).find(
      (s) => s && s.properties && Object.keys(s.properties).length
    )
    const restore = target.required
    target.required = [...(restore || []), '__negative_control_absent__']
    const reported = run_gate_1().findings.some(
      (f) => f.property === '__negative_control_absent__'
    )
    target.required = restore
    if (restore === undefined) delete target.required
    cases.push([
      'gate 1 reports a required name absent from properties',
      reported
    ])
  }

  // 2. gate 1: an unresolvable $ref.
  {
    const target = Object.values(specs.components.schemas).find(
      (s) => s && s.properties && Object.keys(s.properties).length
    )
    const key = Object.keys(target.properties)[0]
    const restore = target.properties[key]
    target.properties[key] = {
      $ref: '#/components/schemas/__NegativeControlMissing__'
    }
    const reported = run_gate_1().findings.some(
      (f) => f.kind === 'unresolvable_ref'
    )
    target.properties[key] = restore
    cases.push(['gate 1 reports an unresolvable $ref', reported])
  }

  // 3. gate 2: a documented property renamed off its column. Mutates the parsed
  //    column set rather than the spec, which is the same drift seen from the
  //    other side and needs no file edit.
  {
    const mutated = new Map(context.tables)
    let victim = null
    for (const entry of context.covered_tables) {
      const columns = mutated.get(entry.table)
      if (!columns) continue
      const renameable = columns.find((c) => entry.documented_names.has(c))
      if (!renameable) continue
      victim = { table: entry.table, column: renameable }
      mutated.set(
        entry.table,
        columns.map((c) => (c === renameable ? `${c}__negative_control` : c))
      )
      break
    }
    if (!victim) {
      cases.push([
        'gate 2 reports a column renamed out from under its doc',
        false
      ])
    } else {
      const { findings } = run_gate_2({ ...context, tables: mutated })
      const reported = findings.some(
        (f) =>
          f.kind === 'documented_property_not_a_column' &&
          f.property === victim.column &&
          f.table === victim.table
      )
      cases.push([
        `gate 2 reports ${victim.table}.${victim.column} renamed out from under its doc`,
        reported
      ])
    }
  }

  console.log('')
  console.log('NEGATIVE CONTROL')
  let ok = true
  for (const [label, passed] of cases) {
    console.log(`  ${passed ? 'RED as expected' : 'STAYED GREEN'}  ${label}`)
    if (!passed) ok = false
  }
  return ok
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const parse_argv = () => {
  const argv = process.argv.slice(2)
  const options = {
    gates: [1, 2],
    json: false,
    coverage_only: false,
    self_test: false
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--gate') options.gates = [Number(argv[++i])]
    else if (argv[i] === '--json') options.json = true
    else if (argv[i] === '--coverage') options.coverage_only = true
    else if (argv[i] === '--self-test') options.self_test = true
  }
  return options
}

const main = () => {
  const options = parse_argv()

  const sql = fs.readFileSync(schema_file, 'utf8')
  const tables = parse_schema_tables(sql)
  const views = parse_schema_views(sql)
  const adjudications = load_adjudications()
  const tier_of = build_tier_resolver()

  // Whole-surface denominator, measured rather than assumed.
  const all_operations = []
  for (const [route_path, methods] of Object.entries(specs.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue
      all_operations.push({ path: route_path, method, operation })
    }
  }
  const with_schema = all_operations.filter(
    (o) => success_schema(o.operation).schema
  )
  const with_properties = with_schema.filter((o) =>
    resolve_properties(success_schema(o.operation).schema)
  )

  const findings = []
  let gate_2_result = { findings: [], covered: [], uncovered: [] }
  let gate_1_schemas_checked = null

  if (options.gates.includes(2) || options.coverage_only) {
    gate_2_result = run_gate_2({ tables, views, adjudications, tier_of })
  }
  if (options.gates.includes(1) && !options.coverage_only) {
    const gate_1_result = run_gate_1()
    gate_1_schemas_checked = gate_1_result.schemas_checked
    findings.push(...gate_1_result.findings)
  }
  if (options.gates.includes(2) && !options.coverage_only) {
    findings.push(...gate_2_result.findings)
  }

  const route_files = walk_files(routes_dir)
  const documenting_files = route_files.filter((f) =>
    fs.readFileSync(f, 'utf8').includes('@swagger')
  )

  console.log('API RESPONSE SHAPE GATE')
  console.log('')
  console.log('COVERAGE (measured, not assumed)')
  console.log(`  route files under api/routes            ${route_files.length}`)
  console.log(
    `  route files carrying @swagger JSDoc     ${documenting_files.length}`
  )
  console.log(
    `  documented operations                   ${all_operations.length}`
  )
  console.log(`  ... declaring a 200 application/json    ${with_schema.length}`)
  console.log(
    `  ... whose 200 schema names properties   ${with_properties.length}`
  )
  console.log(
    `  gate 1 (spec self-consistency) covers   ${with_properties.length} of ${all_operations.length} operations plus every named component schema`
  )
  console.log(
    `  gate 2 (table-backed) covers            ${gate_2_result.covered.length} of ${all_operations.length} operations`
  )
  console.log(
    `  gate 2 does NOT cover                   ${gate_2_result.uncovered.length} operations — listed below`
  )

  if (gate_2_result.covered.length) {
    console.log('')
    console.log('GATE 2 COVERED ROUTES')
    for (const entry of gate_2_result.covered.sort((a, b) =>
      a.tier === b.tier
        ? a.path.localeCompare(b.path)
        : a.tier === 'reaches_spa'
          ? -1
          : 1
    )) {
      console.log(
        `  [${entry.tier}] ${entry.method.toUpperCase()} ${entry.path} -> ${entry.table} (${entry.documented} documented / ${entry.columns} columns)`
      )
    }
  }

  if (gate_2_result.uncovered.length) {
    console.log('')
    console.log(
      'GATE 2 NOT COVERED — these routes are NOT checked against any table'
    )
    const by_reason = new Map()
    for (const entry of gate_2_result.uncovered) {
      if (!by_reason.has(entry.reason)) by_reason.set(entry.reason, [])
      by_reason.get(entry.reason).push(entry)
    }
    for (const [reason, entries] of [...by_reason].sort(
      (a, b) => b[1].length - a[1].length
    )) {
      console.log(`  ${entries.length}  ${reason}`)
      for (const entry of entries) {
        console.log(
          `       ${entry.method.toUpperCase()} ${entry.path}  (${entry.file})`
        )
      }
    }
  }

  const errors = findings.filter((f) => f.severity !== 'warning')
  const warnings = findings.filter((f) => f.severity === 'warning')

  const emit = (list, heading) => {
    if (!list.length) return
    console.log('')
    console.log(heading)
    const ordered = [...list].sort((a, b) => {
      if (a.gate !== b.gate) return a.gate - b.gate
      if (a.tier !== b.tier) return a.tier === 'reaches_spa' ? -1 : 1
      return String(a.location).localeCompare(String(b.location))
    })
    for (const finding of ordered) {
      const tier = finding.tier ? `[${finding.tier}] ` : ''
      console.log(`  GATE ${finding.gate} ${tier}${finding.kind}`)
      console.log(`    ${finding.location}`)
      console.log(`    ${finding.detail}`)
    }
  }

  emit(errors, `FINDINGS (${errors.length})`)
  emit(
    warnings,
    `WARNINGS (${warnings.length}) — emitted on the wire, absent from the docs`
  )

  if (options.json) {
    console.log('')
    console.log(
      JSON.stringify(
        {
          coverage: {
            route_files: route_files.length,
            documenting_files: documenting_files.length,
            operations: all_operations.length,
            with_200_json_schema: with_schema.length,
            with_properties: with_properties.length,
            gate_2_covered: gate_2_result.covered.length,
            gate_2_uncovered: gate_2_result.uncovered.length
          },
          covered: gate_2_result.covered,
          uncovered: gate_2_result.uncovered,
          findings
        },
        null,
        2
      )
    )
  }

  let self_test_ok = true
  if (options.self_test) {
    const covered_tables = gate_2_result.covered.map((entry) => {
      const operations = operations_declared_by(
        path.join(repo_root, entry.file)
      )
      const op = operations.find(
        (o) => o.method === entry.method && o.path === entry.path
      )
      return {
        table: entry.table,
        documented_names:
          resolve_properties(success_schema(op.operation).schema) || new Set()
      }
    })
    self_test_ok = run_self_test({
      tables,
      views,
      adjudications,
      tier_of,
      covered_tables
    })
  }

  console.log('')
  if (options.coverage_only) {
    console.log('COVERAGE REPORT ONLY — no gate was run')
    process.exit(0)
  }

  // Coverage floors, checked before findings. A gate that has stopped looking
  // reports no findings, and that must never read as a pass.
  const floor_failures = []
  if (
    options.gates.includes(2) &&
    gate_2_result.covered.length < GATE_2_MINIMUM_COVERED_ROUTES
  ) {
    floor_failures.push(
      `gate 2 covered ${gate_2_result.covered.length} routes, below the floor of ${GATE_2_MINIMUM_COVERED_ROUTES}. The handler analysis has lost reach — fix it rather than lowering the floor.`
    )
  }
  if (
    gate_1_schemas_checked !== null &&
    gate_1_schemas_checked < GATE_1_MINIMUM_SCHEMAS_CHECKED
  ) {
    floor_failures.push(
      `gate 1 checked ${gate_1_schemas_checked} schemas, below the floor of ${GATE_1_MINIMUM_SCHEMAS_CHECKED}. The spec walk has lost reach — fix it rather than lowering the floor.`
    )
  }
  if (floor_failures.length) {
    console.log('COVERAGE FLOOR BREACHED')
    for (const message of floor_failures) console.log(`  ${message}`)
    console.log('')
    console.log(
      'GATE FAIL: coverage floor breached; findings below are not trustworthy'
    )
    process.exit(1)
  }

  if (!self_test_ok) {
    console.log(
      'GATE FAIL: the negative control did not go red. This gate cannot be trusted until it does.'
    )
    process.exit(1)
  }
  if (errors.length) {
    console.log(
      `GATE FAIL: ${errors.length} finding(s), ${warnings.length} warning(s)`
    )
    process.exit(1)
  }
  console.log(`GATE OK (${warnings.length} warning(s))`)
  process.exit(0)
}

main()
