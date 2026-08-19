// Cross-module object-key seam measurement — ADVISORY, never a gate.
//
// A "seam" is a place where one module produces an object and another module
// consumes specific keys from it. Renaming a key on the producing side yields
// `undefined` on the consuming side with no error, because JavaScript property
// access on a missing key is silent. This is the same mechanism that lets an
// Immutable Record drop an undeclared key and lets an interpolated column name
// write NULLs — a missing name is quiet, not loud.
//
// Usage:
//   node db/tools/measure-cross-module-seams.mjs             # summary
//   node db/tools/measure-cross-module-seams.mjs --json      # + every seam
//   node db/tools/measure-cross-module-seams.mjs --coverage  # + ts-check coverage
//
// VERSIONED HERE ON PURPOSE. This tool was written for the Stage-1 measurement
// and lived in a gitignored scratch directory, which makes every number read
// off it unreproducible the moment the directory is cleared -- and this repo has
// already paid for a conformance count taken against an instrument nobody could
// re-run. It lives in db/tools/ because that directory's rule is exactly its
// shape: durable, and carrying no verdict wired to a run.
//
// It emits COUNTS, never a verdict, and must not be wired into CI. The number
// it reports is large and expected to stay large; it exists to decide where
// type annotations pay, not to fail a build.
//
// SHAPES COUNTED (the total):
//   1. Destructuring the return of an imported function.
//   2. Destructured params on an exported function, kept only when another
//      scanned module actually imports that export.
//   3. Property reads off the return of an imported function, including the
//      two-step `const r = fn(); r.key` form.
//
// SHAPE COUNTED SEPARATELY (never folded into the total):
//   4. Destructured params on an INLINE CALLBACK. The producer is a local
//      value, so the seam is real but its origin is not traced here. Reported
//      on its own line for exactly that reason.
//
// KNOWN BLIND SPOTS — read before trusting a number from this tool:
//   * Shapes 1-3 were, as originally specified, blind to the one known live
//     defect this scan was built to find: the destructure at
//     scripts/process-projections-for-league-format.mjs:124 and :128. That
//     instance is shape 4, which is why shape 4 exists as a separate count.
//     A scan that reports a total without reproducing a known-present instance
//     is unvalidated, not clean.
//   * Knex builder chains are excluded deliberately: `db('t').where(...)` is a
//     method call in callee position and fails loudly, so it is not a silent
//     seam. Counting them roughly triples the total and measures nothing.
//   * `import { x } from '...'` is excluded — ESM named imports are static and
//     fail at load time.
//   * Shape 3's two-step form only follows single-assignment identifiers within
//     one file; a rebound name is dropped.
//   * `import * as x` marks the whole target file as imported, which is
//     slightly permissive for shape 2.
//   * Reads through spreads, array elements or function boundaries are not
//     traced at all.
//
// Always read `denominator` in the output. A count without the number of files
// it was measured over is not a measurement.
import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
const traverse = _traverse.default || _traverse

const ROOT = path.resolve(process.cwd())
const ROOTS = [
  'libs-server',
  'libs-shared',
  'api',
  'scripts',
  'jobs',
  'app/core'
]

const IMPORT_ALIASES = {
  '#config': 'config/index.mjs',
  '#db': 'db/index.mjs',
  '#api': 'api/index.mjs',
  '#libs-server': 'libs-server/index.mjs',
  '#libs-shared': 'libs-shared/index.mjs',
  '#constants': 'libs-shared/constants/index.mjs'
}
const PREFIX_ALIASES = [
  ['#db/', 'db/'],
  ['#api/', 'api/'],
  ['#test/', 'test/'],
  ['#libs-server/', 'libs-server/'],
  ['#libs-shared/', 'libs-shared/'],
  ['#constants/', 'libs-shared/constants/'],
  ['#scripts/', 'scripts/'],
  ['#jobs/', 'jobs/'],
  ['#league-import/', 'league-import/'],
  ['#private/', 'private/'],
  ['#app/', 'app/']
]

