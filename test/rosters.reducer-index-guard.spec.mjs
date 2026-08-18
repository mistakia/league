/* global describe it before */

// Immutable resolves a NEGATIVE index to the last element, so `setIn(['players',
// -1, 'bid'], x)` is a successful write onto the wrong row rather than an error.
// `findIndex` returns -1 for a player the collection does not hold, which makes
// an unguarded `findIndex` result in an Immutable path a silent corruption of
// whichever element happens to be last.
//
// That is not hypothetical. A restricted free agency bid on a COMPETING team's
// player names a pid that is not on the bidding team's roster, so every such bid
// retagged the last roster row and repriced it at the bid amount -- league 1
// team 11's $34 bid on Drake London repriced Jameson Williams from $8 to $34,
// which took the dialog's cap-space term from $37 to $11 and its max bid from
// $60 to $34 (the difference is a $23 conditional release, which the dialog adds
// on top of cap space). Nothing failed: the server prices from its own roster
// and accepted the bid, so there was no error, no 4xx, and no signal anywhere.
// The reducer had carried the shape since 2020.
//
// The reducers cannot be imported from mocha -- they resolve `@core/app`,
// `@core/auction` and `@constants` through webpack aliases -- so this checks the
// source rather than the behavior, the same trade-off as
// `roster.salary-consumer-contract.spec.mjs`.
//
// Deliberately coarse on the guard: any `=== -1` / `!== -1` comparison against
// the binding anywhere in its enclosing function counts. Proving the guard
// dominates the write would need control-flow analysis, and the failure this
// gate exists to catch is an ABSENT guard, not a misplaced one.

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseSync, traverse } from '@babel/core'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SCAN_DIR = 'app/core'
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])

// Immutable's deep accessors. Each takes a key PATH as its first argument, and
// a negative number anywhere in that path indexes from the end.
const PATH_METHODS = new Set([
  'getIn',
  'setIn',
  'mergeIn',
  'mergeDeepIn',
  'updateIn',
  'deleteIn',
  'removeIn',
  'hasIn'
])

const collect_source_files = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect_source_files(full, out)
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const parse_source = (file, code) =>
  parseSync(code, {
    filename: file,
    configFile: false,
    babelrc: false,
    sourceType: 'module',
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]]
  })

const is_find_index_call = (node) =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'findIndex'

const is_negative_one = (node) =>
  node?.type === 'UnaryExpression' &&
  node.operator === '-' &&
  node.argument.type === 'NumericLiteral' &&
  node.argument.value === 1

// The first argument of an Immutable path method, when it is written inline as
// an array literal. A path built elsewhere is out of reach and counted as such.
const path_array_of = (node_path) => {
  const array = node_path.findParent((p) => p.isArrayExpression())
  if (!array) return null

  const call = array.parentPath
  if (!call.isCallExpression()) return null
  if (call.node.arguments[0] !== array.node) return null

  const callee = call.node.callee
  if (
    callee.type !== 'MemberExpression' ||
    callee.property.type !== 'Identifier'
  )
    return null
  return PATH_METHODS.has(callee.property.name) ? callee.property.name : null
}

