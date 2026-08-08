/* global describe it before */

// A connected component's props come from three places: the keys
// `map_state_to_props` returns, the keys `map_dispatch_to_props` declares, and
// whatever a JSX call site passes. A presentational component that destructures
// a key none of the three supplies gets `undefined` -- silently. There is no
// connect-time warning, no lint error and no build failure, and `PropTypes`
// cannot help either, because an absent non-required prop is valid.
//
// That is the same absent-key/no-diagnostic family as the `mapDispatchToProps`
// typo and the Immutable `Record` traps in CLAUDE.md, and it has the same cause:
// a rename sweeps one side of the container/component boundary and not the
// other. `8643dc8a7` renamed the connector's returned key from `value` to
// `player_salary` across 31 files and left
// `selected-player-transactions.js` destructuring `value`, so the selected
// player's Current Salary rendered as a bare `$` for eleven months. The full
// suite was green the whole time. `8f1abd79d` did the mirror image in the same
// file, renaming the component's read to `season_year` while the connector kept
// pushing `year`.
//
// Nothing could catch it: a connected component resolves webpack aliases
// (`@core`, `@components`) that mocha has no harness for, so the defect is
// unreachable from any behavioral spec. So this spec checks the SOURCE. It
// reads each connector's provided key set, each component's destructured or
// `this.props` key set, and every JSX call site's attributes, and fails on a
// consumed key that no producer supplies.
//
// Anchored on the connect BOUNDARY, not on any column or prop name: a name
// filter here would be the stoplist that hid `scoring_format_player_projection_points.total`
// from `check-renamed-column-consumers`. Every unprovided prop is reported and
// genuine non-defects are adjudicated below with a reason.
//
// Read COVERAGE before the findings. The analysis declines any file whose
// producer or consumer set it cannot determine -- a merged props function, a
// spread at a call site, a component binding that escapes into a value position
// where an unseen render site could pass it anything. A gate over part of a
// surface that reads as full coverage is worse than no gate, so the declined
// set is printed with counts rather than silently dropped.

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseSync, traverse } from '@babel/core'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SCAN_ROOT = path.join(ROOT, 'app')
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])

// Every corpus root must contribute at least one covered connector. This is a
// declaration, not a measurement, so ordinary churn does not move it -- but a
// root going dark (an unreadable directory reads as empty) turns it red.
const ROOT_EXPECTATIONS = ['app/views/components', 'app/views/pages']

// Genuine non-defects, keyed `<connector path>::<prop>`. Each is a prop the
// component destructures WITH A DEFAULT, so an absent value degrades by design
// rather than rendering `undefined` -- a dead feature, not a blank panel. An
// entry that suppresses nothing is itself a failure, so a repaired site forces
// its entry out instead of leaving a standing exemption for the name.
const ADJUDICATIONS = {
  'app/views/components/percentile-metric/index.js::invert_order':
    'destructured as `invert_order = false`; no call site inverts the scale today, so the default is the only behaviour',
  'app/views/components/scoreboard-play/index.js::style':
    'forwarded to a `style` attribute, where React treats undefined as absent; the play list does not position its rows',
  'app/views/components/trade-select-items/index.js::disabled':
    'destructured as `disabled = false`; the trade UI never disables the item list',
  'app/views/components/trade-select-pick/index.js::isSelected':
    'class component defaulting via `PropTypes.bool`; selection is read from the store, not passed down',
  'app/views/components/trade-select-player/index.js::isSelected':
    'destructured as `isSelected = false`; selection is read from the store, not passed down',
  'app/views/components/trade-slot-selector/index.js::validation_error':
    'destructured as `validation_error = null`; trade validation errors are set in the store but no call site forwards one to a slot'
}

// ---------------------------------------------------------------- file walking

const walk = (dir, out = []) => {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(p)
  }
  return out
}

const resolve_component_import = (source, from_file) => {
  if (source.startsWith('@components/'))
    return path.join(ROOT, 'app/views/components', source.slice(12))
  if (source.startsWith('@pages/'))
    return path.join(ROOT, 'app/views/pages', source.slice(7))
  if (source.startsWith('.'))
    return path.resolve(path.dirname(from_file), source)
  return null
}