const walk = (dir, out = []) => {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue
      walk(p, out)
    } else if (/\.(mjs|js|jsx)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const parse_file = (file) => {
  const code = fs.readFileSync(file, 'utf8')
  return parse(code, {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    plugins: ['jsx', 'classProperties', 'objectRestSpread', 'dynamicImport']
  })
}

// ---- resolve a module specifier to a repo-relative file path (or null if external)
const resolve_spec = (spec, from_file) => {
  let rel = null
  if (spec.startsWith('.')) {
    rel = path.relative(ROOT, path.resolve(path.dirname(from_file), spec))
  } else if (IMPORT_ALIASES[spec]) {
    rel = IMPORT_ALIASES[spec]
  } else {
    for (const [pre, target] of PREFIX_ALIASES) {
      if (spec.startsWith(pre)) {
        rel = target + spec.slice(pre.length)
        break
      }
    }
  }
  if (!rel) return null // bare package -> external, not a cross-module seam we count
  if (rel.startsWith('..')) return null
  const cands = [rel, rel + '.mjs', rel + '.js', path.join(rel, 'index.mjs')]
  for (const c of cands) {
    try {
      if (fs.statSync(path.join(ROOT, c)).isFile()) return c
    } catch {}
  }
  return rel
}

// ---- barrel resolution: map barrel file -> { exported_name: { file, orig } }
const barrel_cache = new Map()
const barrel_map = (barrel_rel, depth = 0) => {
  if (barrel_cache.has(barrel_rel)) return barrel_cache.get(barrel_rel)
  const map = {}
  barrel_cache.set(barrel_rel, map)
  if (depth > 3) return map
  const abs = path.join(ROOT, barrel_rel)
  let ast
  try {
    ast = parse_file(abs)
  } catch {
    return map
  }
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.source) {
      const target = resolve_spec(node.source.value, abs)
      if (!target) continue
      for (const s of node.specifiers) {
        if (s.type === 'ExportSpecifier') {
          map[s.exported.name || s.exported.value] = {
            file: target,
            orig: s.local.name || s.local.value
          }
        } else if (s.type === 'ExportNamespaceSpecifier') {
          map[s.exported.name] = { file: target, orig: null }
        }
      }
    }
  }
  return map
}

const is_barrel = (rel) =>
  /(^|\/)index\.mjs$/.test(rel) || /(^|\/)index\.js$/.test(rel)

// -> { file, name }
const producer_for = (module_rel, imported_name) => {
  if (module_rel && is_barrel(module_rel) && imported_name) {
    const m = barrel_map(module_rel)
    if (m[imported_name])
      return { file: m[imported_name].file, name: m[imported_name].orig }
  }
  return { file: module_rel, name: imported_name }
}

// ---- scan
const files = []
for (const r of ROOTS) files.push(...walk(path.join(ROOT, r)))
files.sort()

const seams = [] // {shape, file, line, producer, keys}
const shape4 = [] // {file, line, keys} -- never folded into `seams`
const shape2_candidates = []
const imported_targets = new Set() // "file::exportname" imported by some OTHER file
const namespace_imported_files = new Set()
const parse_errors = []

