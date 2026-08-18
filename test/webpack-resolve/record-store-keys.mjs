// Static half of `test/app.record-declares-reducer-key.spec.mjs`: reads each
// `app/core` domain's REDUCER for the entity ids it keys the redux store on,
// and its Record module for the ids the wire factory destructures.
//
// The spec pairs that against the LOADED Record. Splitting the extraction out
// keeps the spec readable as assertions and lets the extraction be exercised
// against a planted control, which is the only thing separating "found nothing"
// from "cannot see anything".

import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

const traverse = _traverse.default ?? _traverse

const parse_module = (file_path) =>
  parse(fs.readFileSync(file_path, 'utf8'), {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'objectRestSpread']
  })

// An entity id as this codebase spells it. `uid` is the RETIRED spelling and is
// deliberately included: a reducer still keying on `uid` against a Record that
// has moved to `<entity>_id` is the same defect seen from the other side.
//
// Ids NOT of this shape (`tid`, `lid`, `pid`) are excluded on purpose -- they
// name a DIFFERENT entity than the domain's own Record, so requiring the Record
// to declare them would be wrong. The waivers store is keyed
// `['teams', tid, waiver_id]`, and only `waiver_id` is the Waiver's own.
const is_entity_id = (name) => name === 'uid' || /_id$/.test(name)

// The calls that write an entry into the redux store under a key. `set`/`get`
// take the key as argument 0; the `*In` family takes a key PATH array, and the
// entity id can sit at any depth in it (`setIn(['items', t.trade_id], ...)`).
const KEYED_BY_FIRST_ARGUMENT = new Set(['set', 'get', 'delete', 'has'])
const KEYED_BY_PATH_ARRAY = new Set([
  'setIn',
  'getIn',
  'mergeIn',
  'deleteIn',
  'updateIn',
  'hasIn'
])

// `t.trade_id` -> { object: 't', id: 'trade_id' }; `payload.data.trade_id` ->
// { object: 'payload.data', id: 'trade_id' }. The object is kept as its dotted
// source path so the two can be matched against the factory's argument.
const read_entity_id = (node) => {
  if (node?.type !== 'MemberExpression') return null
  if (node.computed || node.property.type !== 'Identifier') return null
  if (!is_entity_id(node.property.name)) return null

  const object = dotted_path(node.object)
  return object ? { object, id: node.property.name } : null
}

const dotted_path = (node) => {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression' && !node.computed) {
    const object = dotted_path(node.object)
    return object && node.property.type === 'Identifier'
      ? `${object}.${node.property.name}`
      : null
  }
  return null
}

const REDUX_PLUMBING = new Set([
  'reducer.js',
  'sagas.js',
  'actions.js',
  'selectors.js',
  'index.js'
])