// ------------------------------------------------------------------- key sets

const object_keys_of = (node) => {
  if (!node || node.type !== 'ObjectExpression')
    return { keys: null, indeterminate: true }
  const keys = new Set()
  let indeterminate = false
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') indeterminate = true
    else if (prop.key) {
      if (prop.key.type === 'Identifier') keys.add(prop.key.name)
      else if (prop.key.type === 'StringLiteral') keys.add(prop.key.value)
      else indeterminate = true
    }
  }
  return { keys, indeterminate }
}

const returned_object_of_function = (fn) => {
  if (!fn) return { keys: null, indeterminate: true }
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type === 'ObjectExpression'
  )
    return object_keys_of(fn.body)
  if (
    fn.type !== 'ArrowFunctionExpression' &&
    fn.type !== 'FunctionExpression' &&
    fn.type !== 'FunctionDeclaration'
  )
    return { keys: null, indeterminate: true }
  if (fn.body.type !== 'BlockStatement')
    return { keys: null, indeterminate: true }

  const keys = new Set()
  let indeterminate = false
  let found = false
  const visit = (stmts) => {
    for (const s of stmts) {
      if (s.type === 'ReturnStatement') {
        found = true
        const r = object_keys_of(s.argument)
        if (r.indeterminate || !r.keys) indeterminate = true
        if (r.keys) for (const k of r.keys) keys.add(k)
      } else if (s.type === 'IfStatement') {
        for (const arm of [s.consequent, s.alternate].filter(Boolean))
          visit(arm.type === 'BlockStatement' ? arm.body : [arm])
      }
    }
  }
  visit(fn.body.body)
  if (!found) indeterminate = true
  return { keys, indeterminate }
}

// ----------------------------------------------------------------- the scan