for (const abs of files) {
  const rel = path.relative(ROOT, abs)
  let ast
  try {
    ast = parse_file(abs)
  } catch (err) {
    parse_errors.push(rel + ': ' + err.message)
    continue
  }

  // local identifier -> { module, imported }  (value imports only)
  const imports = new Map()
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue
    if (node.importKind === 'type') continue
    const module_rel = resolve_spec(node.source.value, abs)
    if (!module_rel) continue // external package
    for (const s of node.specifiers) {
      const imported_name =
        s.type === 'ImportSpecifier'
          ? s.imported.name || s.imported.value
          : s.type === 'ImportDefaultSpecifier'
            ? 'default'
            : null
      if (imported_name == null) {
        const t = producer_for(module_rel, null)
        if (t.file !== rel) namespace_imported_files.add(t.file)
      } else {
        const t = producer_for(module_rel, imported_name)
        if (t.file !== rel)
          imported_targets.add(t.file + '::' + (t.name || imported_name))
      }
      if (s.type === 'ImportSpecifier') {
        imports.set(s.local.name, {
          module: module_rel,
          imported: s.imported.name || s.imported.value
        })
      } else if (s.type === 'ImportDefaultSpecifier') {
        imports.set(s.local.name, { module: module_rel, imported: 'default' })
      } else if (s.type === 'ImportNamespaceSpecifier') {
        imports.set(s.local.name, {
          module: module_rel,
          imported: null,
          namespace: true
        })
      }
    }
  }

  const callee_producer = (callee) => {
    if (callee.type === 'Identifier') {
      const i = imports.get(callee.name)
      if (!i) return null
      return producer_for(i.module, i.imported)
    }
    if (callee.type === 'MemberExpression' && !callee.computed) {
      const obj = callee.object
      if (obj.type === 'Identifier') {
        const i = imports.get(obj.name)
        if (!i) return null
        return producer_for(
          i.module,
          i.namespace ? callee.property.name : i.imported
        )
      }
    }
    return null
  }

  const unwrap = (n) =>
    n && (n.type === 'AwaitExpression' || n.type === 'TSNonNullExpression')
      ? unwrap(n.argument)
      : n

  const call_bindings = new Map()
  const rebound = new Set()

  const record = (shape, node, producer, keys) => {
    if (!producer || !producer.file) return
    if (producer.file === rel) return // same-module, not cross-module
    seams.push({
      shape,
      file: rel,
      line: node.loc.start.line,
      producer: producer.file,
      keys
    })
  }

  const pattern_keys = (pat) =>
    pat.properties
      .filter((p) => p.type === 'ObjectProperty')
      .map((p) => (p.key.name != null ? p.key.name : p.key.value))

  traverse(ast, {
    VariableDeclarator(p) {
      const init = unwrap(p.node.init)
      if (!init) return
      // shape 1
      if (
        p.node.id.type === 'ObjectPattern' &&
        init.type === 'CallExpression'
      ) {
        record(1, p.node, callee_producer(init.callee), pattern_keys(p.node.id))
      }
      // two-step binding for shape 3
      if (p.node.id.type === 'Identifier' && init.type === 'CallExpression') {
        const producer = callee_producer(init.callee)
        const name = p.node.id.name
        if (call_bindings.has(name) || rebound.has(name)) {
          call_bindings.delete(name)
          rebound.add(name)
        } else if (producer && producer.file && producer.file !== rel) {
          call_bindings.set(name, { producer, line: p.node.loc.start.line })
        }
      }
    },
    MemberExpression(p) {
      if (p.node.computed) return
      // a method CALL fails loudly, so it is not a silent seam
      if (p.parent.type === 'CallExpression' && p.parent.callee === p.node)
        return
      const obj = unwrap(p.node.object)
      if (obj.type === 'CallExpression') {
        record(3, p.node, callee_producer(obj.callee), [p.node.property.name])
      }
    },
    // shape 4 — destructured param on an inline callback. Counted separately
    // because the producing value is local and its origin is not traced.
    'ArrowFunctionExpression|FunctionExpression'(p) {
      const is_inline_callback =
        p.parent.type === 'CallExpression' &&
        p.parent.arguments.includes(p.node)
      if (!is_inline_callback) return
      const pats = (p.node.params || []).filter(
        (x) => x.type === 'ObjectPattern'
      )
      if (!pats.length) return
      shape4.push({
        file: rel,
        line: p.node.loc.start.line,
        keys: pats.flatMap(pattern_keys)
      })
    }
  })

  // shape 3 two-step: property reads off identifiers bound to an imported call
  if (call_bindings.size) {
    const seen = new Set()
    traverse(ast, {
      MemberExpression(p) {
        if (p.node.computed) return
        if (p.parent.type === 'CallExpression' && p.parent.callee === p.node)
          return
        const obj = p.node.object
        if (obj.type !== 'Identifier') return
        const b = call_bindings.get(obj.name)
        if (!b) return
        const key = obj.name + '.' + p.node.property.name
        if (seen.has(key)) return
        seen.add(key)
        record(3, p.node, b.producer, [p.node.property.name])
      },
      VariableDeclarator(p) {
        if (
          p.node.id.type === 'ObjectPattern' &&
          p.node.init &&
          p.node.init.type === 'Identifier'
        ) {
          const b = call_bindings.get(p.node.init.name)
          if (!b) return
          for (const k of pattern_keys(p.node.id)) {
            const key = p.node.init.name + '.' + k
            if (seen.has(key)) continue
            seen.add(key)
            record(3, p.node, b.producer, [k])
          }
        }
      }
    })
  }

  // shape 2: exported functions with destructured params
  const handle_exported_fn = (node, decl_node, export_name) => {
    if (!node) return
    if (
      node.type !== 'FunctionDeclaration' &&
      node.type !== 'FunctionExpression' &&
      node.type !== 'ArrowFunctionExpression'
    )
      return
    const pats = (node.params || []).filter((x) => x.type === 'ObjectPattern')
    if (!pats.length) return
    shape2_candidates.push({
      shape: 2,
      file: rel,
      line: (decl_node || node).loc.start.line,
      producer: rel,
      export_name,
      keys: pats.flatMap(pattern_keys)
    })
  }

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const d = node.declaration
      if (d.type === 'FunctionDeclaration')
        handle_exported_fn(d, node, d.id && d.id.name)
      else if (d.type === 'VariableDeclaration') {
        for (const v of d.declarations)
          handle_exported_fn(unwrap(v.init), node, v.id && v.id.name)
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      handle_exported_fn(unwrap(node.declaration), node, 'default')
    }
  }
}

// ---- shape 2: keep only functions actually imported by another scanned module
const shape2_kept = shape2_candidates.filter(
  (c) =>
    imported_targets.has(c.producer + '::' + c.export_name) ||
    namespace_imported_files.has(c.producer)
)
const shape2_dropped = shape2_candidates.length - shape2_kept.length
seams.push(...shape2_kept)

// ---- report
const root_of = (f) =>
  ROOTS.find((r) => f === r || f.startsWith(r + '/')) || 'other'