const scan_ast = (relative_file, ast) => {
  const findings = []
  // Bindings assigned from a `findIndex` call, keyed by name, carrying the
  // enclosing function so the guard search has a scope to look in.
  const index_bindings = []

  traverse(ast, {
    VariableDeclarator(node_path) {
      const { id, init } = node_path.node
      if (id.type !== 'Identifier' || !is_find_index_call(init)) return
      index_bindings.push({
        name: id.name,
        scope_path: node_path.getFunctionParent() || node_path.scope.path,
        line: node_path.node.loc.start.line
      })
    }
  })

  const has_guard = (binding) => {
    let guarded = false
    binding.scope_path.traverse({
      BinaryExpression(node_path) {
        if (guarded) return
        const { operator, left, right } = node_path.node
        if (operator !== '===' && operator !== '!==') return
        const names = [left, right].filter((n) => n.type === 'Identifier')
        const negatives = [left, right].filter(is_negative_one)
        if (names.some((n) => n.name === binding.name) && negatives.length) {
          guarded = true
        }
      }
    })
    return guarded
  }

  const guarded_by_name = new Map()
  for (const binding of index_bindings) {
    guarded_by_name.set(binding.name, has_guard(binding))
  }

  traverse(ast, {
    // An identifier holding a findIndex result, used as a path element.
    Identifier(node_path) {
      const { name } = node_path.node
      if (!guarded_by_name.has(name) || guarded_by_name.get(name)) return
      if (node_path.parentPath.isVariableDeclarator()) return

      const method = path_array_of(node_path)
      if (!method) return

      findings.push(
        `${relative_file}:${node_path.node.loc.start.line} ` +
          `\`${name}\` holds a findIndex result and is used in \`${method}\` with no -1 guard`
      )
    },

    // A findIndex call written directly into the path, which no guard can reach.
    CallExpression(node_path) {
      if (!is_find_index_call(node_path.node)) return
      const method = path_array_of(node_path)
      if (!method) return

      findings.push(
        `${relative_file}:${node_path.node.loc.start.line} ` +
          `inline findIndex used in \`${method}\` -- a -1 result writes to the last element`
      )
    }
  })

  return { findings, binding_count: index_bindings.length }
}

const scan_source = (relative_file, code) =>
  scan_ast(relative_file, parse_source(path.join(ROOT, relative_file), code))

describe('immutable path index guards', function () {
  this.timeout(60 * 1000)

  const findings = []
  const bindings_by_file = new Map()

  before(function () {
    for (const file of collect_source_files(path.join(ROOT, SCAN_DIR))) {
      const relative_file = path.relative(ROOT, file)
      const result = scan_source(relative_file, fs.readFileSync(file, 'utf8'))
      findings.push(...result.findings)
      if (result.binding_count) {
        bindings_by_file.set(relative_file, result.binding_count)
      }
    }
  })

  it('resolves findIndex bindings in the reducers that carry them', function () {
    // The scan is only as good as its collector, and a collector that stops
    // matching reports zero findings over a broken corpus. Anchored on the file
    // the defect lived in rather than on a total, so ordinary churn moves
    // nothing.
    expect(
      bindings_by_file.get('app/core/rosters/reducer.js')
    ).to.be.greaterThan(0)
  })

  it('no findIndex result reaches an Immutable path unguarded', function () {
    expect(findings).to.deep.equal([])
  })

  // Negative controls. Two of the four assert SILENCE, because half of what the
  // scan does is decide a token is not a defect.
  describe('controls', function () {
    it('reports an unguarded binding', function () {
      const { findings: control } = scan_source(
        'app/core/control.js',
        `export const r = (state, players, pid) => {
           const index = players.findIndex((p) => p.pid === pid)
           return state.setIn(['players', index, 'tag'], 4)
         }`
      )
      expect(control).to.have.lengthOf(1)
      expect(control[0]).to.include('setIn')
    })

    it('reports an inline findIndex in a path', function () {
      const { findings: control } = scan_source(
        'app/core/control.js',
        `export const r = (state, pid) =>
           state.setIn([state.picks.findIndex((i) => i.draft_pick_id === pid), 'pid'], pid)`
      )
      expect(control).to.have.lengthOf(1)
      expect(control[0]).to.include('inline findIndex')
    })

    it('stays silent on a guarded binding', function () {
      const { findings: control } = scan_source(
        'app/core/control.js',
        `export const r = (state, players, pid) => {
           const index = players.findIndex((p) => p.pid === pid)
           if (index === -1) return state
           return state.setIn(['players', index, 'tag'], 4)
         }`
      )
      expect(control).to.deep.equal([])
    })

    it('stays silent on a findIndex result used outside a path', function () {
      const { findings: control } = scan_source(
        'app/core/control.js',
        `export const r = (players, pid) => {
           const index = players.findIndex((p) => p.pid === pid)
           return index > 0 ? players.get(index) : null
         }`
      )
      expect(control).to.deep.equal([])
    })
  })
})