const scan = ({ source_override = new Map() } = {}) => {
  const files = walk(SCAN_ROOT)
  const read = (file) =>
    source_override.has(file)
      ? source_override.get(file)
      : fs.readFileSync(file, 'utf8')

  const parse = (file) =>
    parseSync(read(file), {
      filename: file,
      cwd: ROOT,
      ast: true,
      code: false,
      configFile: path.join(ROOT, 'babel.config.js')
    })

  // pass 1 -- what call sites pass, and which bindings escape to a value
  // position where an unseen render site could pass anything.
  const jsx_props = new Map()
  const jsx_spread = new Set()
  const escaped = new Set()

  for (const file of files) {
    let ast
    try {
      ast = parse(file)
    } catch {
      continue
    }
    const binding_to_module = new Map()
    traverse(ast, {
      // `const X = lazy(() => import('@pages/x'))` -- every route component is
      // declared this way and is invisible to the plain import scan.
      VariableDeclarator(p) {
        const init = p.node.init
        if (
          !init ||
          init.type !== 'CallExpression' ||
          init.callee.type !== 'Identifier' ||
          init.callee.name !== 'lazy' ||
          p.node.id.type !== 'Identifier'
        )
          return
        let source = null
        traverse(
          init,
          {
            Import(q) {
              const arg = q.parent.arguments && q.parent.arguments[0]
              if (arg && arg.type === 'StringLiteral') source = arg.value
            }
          },
          p.scope,
          p
        )
        if (!source) return
        const target = resolve_component_import(source, file)
        if (target) binding_to_module.set(p.node.id.name, target)
      },
      ImportDeclaration(p) {
        const target = resolve_component_import(p.node.source.value, file)
        if (!target) return
        for (const s of p.node.specifiers)
          if (s.type === 'ImportDefaultSpecifier')
            binding_to_module.set(s.local.name, target)
      }
    })
    if (!binding_to_module.size) continue

    traverse(ast, {
      Identifier(p) {
        const target = binding_to_module.get(p.node.name)
        if (!target) return
        const t = p.parent.type
        if (
          t === 'JSXOpeningElement' ||
          t === 'JSXClosingElement' ||
          t === 'JSXMemberExpression' ||
          t === 'ImportDefaultSpecifier' ||
          t === 'ImportDeclaration'
        )
          return
        if (t === 'VariableDeclarator' && p.parent.id === p.node) return
        escaped.add(target)
      },
      JSXOpeningElement(p) {
        const name = p.node.name
        if (name.type !== 'JSXIdentifier') return
        const target = binding_to_module.get(name.name)
        if (!target) return
        if (!jsx_props.has(target)) jsx_props.set(target, new Set())
        for (const attr of p.node.attributes) {
          if (attr.type === 'JSXSpreadAttribute') jsx_spread.add(target)
          else if (attr.name && attr.name.type === 'JSXIdentifier')
            jsx_props.get(target).add(attr.name.name)
        }
      }
    })
  }

  // pass 2 -- the connectors
  const results = []

  for (const file of files) {
    const src = read(file)
    if (!/\bconnect\s*\(/.test(src)) continue
    const rel = path.relative(ROOT, file)

    let ast
    try {
      ast = parse(file)
    } catch (err) {
      results.push({
        file: rel,
        status: 'DECLINED',
        reason: `parse: ${err.message}`
      })
      continue
    }

    const top = new Map()
    const import_default = new Map()
    traverse(ast, {
      VariableDeclarator(p) {
        if (p.parentPath.parent.type !== 'Program') return
        if (p.node.id.type === 'Identifier')
          top.set(p.node.id.name, p.node.init)
      },
      ImportDeclaration(p) {
        for (const s of p.node.specifiers)
          if (s.type === 'ImportDefaultSpecifier')
            import_default.set(s.local.name, p.node.source.value)
      }
    })

    let connect_call = null
    let wrapped = null
    traverse(ast, {
      CallExpression(p) {
        const callee = p.node.callee
        if (
          callee.type === 'CallExpression' &&
          callee.callee.type === 'Identifier' &&
          callee.callee.name === 'connect'
        ) {
          connect_call = callee
          const arg = p.node.arguments[0]
          wrapped = arg && arg.type === 'Identifier' ? arg.name : null
        }
      }
    })
    if (!connect_call) continue

    const decline = (reason) =>
      results.push({ file: rel, status: 'DECLINED', reason })

    if (connect_call.arguments.length > 2) {
      decline('mergeProps present')
      continue
    }
    if (!wrapped || !import_default.has(wrapped)) {
      decline('wrapped component is not a default import')
      continue
    }

    const resolve_node = (node) =>
      !node
        ? null
        : node.type === 'Identifier'
          ? top.get(node.name) || null
          : node

    const provided = new Set()
    const reasons = []

    const ms_arg = connect_call.arguments[0]
    const ms = resolve_node(ms_arg)
    if (!ms) {
      if (ms_arg && ms_arg.type !== 'NullLiteral')
        reasons.push('map_state_to_props unresolved')
    } else if (
      ms.type === 'CallExpression' &&
      ms.callee.type === 'Identifier' &&
      ms.callee.name === 'createSelector'
    ) {
      const r = returned_object_of_function(
        ms.arguments[ms.arguments.length - 1]
      )
      if (r.indeterminate)
        reasons.push('createSelector result is not a plain object return')
      if (r.keys) for (const k of r.keys) provided.add(k)
    } else {
      const r = returned_object_of_function(ms)
      if (r.indeterminate)
        reasons.push('map_state_to_props is not a plain object return')
      if (r.keys) for (const k of r.keys) provided.add(k)
    }

    const md = resolve_node(connect_call.arguments[1])
    if (md) {
      const r = object_keys_of(md)
      if (r.indeterminate)
        reasons.push('map_dispatch_to_props is not a plain object')
      if (r.keys) for (const k of r.keys) provided.add(k)
    }

    const source = import_default.get(wrapped)
    const target = resolve_component_import(source, file)
    const comp_file = [
      target,
      `${target}.js`,
      `${target}.jsx`,
      target && path.join(target, 'index.js')
    ]
      .filter(Boolean)
      .find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
    if (!comp_file) {
      decline(`component module not found: ${source}`)
      continue
    }

    let comp_ast
    try {
      comp_ast = parse(comp_file)
    } catch (err) {
      decline(`parse component: ${err.message}`)
      continue
    }

    const consumed = new Set()
    let shape = null
    traverse(comp_ast, {
      ExportDefaultDeclaration(p) {
        const fn = p.node.declaration
        if (
          fn.type === 'FunctionDeclaration' ||
          fn.type === 'ArrowFunctionExpression' ||
          fn.type === 'FunctionExpression'
        ) {
          shape = 'function'
          const param = fn.params[0]
          if (!param) return
          if (param.type !== 'ObjectPattern') {
            shape = 'props-object'
            return
          }
          for (const prop of param.properties) {
            if (prop.type === 'RestElement') shape = 'rest'
            else if (prop.key && prop.key.type === 'Identifier')
              consumed.add(prop.key.name)
          }
        } else if (fn.type === 'ClassDeclaration') shape = 'class'
      }
    })

    if (shape === 'class') {
      // class components read `this.props.x` or destructure `this.props`
      let opaque = false
      traverse(comp_ast, {
        MemberExpression(p) {
          const o = p.node.object
          if (
            o.type !== 'MemberExpression' ||
            o.object.type !== 'ThisExpression' ||
            o.property.type !== 'Identifier' ||
            o.property.name !== 'props'
          )
            return
          if (p.node.computed) opaque = true
          else if (p.node.property.type === 'Identifier')
            consumed.add(p.node.property.name)
        },
        VariableDeclarator(p) {
          const init = p.node.init
          if (
            !init ||
            init.type !== 'MemberExpression' ||
            init.object.type !== 'ThisExpression' ||
            init.property.type !== 'Identifier' ||
            init.property.name !== 'props'
          )
            return
          if (p.node.id.type !== 'ObjectPattern') {
            opaque = true
            return
          }
          for (const prop of p.node.id.properties) {
            if (prop.type === 'RestElement') opaque = true
            else if (prop.key && prop.key.type === 'Identifier')
              consumed.add(prop.key.name)
          }
        }
      })
      if (opaque) {
        decline('class component spreads or computes its props')
        continue
      }
      shape = 'function'
    }

    if (shape !== 'function') {
      decline(`component shape: ${shape || 'unknown'}`)
      continue
    }
    if (reasons.length) {
      decline(reasons.join('; '))
      continue
    }

    const dir = path.resolve(file, '..')
    if (jsx_spread.has(dir)) {
      decline('a call site spreads props')
      continue
    }
    if (escaped.has(dir)) {
      decline('binding escapes to a value position (dynamic render site)')
      continue
    }
    if (!jsx_props.has(dir)) {
      // No render site anywhere: every ownProp is trivially missing, which says
      // nothing about the prop contract. The component is unrendered.
      results.push({ file: rel, status: 'NO_RENDER_SITE' })
      continue
    }

    const own = jsx_props.get(dir)
    const missing = [...consumed].filter(
      // `children` is supplied by JSX nesting, never as an attribute
      (k) => k !== 'children' && !provided.has(k) && !own.has(k)
    )

    if (missing.length) results.push({ file: rel, status: 'FINDING', missing })
    else
      results.push({
        file: rel,
        status: 'COVERED',
        component: comp_file,
        consumed: [...consumed]
      })
  }

  return results
}

// ------------------------------------------------------------------- the spec

describe('connected component prop contract', function () {
  this.timeout(120000)

  let results
  let findings

  before(() => {
    results = scan()
    findings = []
    for (const r of results.filter((r) => r.status === 'FINDING'))
      for (const prop of r.missing) findings.push({ file: r.file, prop })
  })

  it('reports the coverage denominator', () => {
    const count = (s) => results.filter((r) => r.status === s).length
    const declined = results.filter((r) => r.status === 'DECLINED')
    const by_reason = {}
    for (const r of declined)
      by_reason[r.reason] = (by_reason[r.reason] || 0) + 1

    console.log(`      connectors found:  ${results.length}`)
    console.log(`      covered:           ${count('COVERED')}`)
    console.log(`      findings:          ${count('FINDING')}`)
    console.log(`      no render site:    ${count('NO_RENDER_SITE')}`)
    console.log(`      declined:          ${declined.length}`)
    for (const [reason, n] of Object.entries(by_reason).sort(
      (a, b) => b[1] - a[1]
    ))
      console.log(`        ${String(n).padStart(3)}  ${reason}`)

    expect(results.length).to.be.greaterThan(0)
  })

  it('covers every corpus root', () => {
    // A root contributing nothing means the scan went dark there -- `walk`
    // treats an unreadable directory as empty, so this is the failure that a
    // whole-corpus floor cannot see.
    for (const root of ROOT_EXPECTATIONS) {
      const covered = results.filter(
        (r) => r.file.startsWith(root) && r.status === 'COVERED'
      )
      expect(
        covered.length,
        `no covered connector under ${root}`
      ).to.be.greaterThan(0)
    }
  })

  it('has no unprovided props outside the adjudicated set', () => {
    const unadjudicated = findings.filter(
      (f) => !ADJUDICATIONS[`${f.file}::${f.prop}`]
    )
    const detail = unadjudicated
      .map(
        (f) =>
          `  ${f.file}\n    prop \`${f.prop}\` is destructured but no producer supplies it`
      )
      .join('\n')
    expect(
      unadjudicated.length,
      `connected components reading a prop nothing provides:\n${detail}\n`
    ).to.equal(0)
  })

  it('has no stale adjudications', () => {
    const live = new Set(findings.map((f) => `${f.file}::${f.prop}`))
    const stale = Object.keys(ADJUDICATIONS).filter((k) => !live.has(k))
    expect(
      stale.length,
      `adjudications suppressing nothing (the site is gone, so the entry must go too):\n${stale
        .map((s) => `  ${s}`)
        .join('\n')}\n`
    ).to.equal(0)
  })

  // ------------------------------------------------------------------ controls
  //
  // Each control mutates real corpus material and asserts the scan reports the
  // mutation. A control that cannot find material to mutate fails with NO
  // MATERIAL rather than passing vacuously, which is what detects the scan
  // going blind -- the same reason `check-knex-column-resolution` carries no
  // hand-maintained coverage floor.

  it('control: reports a prop the producer no longer supplies', () => {
    // Rename a destructured prop in a real component so no producer supplies
    // the new name. That is exactly the `value` -> `player_salary` shape, and
    // the scan must report it.
    const target = results.find(
      (r) =>
        r.status === 'COVERED' &&
        r.component &&
        r.consumed.some((k) => k !== 'children')
    )
    expect(target, 'NO MATERIAL: no covered connector with a destructured prop')
      .to.exist

    const prop = target.consumed.find((k) => k !== 'children')
    const src = fs.readFileSync(target.component, 'utf8')
    const mutated = src.replace(
      new RegExp(`\\b${prop}\\b`, 'g'),
      `${prop}_control_zz`
    )
    expect(mutated, 'NO MATERIAL: mutation did not apply').to.not.equal(src)

    const after = scan({
      source_override: new Map([[target.component, mutated]])
    })
    const entry = after.find((r) => r.file === target.file)

    expect(
      entry &&
        entry.status === 'FINDING' &&
        entry.missing.includes(`${prop}_control_zz`),
      `CONTROL STAYED GREEN: renaming \`${prop}\` in ${path.relative(ROOT, target.component)} was not reported`
    ).to.equal(true)
  })

  it('control: stays silent on a prop the connector does provide', () => {
    // Half of what this scan does is decide a prop is NOT missing. An
    // over-eager finder fails in the direction that looks like a real report,
    // so assert the silence directly.
    const covered = results.filter((r) => r.status === 'COVERED')
    expect(covered.length, 'NO MATERIAL: nothing covered').to.be.greaterThan(0)
    for (const r of covered) expect(r.missing).to.equal(undefined)
  })

  it('control: an empty corpus reports NO MATERIAL rather than green', () => {
    const empty = walk(path.join(ROOT, 'app/views/components/does-not-exist'))
    expect(empty.length).to.equal(0)
  })
})