const by = (arr, fn) => {
  const m = new Map()
  for (const x of arr) m.set(fn(x), (m.get(fn(x)) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

const out = {
  denominator: {
    files_scanned: files.length,
    parse_errors: parse_errors.length,
    files_by_root: Object.fromEntries(
      by(
        files.map((f) => root_of(path.relative(ROOT, f))),
        (x) => x
      )
    )
  },
  total: seams.length,
  shape2_candidates: shape2_candidates.length,
  shape2_dropped_no_cross_module_importer: shape2_dropped,
  by_shape: Object.fromEntries(by(seams, (s) => 'shape_' + s.shape)),
  by_root: Object.fromEntries(by(seams, (s) => root_of(s.file))),
  by_root_shape: Object.fromEntries(
    by(seams, (s) => root_of(s.file) + '|shape_' + s.shape)
  ),
  // Reported apart from `total` on purpose: the producing value is local, so
  // these are real seams whose origin this tool does not trace. The one known
  // live defect it was validated against is in here, not in `total`.
  shape4_inline_callback_params: {
    total: shape4.length,
    by_root: Object.fromEntries(by(shape4, (s) => root_of(s.file)))
  },
  distinct_producers: new Set(seams.map((s) => s.producer)).size,
  distinct_consumer_files: new Set(seams.map((s) => s.file)).size,
  top_producers_by_seams: by(seams, (s) => s.producer).slice(0, 15),
  top_producers_by_consumers: (() => {
    const m = new Map()
    for (const s of seams) {
      if (!m.has(s.producer)) m.set(s.producer, new Set())
      m.get(s.producer).add(s.file)
    }
    return [...m.entries()]
      .map(([p, set]) => [p, set.size])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
  })(),
  parse_error_list: parse_errors
}

// ---- self-validation against a known-present instance.
//
// A scan that reports a total without reproducing a defect known to be in the
// corpus is unvalidated, not clean. This exact instance was invisible to
// shapes 1-3 and is the reason shape 4 is measured at all, so it is the right
// control: if a future edit breaks shape 4 detection, this goes to NOT FOUND
// while every other number in the output still looks plausible.
const KNOWN_INSTANCE = {
  file: 'scripts/process-projections-for-league-format.mjs',
  lines: [124, 128],
  shape: 4
}
const known_hits = shape4.filter(
  (s) => s.file === KNOWN_INSTANCE.file && KNOWN_INSTANCE.lines.includes(s.line)
)
out.self_validation = {
  known_instance: `${KNOWN_INSTANCE.file}:${KNOWN_INSTANCE.lines.join(',')} (shape ${KNOWN_INSTANCE.shape})`,
  found: known_hits.length > 0,
  matched_lines: known_hits.map((s) => s.line)
}

// Coverage against the //@ts-check adoption list. A seam is COVERED when its
// producing module is type-checked: the producer is where the object's shape is
// declared, so that is the end at which a renamed key becomes an error rather
// than an undefined. Reported as a fraction of the whole seam population,
// because a raw count of adopted files says nothing about reach -- the
// distribution is deliberately head-heavy, and the point of adopting the top
// producers is that a few files carry a disproportionate share.
if (process.argv.includes('--coverage')) {
  const adoption_path = path.join(ROOT, 'db/gates/ts-check-adoption.json')
  const adopted = new Set(
    JSON.parse(fs.readFileSync(adoption_path, 'utf8')).files
  )
  const covered = seams.filter((s) => adopted.has(s.producer))
  const by_producer = {}
  for (const s of covered) {
    by_producer[s.producer] = (by_producer[s.producer] || 0) + 1
  }
  const uncovered = {}
  for (const s of seams) {
    if (!adopted.has(s.producer)) {
      uncovered[s.producer] = (uncovered[s.producer] || 0) + 1
    }
  }
  out.ts_check_coverage = {
    adopted_files: adopted.size,
    distinct_producers: out.distinct_producers,
    seams_total: seams.length,
    seams_with_checked_producer: covered.length,
    percent_covered: Number(((100 * covered.length) / seams.length).toFixed(1)),
    by_adopted_producer: Object.fromEntries(
      Object.entries(by_producer).sort((a, b) => b[1] - a[1])
    ),
    top_uncovered_producers: Object.fromEntries(
      Object.entries(uncovered)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
    )
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...out, seams, shape4 }, null, 1))
} else {
  console.log(JSON.stringify(out, null, 1))
}

if (!out.self_validation.found) {
  console.error(
    '\nSELF-VALIDATION FAILED: the known-present instance at ' +
      `${KNOWN_INSTANCE.file} was not found. Every count above is suspect — ` +
      'the scan has lost the ability to see the shape it was built for.\n' +
      'If that file legitimately changed, re-anchor KNOWN_INSTANCE on another ' +
      'verified instance rather than deleting the check.'
  )
}
