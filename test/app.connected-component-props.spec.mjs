/* global describe it before */

// The SPA's most expensive defect family is an absent prop. A connected
// component that reads a prop name its wiring never supplies gets `undefined`,
// and nothing anywhere reports it: not connect, not the build, not eslint, and
// not PropTypes, since an absent non-required prop is valid. CLAUDE.md records
// three shipped instances of the shape (a typo'd `mapDispatchToProps` creator,
// an undeclared Immutable `Record` key, a misspelled `Button` prop), and the
// login page carried two more until 58d26735d: it destructured `is_pending`
// and `auth_error` while its mapper supplied `isPending` and `authError`, so
// the page rendered no error text and no loading state, and it passed
// `is_loading` to a `Button` that takes `isLoading`.
//
// None of those can get a behavioral spec cheaply -- a connected component
// resolves webpack aliases (`@core/utils`, `@components/...`) that mocha has no
// harness for -- so this spec checks the SOURCE, in the shape
// test/roster.salary-consumer-contract.spec.mjs established for exactly that
// reason.
//
// It is deliberately narrow. A general "every destructured prop must be
// supplied by connect" assertion was measured against this tree first: 154
// findings, ~81% of them legitimate ownProps passed from a JSX call site, plus
// a family of dead optional defaults no caller passes. That gate would need an
// adjudication file and would still be blind to the 82 connected components
// written as classes. So instead each check below targets a NAMING-DRIFT
// mismatch, which has no legitimate instances by construction:
//
//   GATE 1  a prop the component reads that the wiring supplies under a
//           different SPELLING of the same name (is_pending / isPending). An
//           ownProps prop cannot collide case-insensitively with a mapper key
//           by accident; a half-finished snake_case rename is the only way to
//           get one. This is the repo's camelCase -> snake_case migration
//           passing over a call site, which is the documented recurring cause.
//
//   GATE 2  a prop passed to `Button` that `Button` does not declare. Measured
//           at 52 JSX sites with exactly one finding in the tree -- the live
//           `is_loading` defect -- and zero once it was fixed.
//
// Both are name-anchored on the pairing rather than on any single token, so
// neither can be quieted by renaming a variable, and both assert coverage
// floors so a resolution change that walks nothing fails rather than passing
// vacuously.

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseSync, traverse } from '@babel/core'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SCAN_DIRS = ['app/views/pages', 'app/views/components']
const BUTTON_MODULE = '@components/button'

// Coverage floors. These are not thresholds to tune -- they exist so that a
// change to the extraction that stops resolving anything fails loudly instead
// of reporting a clean gate over an empty scan set. Set well below the
// measured values (255 index files, 190 connected, 52 Button sites).
const MIN_INDEX_FILES = 200
const MIN_CONNECTED = 150
const MIN_PROP_CONSUMERS = 80
const MIN_BUTTON_SITES = 40

const parse_file = (file_path) => {
  const code = fs.readFileSync(file_path, 'utf8')
  return parseSync(code, {
    filename: file_path,
    cwd: ROOT,
    ast: true,
    code: false
  })
}

const walk = (dir, out = []) => {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(rel, out)
    } else if (entry.name.endsWith('.js')) {
      out.push(rel)
    }
  }
  return out
}

// `is_pending` and `isPending` are the same name under two conventions. Case
// and underscores are exactly what the repo's rename migration changes, so
// collapsing both is what makes a drifted pair visible.
const normalize_prop_name = (name) => name.toLowerCase().replace(/_/g, '')

const object_property_keys = (node) => {
  const keys = []
  let has_spread = false
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement' || prop.type === 'ObjectProperty') {
      if (prop.type === 'SpreadElement') {
        has_spread = true
        continue
      }
      if (prop.computed) {
        has_spread = true
        continue
      }
      const key = prop.key
      keys.push(key.type === 'Identifier' ? key.name : String(key.value))
    } else if (prop.type === 'ObjectMethod' && !prop.computed) {
      keys.push(prop.key.name)
    }
  }
  return { keys, has_spread }
}

// A mapper commonly carries an early `return {}` guard and returns the real
// object dozens of lines later, so the union of every returned object literal
// is the only correct read. Taking the first produced phantom findings.
const collect_returned_keys = (fn_node) => {
  const keys = new Set()
  let has_spread = false
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node.type === 'ObjectExpression') {
      const { keys: k, has_spread: s } = object_property_keys(node)
      k.forEach((name) => keys.add(name))
      if (s) has_spread = true
      return
    }
    if (
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionExpression'
    ) {
      visit(node.body)
      return
    }
    if (node.type === 'ReturnStatement') {
      visit(node.argument)
      return
    }
    if (node.type === 'BlockStatement') {
      visit(node.body)
      return
    }
    if (node.type === 'ConditionalExpression') {
      visit(node.consequent)
      visit(node.alternate)
      return
    }
    if (node.type === 'IfStatement') {
      visit(node.consequent)
      visit(node.alternate)
      return
    }
    for (const key of ['body', 'argument', 'expression', 'declarations']) {
      if (node[key]) visit(node[key])
    }
    if (node.type === 'VariableDeclarator') visit(node.init)
  }
  visit(fn_node.body)
  return { keys: [...keys], has_spread }
}