// The domain's own Record module: the sibling `.js` file that constructs an
// Immutable Record, excluding the redux plumbing files by name.
export const record_module_in = (domain_directory) => {
  for (const entry of fs.readdirSync(domain_directory).sort()) {
    if (!entry.endsWith('.js') || REDUX_PLUMBING.has(entry)) continue
    const candidate = path.join(domain_directory, entry)
    if (/new\s+Record\s*\(/.test(fs.readFileSync(candidate, 'utf8'))) {
      return candidate
    }
  }
  return null
}

// The exported wire factories in a Record module, and the entity ids each one
// DESTRUCTURES from its wire argument.
//
// That destructured id is what makes the domain's own entity identifiable
// without type inference. `create_trade({ trade_id, ... })` says a trade wire
// object carries `trade_id`; `create_season({ wildcard_round, ... })` consumes
// no id at all, which is the honest signal that a Season is derived from a
// LEAGUE object rather than keyed by an id of its own -- so that domain is out
// of the reducer-agreement check's reach rather than a false finding in it.
export const record_factories_in = (record_path) => {
  const factories = []

  const destructured_ids = (object_pattern) =>
    object_pattern.properties
      .filter((p) => p.type === 'ObjectProperty' && p.key.type === 'Identifier')
      .map((p) => p.key.name)
      .filter(is_entity_id)

  const record_factory = (name, node_path) => {
    const [declared] = node_path.node.params

    // A parameter with a default (`create_matchup({ ... } = {})`,
    // `createLeague(league_data = {})`) arrives wrapped in an AssignmentPattern.
    const parameter =
      declared?.type === 'AssignmentPattern' ? declared.left : declared

    if (parameter?.type === 'ObjectPattern') {
      factories.push({
        name,
        destructures_wire_object: true,
        ids: destructured_ids(parameter)
      })
      return
    }

    // `createLeague(league_data = {})` destructures in its BODY rather than in
    // its parameter list, which is the shape the League Record uses -- the one
    // whose missing `league_id` took the app down. Follow the parameter's
    // binding to a `const { ... } = <parameter>` inside the function.
    if (parameter?.type === 'Identifier') {
      const ids = []
      node_path.traverse({
        VariableDeclarator(declarator_path) {
          const { id, init } = declarator_path.node
          if (
            id.type === 'ObjectPattern' &&
            init?.type === 'Identifier' &&
            init.name === parameter.name
          ) {
            ids.push(...destructured_ids(id))
          }
        }
      })
      if (ids.length) {
        factories.push({ name, destructures_wire_object: true, ids })
        return
      }
    }

    factories.push({ name, destructures_wire_object: false, ids: [] })
  }

  traverse(parse_module(record_path), {
    ExportNamedDeclaration(node_path) {
      const declaration = node_path.node.declaration
      if (!declaration) return

      if (declaration.type === 'FunctionDeclaration') {
        record_factory(declaration.id.name, node_path.get('declaration'))
        return
      }

      if (declaration.type === 'VariableDeclaration') {
        const declarator_paths = node_path.get('declaration.declarations')
        for (const declarator_path of declarator_paths) {
          const init = declarator_path.node.init
          if (
            init?.type === 'ArrowFunctionExpression' ||
            init?.type === 'FunctionExpression'
          ) {
            record_factory(
              declarator_path.node.id.name,
              declarator_path.get('init')
            )
          }
        }
      }
    }
  })

  return factories
}

// The objects an argument declares to be domain wire objects, by handing them
// to one of the domain's Record factories. Three shapes occur here:
//
//   create_trade(t)                        -- the object itself
//   createLeague({ isLoaded: true, ...l })  -- spread into an object literal
//   create_matchup({ matchup_id: m.matchup_id, ... }) -- its properties read
//
// The third is the loosest and is still sound: a call that reads `m.matchup_id`
// to build a matchup has said `m` is a matchup.
const collect_wire_objects = (node, factory_names, wire_objects) => {
  if (
    node?.type !== 'CallExpression' ||
    node.callee.type !== 'Identifier' ||
    !factory_names.has(node.callee.name)
  ) {
    return
  }

  for (const argument of node.arguments) {
    const object = dotted_path(argument)
    if (object) {
      wire_objects.add(object)
      continue
    }

    if (argument?.type !== 'ObjectExpression') continue
    for (const property of argument.properties) {
      const source =
        property.type === 'SpreadElement'
          ? dotted_path(property.argument)
          : property.type === 'ObjectProperty'
            ? dotted_path(property.value)?.split('.').slice(0, -1).join('.')
            : null
      if (source) wire_objects.add(source)
    }
  }
}

// Every entity id the reducer keys the store on, paired with the object it was
// read off and whether that same object was handed to one of the domain's wire
// factories IN THE SAME CALL.
//
// That last flag is the whole discriminator. `state.setIn(['items',
// t.team_id], create_trade(t))` reads an id off an object it simultaneously
// declares to be a trade, so `team_id` has to be a field a Trade carries -- and
// it is not, which is the defect that collapsed every trade onto one `undefined`
// key. Without the pairing the same line is indistinguishable from a store
// legitimately nested under a foreign entity's id.
export const store_keys_in_reducer = (reducer_path, factory_names) => {
  const keys = []

  traverse(parse_module(reducer_path), {
    CallExpression(node_path) {
      const callee = node_path.node.callee
      if (callee.type !== 'MemberExpression' || callee.computed) return
      if (callee.property.type !== 'Identifier') return

      const method = callee.property.name
      const call_arguments = node_path.node.arguments
      const [first_argument] = call_arguments
      if (!first_argument) return

      const reads = []
      if (KEYED_BY_FIRST_ARGUMENT.has(method)) {
        const read = read_entity_id(first_argument)
        if (read) reads.push(read)
      } else if (
        KEYED_BY_PATH_ARRAY.has(method) &&
        first_argument.type === 'ArrayExpression'
      ) {
        for (const element of first_argument.elements) {
          const read = read_entity_id(element)
          if (read) reads.push(read)
        }
      }
      if (!reads.length) return

      // Objects this call hands to one of the domain's wire factories.
      const wire_objects = new Set()
      for (const argument of call_arguments) {
        collect_wire_objects(argument, factory_names, wire_objects)
      }

      for (const read of reads) {
        keys.push({
          ...read,
          is_domain_wire_object: wire_objects.has(read.object),
          line: first_argument.loc.start.line
        })
      }
    }
  })

  return keys
}

// Every `app/core` domain that has BOTH a reducer and a Record. A domain with
// one and not the other is outside this gate by construction; the spec reports
// the roster rather than filtering it away silently.
export const record_backed_domains = (core_directory) =>
  fs
    .readdirSync(core_directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      directory: path.join(core_directory, entry.name)
    }))
    .filter(({ directory }) =>
      fs.existsSync(path.join(directory, 'reducer.js'))
    )
    .map((domain) => ({
      ...domain,
      reducer_path: path.join(domain.directory, 'reducer.js'),
      record_path: record_module_in(domain.directory)
    }))
    .filter((domain) => domain.record_path)
    .sort((a, b) => a.name.localeCompare(b.name))
