/**
 * Resolving a call's callee to the ONE function node it actually names.
 *
 * WHY THIS FILE EXISTS. Two gates here judge a call against its callee's own
 * source — `check-call-site-param-contracts` on the ARGUMENT side, and
 * `check-returned-property-reads` on the RETURN side — and both live or die on
 * the same property: the callee is reached through the IMPORT EDGE, never
 * matched by NAME. A name-keyed sweep of this tree runs about 50% false
 * positives, because it defines `download_csv`, `import_for_year` and `run` as
 * unrelated locals in several importers on different vocabularies.
 *
 * That resolver was written once, inside the argument-side gate. Copying it for
 * the return-side gate would have made the design choice a convention held in
 * two places, where weakening one copy leaves the other's decoy control green.
 * It is one module with one set of callers instead.
 *
 * `repo_root` is resolved here the way every scanner under `db/` resolves it,
 * and the depth is load-bearing: moved one level, a caller reads zero files in
 * every root and exits 0 over nothing.
 */

import path from 'path'
import { fileURLToPath } from 'url'

import { parseSync as parse_js } from '@babel/core'

export const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

/**
 * The skip reasons the resolution half produces. A gate merges these into its
 * own table so every reason it can emit is printed with prose beside it.
 */
export const RESOLUTION_SKIP_REASONS = {
  member_callee: 'callee is a member expression (namespace or method call)',
  unresolved_specifier:
    'import specifier did not resolve to a file in this repo',
  unresolved_export: 'export not found in the resolved module',
  re_export_depth: 're-export chain deeper than one hop'
}

export function* walk_ast(node, parent = null) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) yield* walk_ast(child, parent)
    return
  }
  if (typeof node.type !== 'string') return
  yield { node, parent }
  for (const key of Object.keys(node)) {
    if (
      key === 'loc' ||
      key === 'leadingComments' ||
      key === 'trailingComments'
    ) {
      continue
    }
    yield* walk_ast(node[key], node)
  }
}

export const is_function_node = (node) =>
  node?.type === 'ArrowFunctionExpression' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'FunctionDeclaration'

/**
 * Parse one module, memoised per run. The reader is a PARAMETER with a default
 * rather than a direct `fs` call: an ESM namespace object is frozen, so a
 * control that monkeypatches `fs.readFileSync` silently does nothing and then
 * reports a green it never earned.
 *
 * @param {object} params
 * @param {string} params.file absolute path
 * @param {Map<string, object>} params.cache
 * @param {(file: string) => string} params.read_file
 * @returns {{ program: object }|null} null when the file is unreadable or
 *   unparseable, which is a skip and never a finding
 */
export const parse_module = ({ file, cache, read_file }) => {
  if (cache.has(file)) return cache.get(file)

  let parsed = null
  try {
    const source = read_file(file)
    const ast = parse_js(source, {
      sourceType: 'module',
      configFile: false,
      babelrc: false,
      filename: file
    })
    parsed = { program: ast.program }
  } catch {
    parsed = null
  }

  cache.set(file, parsed)
  return parsed
}

/**
 * Resolve an import specifier to an absolute file in this repo.
 *
 * Handles the two forms this tree uses: a relative specifier, and a `#` subpath
 * from the package.json `imports` map. A bare package specifier resolves to
 * node_modules and is not a repo file, so it returns null and the call site is
 * skipped rather than judged.
 *
 * @param {object} params
 * @param {string} params.specifier
 * @param {string} params.from_file absolute path of the importing module
 * @param {object} params.imports_map the package.json `imports` field
 * @param {(file: string) => boolean} params.file_exists
 * @returns {string|null} absolute path, or null when it is not a repo file
 */
export const resolve_specifier = ({
  specifier,
  from_file,
  imports_map,
  file_exists
}) => {
  let relative = null

  if (specifier.startsWith('.')) {
    relative = path.relative(
      repo_root,
      path.resolve(path.dirname(from_file), specifier)
    )
  } else if (specifier.startsWith('#')) {
    const exact = imports_map[specifier]
    if (exact) {
      relative = exact
    } else {
      // Longest matching prefix wins, so `#private/libs-server` is not
      // shadowed by `#private/*`.
      let best = null
      for (const key of Object.keys(imports_map)) {
        if (!key.endsWith('/*')) continue
        const prefix = key.slice(0, -1)
        if (!specifier.startsWith(prefix)) continue
        if (best && best.prefix.length >= prefix.length) continue
        best = { prefix, target: imports_map[key] }
      }
      if (best) {
        relative = best.target.replace('*', specifier.slice(best.prefix.length))
      }
    }
  }

  if (relative === null) return null

  const absolute = path.resolve(repo_root, relative)
  return file_exists(absolute) ? absolute : null
}

/**
 * The local bindings a module imports, keyed by the local name.
 *
 * @param {object} params
 * @param {object} params.program
 * @returns {Map<string, { specifier: string, imported: string }>} `imported` is
 *   the name in the SOURCE module, or `default`
 */