// `createSelector(a, b, (x, y) => ({...}))` -- the projector is the last
// argument. A bare mapper function is its own projector.
const resolve_mapper_function = (node, bindings) => {
  if (!node) return null
  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression'
  ) {
    return node
  }
  if (node.type === 'Identifier' && bindings.has(node.name)) {
    return resolve_mapper_function(bindings.get(node.name), bindings)
  }
  if (node.type === 'CallExpression') {
    const last = node.arguments[node.arguments.length - 1]
    return resolve_mapper_function(last, bindings)
  }
  return null
}

const destructured_names_from_pattern = (pattern) => {
  const names = []
  if (!pattern || pattern.type !== 'ObjectPattern') return names
  for (const prop of pattern.properties) {
    if (prop.type === 'ObjectProperty' && !prop.computed) {
      const key = prop.key
      names.push(key.type === 'Identifier' ? key.name : String(key.value))
    }
  }
  return names
}

describe('app connected-component props', function () {
  this.timeout(60 * 1000)

  const index_files = []
  const connected = []
  const gate_1_findings = []
  const gate_2_findings = []
  let button_sites = 0
  let prop_consumers = 0

  // A synthetic pair run through the same comparison the gate uses. If the
  // matcher stops recognising a drifted spelling, this fails rather than the
  // gate reporting a confident zero.
  const negative_control = () => {
    const supplied = new Set(
      ['isPending', 'authError'].map(normalize_prop_name)
    )
    const consumed = ['is_pending', 'auth_error', 'location']
    return consumed.filter(
      (name) => supplied.has(normalize_prop_name(name)) && !supplied.has(name)
    )
  }

  before(() => {
    const all_files = SCAN_DIRS.flatMap((dir) => walk(dir))

    for (const rel of all_files) {
      if (path.basename(rel) !== 'index.js') continue
      index_files.push(rel)

      const ast = parse_file(path.join(ROOT, rel))
      if (!ast) continue

      const bindings = new Map()
      const imports = new Map()
      let connect_call = null

      traverse(ast, {
        ImportDeclaration(p) {
          for (const spec of p.node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              imports.set(spec.local.name, p.node.source.value)
            }
          }
        },
        VariableDeclarator(p) {
          if (p.node.id.type === 'Identifier' && p.node.init) {
            bindings.set(p.node.id.name, p.node.init)
          }
        },
        CallExpression(p) {
          const callee = p.node.callee
          if (
            callee.type === 'CallExpression' &&
            callee.callee.type === 'Identifier' &&
            callee.callee.name === 'connect'
          ) {
            connect_call = { outer: p.node, inner: callee }
          }
        }
      })

      if (!connect_call) continue
      connected.push(rel)

      // Supplied set: mapper's returned keys plus the dispatch map's keys.
      const [msp_node, mdp_node] = connect_call.inner.arguments
      const mapper = resolve_mapper_function(msp_node, bindings)
      let supplied = []
      let unknowable = false

      if (mapper) {
        const { keys, has_spread } = collect_returned_keys(mapper)
        supplied = supplied.concat(keys)
        if (has_spread) unknowable = true
      } else if (msp_node && msp_node.type !== 'NullLiteral') {
        unknowable = true
      }

      let mdp = mdp_node
      if (mdp && mdp.type === 'Identifier' && bindings.has(mdp.name)) {
        mdp = bindings.get(mdp.name)
      }
      if (mdp && mdp.type === 'ObjectExpression') {
        const { keys, has_spread } = object_property_keys(mdp)
        supplied = supplied.concat(keys)
        if (has_spread) unknowable = true
      }

      // A mapper whose shape cannot be read statically cannot produce a
      // falsifiable finding, so it is skipped rather than reported.
      if (unknowable || !supplied.length) continue

      // Resolve the wrapped component to a sibling module.
      const wrapped = connect_call.outer.arguments[0]
      if (!wrapped || wrapped.type !== 'Identifier') continue
      const source = imports.get(wrapped.name)
      if (!source || !source.startsWith('./')) continue

      const component_path = path.join(path.dirname(rel), `${source.slice(2)}`)
      const candidates = [
        `${component_path}.js`,
        path.join(component_path, 'index.js')
      ]
      const resolved = candidates.find((c) => fs.existsSync(path.join(ROOT, c)))
      if (!resolved) continue

      const component_ast = parse_file(path.join(ROOT, resolved))
      if (!component_ast) continue

      // Consumed set: every destructured function parameter plus every
      // `this.props.x` read, so class components are covered too.
      const consumed = new Set()

      // ONLY A TOP-LEVEL FUNCTION RECEIVES PROPS. A nested one is a callback,
      // and its first parameter is whatever the caller passes -- a list item, an
      // event, an accumulator -- which has nothing to do with the component's
      // props. Harvesting every function's first parameter made
      // `user_leagues.map(({ league_id, name }) => ...)` read as a prop named
      // `league_id`, and the gate then reported drift against the `leagueId` the
      // wiring supplies. The names collided; the syntactic roles never did, which
      // is the trap this repo's own verification rule names.
      //
      // `getFunctionParent()` is null exactly for a function not enclosed by
      // another, which is where a component is declared however it is written --
      // a declaration, an export default, or a const initializer.
      const is_component_scope = (p) => p.getFunctionParent() === null
      traverse(component_ast, {
        ArrowFunctionExpression(p) {
          if (!is_component_scope(p)) return
          destructured_names_from_pattern(p.node.params[0]).forEach((n) =>
            consumed.add(n)
          )
        },
        FunctionDeclaration(p) {
          if (!is_component_scope(p)) return
          destructured_names_from_pattern(p.node.params[0]).forEach((n) =>
            consumed.add(n)
          )
        },
        FunctionExpression(p) {
          if (!is_component_scope(p)) return
          destructured_names_from_pattern(p.node.params[0]).forEach((n) =>
            consumed.add(n)
          )
        },
        MemberExpression(p) {
          const { object, property, computed } = p.node
          if (computed || property.type !== 'Identifier') return
          if (
            object.type === 'MemberExpression' &&
            object.object.type === 'ThisExpression' &&
            object.property.type === 'Identifier' &&
            object.property.name === 'props'
          ) {
            consumed.add(property.name)
          }
        },
        VariableDeclarator(p) {
          const { id, init } = p.node
          if (
            id.type === 'ObjectPattern' &&
            init &&
            init.type === 'MemberExpression' &&
            init.object.type === 'ThisExpression' &&
            init.property.type === 'Identifier' &&
            init.property.name === 'props'
          ) {
            destructured_names_from_pattern(id).forEach((n) => consumed.add(n))
          }
        }
      })

      if (!consumed.size) continue
      prop_consumers += 1

      const supplied_exact = new Set(supplied)
      const supplied_normalized = new Set(supplied.map(normalize_prop_name))

      for (const name of consumed) {
        if (supplied_exact.has(name)) continue
        if (!supplied_normalized.has(normalize_prop_name(name))) continue
        const drifted = supplied.find(
          (s) => normalize_prop_name(s) === normalize_prop_name(name)
        )
        gate_1_findings.push(
          `${rel} -> ${resolved}: reads \`${name}\`, wiring supplies \`${drifted}\``
        )
      }
    }

    // GATE 2 -- Button props.
    const button_ast_cache = parse_file(
      path.join(ROOT, 'app/views/components/button/button.js')
    )
    const declared = new Set()
    traverse(button_ast_cache, {
      AssignmentExpression(p) {
        const { left, right } = p.node
        if (
          left.type === 'MemberExpression' &&
          left.property.type === 'Identifier' &&
          left.property.name === 'propTypes' &&
          right.type === 'ObjectExpression'
        ) {
          object_property_keys(right).keys.forEach((k) => declared.add(k))
        }
      }
    })

    for (const rel of all_files) {
      const ast = parse_file(path.join(ROOT, rel))
      if (!ast) continue

      let button_local = null
      traverse(ast, {
        ImportDeclaration(p) {
          if (p.node.source.value !== BUTTON_MODULE) return
          for (const spec of p.node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              button_local = spec.local.name
            }
          }
        }
      })
      if (!button_local) continue

      traverse(ast, {
        JSXOpeningElement(p) {
          const name = p.node.name
          if (name.type !== 'JSXIdentifier' || name.name !== button_local) {
            return
          }
          button_sites += 1
          for (const attr of p.node.attributes) {
            if (attr.type !== 'JSXAttribute') continue
            const attr_name = attr.name.name
            if (declared.has(attr_name)) continue
            gate_2_findings.push(
              `${rel}:${attr.loc.start.line}  passes \`${attr_name}\`, Button declares ${[...declared].sort().join(', ')}`
            )
          }
        }
      })
    }
  })

  it('scans enough of the tree to be meaningful', () => {
    expect(index_files.length, 'index.js files scanned').to.be.at.least(
      MIN_INDEX_FILES
    )
    expect(connected.length, 'connected components found').to.be.at.least(
      MIN_CONNECTED
    )
    expect(
      prop_consumers,
      'components whose props were resolved'
    ).to.be.at.least(MIN_PROP_CONSUMERS)
    expect(button_sites, 'Button JSX sites found').to.be.at.least(
      MIN_BUTTON_SITES
    )
  })

  it('recognises a drifted spelling (negative control)', () => {
    expect(negative_control()).to.deep.equal(['is_pending', 'auth_error'])
  })

  it('supplies every prop a connected component reads under a drifted spelling', () => {
    expect(
      gate_1_findings,
      `\n${gate_1_findings.join('\n')}\n`
    ).to.have.lengthOf(0)
  })

  it('passes Button only props it declares', () => {
    expect(
      gate_2_findings,
      `\n${gate_2_findings.join('\n')}\n`
    ).to.have.lengthOf(0)
  })
})