export const collect_import_bindings = ({ program }) => {
  const bindings = new Map()

  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        bindings.set(specifier.local.name, {
          specifier: statement.source.value,
          imported: 'default'
        })
      } else if (specifier.type === 'ImportSpecifier') {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        bindings.set(specifier.local.name, {
          specifier: statement.source.value,
          imported
        })
      }
      // A namespace import binds an object, so a call through it is a member
      // expression and is skipped at the call site rather than here.
    }
  }

  return bindings
}

/**
 * Every top-level function a module declares under its own name, whether or not
 * it is exported.
 *
 * This is the SAME-MODULE half of the resolution, and it is an edge in exactly
 * the sense the import edge is: the name is bound to one definition the reader
 * can point at, in a file the gate has already parsed. It is NOT name matching
 * — nothing here looks outside the module the call appears in, so a same-named
 * function elsewhere in the tree is never reached. The reference instance for
 * `check-returned-property-reads` is a same-module call (`jobs/finalize-week.mjs`
 * calls its own `finalize_week`), so a gate that resolved imports only could not
 * rediscover the defect it was written for.
 *
 * @param {object} params
 * @param {object} params.program
 * @returns {Map<string, object>} local name to function node
 */
export const collect_local_functions = ({ program }) => {
  const locals = new Map()

  for (const statement of program.body) {
    // `export const x = ...` / `export function x()` arrive wrapped, and reading
    // only bare declarations is how the argument-side gate once left 78 real
    // call sites unresolved -- a silent false negative that looks clean.
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement

    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      locals.set(declaration.id.name, declaration)
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier' || !declarator.init) continue
        if (is_function_node(declarator.init)) {
          locals.set(declarator.id.name, declarator.init)
        }
      }
    }
  }

  return locals
}

/**
 * The function node a given export name resolves to, following at most ONE
 * re-export hop.
 *
 * One hop is not a shortcut, it is the shape this tree has: an index barrel
 * re-exports in a single `export { default as x } from './x.mjs'`. A general
 * re-export graph walk with cycle detection would be machinery for a case that
 * does not occur here, and a deeper chain is reported as a skip rather than
 * guessed at.
 *
 * @param {object} params
 * @param {string} params.file absolute path of the module to look in
 * @param {string} params.export_name the exported name, or `default`
 * @param {object} params.imports_map
 * @param {Map<string, object>} params.cache
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @param {number} [params.hops_remaining]
 * @returns {{ node: object, file: string }|{ skip: string }}
 */
export const resolve_exported_function = ({
  file,
  export_name,
  imports_map,
  cache,
  read_file,
  file_exists,
  hops_remaining = 1
}) => {
  const parsed = parse_module({ file, cache, read_file })
  if (!parsed) return { skip: 'unresolved_export' }

  const hop = ({ specifier, imported }) => {
    if (hops_remaining <= 0) return { skip: 're_export_depth' }
    const next = resolve_specifier({
      specifier,
      from_file: file,
      imports_map,
      file_exists
    })
    if (!next) return { skip: 'unresolved_specifier' }
    return resolve_exported_function({
      file: next,
      export_name: imported,
      imports_map,
      cache,
      read_file,
      file_exists,
      hops_remaining: hops_remaining - 1
    })
  }

  // Local declarations, so `export { name }` and `export default name` can be
  // followed back to the function they name.
  const local_functions = collect_local_functions({ program: parsed.program })

  for (const statement of parsed.program.body) {
    if (
      statement.type === 'ExportDefaultDeclaration' &&
      export_name === 'default'
    ) {
      const declaration = statement.declaration
      if (is_function_node(declaration)) return { node: declaration, file }
      if (declaration.type === 'Identifier') {
        const local = local_functions.get(declaration.name)
        if (local) return { node: local, file }
      }
      return { skip: 'unresolved_export' }
    }

    if (statement.type !== 'ExportNamedDeclaration') continue

    // `export const x = ...` / `export function x()`
    if (statement.declaration && !statement.source) {
      const declaration = statement.declaration
      if (
        declaration.type === 'FunctionDeclaration' &&
        declaration.id?.name === export_name
      ) {
        return { node: declaration, file }
      }
      if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type !== 'Identifier') continue
          if (declarator.id.name !== export_name) continue
          if (!declarator.init || !is_function_node(declarator.init)) {
            return { skip: 'unresolved_export' }
          }
          return { node: declarator.init, file }
        }
      }
      continue
    }

    // `export { a as b }` and `export { a as b } from './m.mjs'`
    for (const specifier of statement.specifiers || []) {
      if (specifier.type !== 'ExportSpecifier') continue
      const exported =
        specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : specifier.exported.value
      if (exported !== export_name) continue

      const local_name = specifier.local.name
      if (statement.source) {
        return hop({ specifier: statement.source.value, imported: local_name })
      }
      const local = local_functions.get(local_name)
      if (local) return { node: local, file }
      return { skip: 'unresolved_export' }
    }
  }

  return { skip: 'unresolved_export' }
}
