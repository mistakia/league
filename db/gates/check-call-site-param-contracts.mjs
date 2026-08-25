#!/usr/bin/env node

/**
 * Cross-file calls whose object argument carries a key the callee's destructured
 * parameter list does not accept.
 *
 * WHY THIS EXISTS. Renaming a destructured parameter fails SILENTLY at every
 * unconverted call site. The params in this tree carry permissive defaults
 * (`season_type = 'REG'`, `season_year = current_season.year`, `year = null`),
 * so the callee ignores the stale key and uses its default; many of these
 * scripts then catch into a `report_job` and call a bare `process.exit()`, which
 * exits 0. The observable signature is green exit, green suite, wrong data.
 *
 * The class has shipped three times in one rename program:
 *
 *   1. `5a5422a54` renamed import-full-season's call sites into six importers
 *      without renaming the callees. Closed by `4aab66b70`.
 *   2. Two specs broke because they reach scripts BY PATH, so a sweep for the
 *      exported symbol came back clean. Only the suite caught it.
 *   3. Twelve call sites lived on master afterwards, including
 *      libs-server/finalize-game.mjs, and one -- recompute_route_share -- whose
 *      `year` param defaults to null, meaning UNSCOPED.
 *
 * No existing gate can see any of it. check-rename-alias-residue anchors on
 * QUERY SITES and a call site is neither a query site nor a consumer;
 * check-renamed-column-consumers anchors on COLUMN NAMES and these are
 * parameter names, which need not match any column.
 *
 * THE ANCHOR IS THE IMPORT EDGE, NOT THE NAME, and that is the whole
 * false-positive answer. A call is analyzed only when its callee identifier is
 * bound by an ImportDeclaration in the same file, and the callee's parameter
 * list is read from the module that import RESOLVES to. A name-keyed sweep of
 * this tree runs about 50% false positives, because the tree is full of
 * same-named functions that are not the same function:
 * `scripts/import-nfl-gamebook-starters.mjs` defines local `download_csv` and
 * `import_for_year` on `season_year` while `import-nflverse-injuries.mjs` and
 * `import-nflverse-weekly-rosters.mjs` define same-named locals still on `year`,
 * and `run` is a near-universal local name for a script's default export. None
 * of those are imported anywhere, so none of them are considered here at all.
 *
 * WHAT THIS DOES NOT COVER, stated rather than left to be discovered. A
 * hand-built test FIXTURE that drifts from a renamed producer -- instance 2
 * above -- is out of scope. A fixture is an object literal with no callee to
 * resolve against, so the only available anchor would be the key name, which is
 * precisely the name-keyed matching this gate exists to avoid. `test/` IS in the
 * corpus as a CALLER root, so a spec that calls a renamed producer with stale
 * keys is caught, including through the by-path imports that defeated the symbol
 * sweep. Fixture drift remains the suite's job.
 *
 * Usage:
 *   node db/gates/check-call-site-param-contracts.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parseSync as parse_js } from '@babel/core'

import {
  resolve_corpus,
  count_files_by_root,
  format_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import { format_negative_controls } from './negative-control.mjs'

// Path depth is load-bearing. Every scanner under db/ resolves the repo root
// this way, and the five directories sit at the same depth deliberately: moved
// one level, this reads zero files in every root and exits 0 over nothing.
const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

// Roots scanned for CALL SITES. A CALLEE is reached through the import edge and
// may live anywhere, so it needs no declaration here.
//
// `app/` is deliberately absent. The defect class needs a permissive default and
// a silent exit, and the SPA has neither -- its cross-module calls are props and
// action creators. Including it would mean carrying a second resolution scheme
// for the webpack aliases (@core, @libs-shared, @constants, @components) to
// cover a root with no instance of the class. One root name and one alias map
// adds it back if a real instance turns up.
//
// `private/` is a submodule NO workflow checks out, so on a runner and in a
// fresh worktree it is a present, EMPTY mountpoint. It is declared so that
// narrowing is visible rather than silent.
const CALLER_ROOTS = [
  'api',
  'db',
  'jobs',
  'libs-server',
  'libs-shared',
  'scripts',
  'test',
  'private'
]

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage'])

/**
 * Every reason a call site was seen but not judged. Counted and printed, so the
 * gate's blind spots are a number on the output rather than an absence.
 */
const SKIP_REASONS = {
  callee_not_imported:
    'callee is a local or global name, not an imported binding',
  member_callee: 'callee is a member expression (namespace or method call)',
  unresolved_specifier:
    'import specifier did not resolve to a file in this repo',
  unresolved_export: 'export not found in the resolved module',
  re_export_depth: 're-export chain deeper than one hop',
  callee_param_not_object: 'callee does not destructure its first parameter',
  callee_accepts_rest: 'callee parameter list carries a rest element',
  argument_not_object_literal: 'first argument is not an object literal',
  argument_spreads: 'argument object carries a spread element',
  argument_computed_key: 'argument object carries a computed key'
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function* walk_ast(node, parent = null) {
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
const parse_module = ({ file, cache, read_file }) => {
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

/* -------------------------------------------------------------------------- */
/* Import resolution -- the anchor                                             */
/* -------------------------------------------------------------------------- */

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
  // The wrapper unwrap is load-bearing, not defensive. `export const x = ...`
  // followed by `export default x` is the dominant shape in libs-server, and the
  // statement babel gives you is an ExportNamedDeclaration WRAPPING the
  // VariableDeclaration. Reading only bare declarations left 78 real call sites
  // unresolved -- a silent false negative in the direction that looks clean.
  const local_functions = new Map()
  for (const statement of parsed.program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement

    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      local_functions.set(declaration.id.name, declaration)
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier' || !declarator.init) continue
        if (is_function_node(declarator.init)) {
          local_functions.set(declarator.id.name, declarator.init)
        }
      }
    }
  }

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

const is_function_node = (node) =>
  node?.type === 'ArrowFunctionExpression' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'FunctionDeclaration'

/**
 * The keys a function's first parameter accepts.
 *
 * @param {object} params
 * @param {object} params.node a function node
 * @returns {{ accepted: Set<string> }|{ skip: string }}
 */
export const collect_accepted_keys = ({ node }) => {
  let pattern = node.params[0]
  if (!pattern) return { skip: 'callee_param_not_object' }
  // `({ ... } = {})` -- the defaulted-options form most of these scripts use.
  if (pattern.type === 'AssignmentPattern') pattern = pattern.left
  if (pattern.type !== 'ObjectPattern')
    return { skip: 'callee_param_not_object' }

  const accepted = new Set()
  for (const property of pattern.properties) {
    // A rest element accepts everything, so nothing here can be a mismatch.
    if (property.type === 'RestElement') return { skip: 'callee_accepts_rest' }
    if (property.computed) return { skip: 'callee_accepts_rest' }
    const key = property.key
    if (key.type === 'Identifier') accepted.add(key.name)
    else if (key.type === 'StringLiteral') accepted.add(key.value)
    else return { skip: 'callee_accepts_rest' }
  }

  return { accepted }
}

/**
 * The keys a call site passes in its first argument.
 *
 * @param {object} params
 * @param {object} params.node a CallExpression node
 * @returns {{ keys: Array<{ name: string, line: number }> }|{ skip: string }}
 */
export const collect_passed_keys = ({ node }) => {
  const argument = node.arguments[0]
  if (!argument || argument.type !== 'ObjectExpression') {
    return { skip: 'argument_not_object_literal' }
  }

  const keys = []
  for (const property of argument.properties) {
    if (property.type === 'SpreadElement') return { skip: 'argument_spreads' }
    if (property.computed) return { skip: 'argument_computed_key' }
    const key = property.key
    if (key.type === 'Identifier') {
      keys.push({ name: key.name, line: key.loc?.start.line ?? 0 })
    } else if (key.type === 'StringLiteral') {
      keys.push({ name: key.value, line: key.loc?.start.line ?? 0 })
    } else {
      return { skip: 'argument_computed_key' }
    }
  }

  return { keys }
}

/* -------------------------------------------------------------------------- */
/* The analyzer                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every mismatched call site in the given caller files.
 *
 * The whole analyzer takes its readers as parameters so the negative controls
 * can drive it over a synthetic module tree without touching the filesystem.
 *
 * @param {object} params
 * @param {string[]} params.caller_files absolute paths
 * @param {object} params.imports_map
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @returns {{ findings: object[], skipped: object }}
 */
export const analyze_call_sites = ({
  caller_files,
  imports_map,
  read_file,
  file_exists
}) => {
  const cache = new Map()
  const findings = []
  const skipped = {}
  const skip = (reason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
  }

  for (const caller_file of caller_files) {
    const parsed = parse_module({ file: caller_file, cache, read_file })
    if (!parsed) continue

    const bindings = collect_import_bindings({ program: parsed.program })
    if (bindings.size === 0) continue

    for (const { node } of walk_ast(parsed.program)) {
      if (node.type !== 'CallExpression') continue

      if (node.callee.type === 'MemberExpression') {
        skip('member_callee')
        continue
      }
      if (node.callee.type !== 'Identifier') continue

      const binding = bindings.get(node.callee.name)
      if (!binding) {
        skip('callee_not_imported')
        continue
      }

      const callee_file = resolve_specifier({
        specifier: binding.specifier,
        from_file: caller_file,
        imports_map,
        file_exists
      })
      if (!callee_file) {
        skip('unresolved_specifier')
        continue
      }

      const resolved = resolve_exported_function({
        file: callee_file,
        export_name: binding.imported,
        imports_map,
        cache,
        read_file,
        file_exists
      })
      if (resolved.skip) {
        skip(resolved.skip)
        continue
      }

      const contract = collect_accepted_keys({ node: resolved.node })
      if (contract.skip) {
        skip(contract.skip)
        continue
      }

      const passed = collect_passed_keys({ node })
      if (passed.skip) {
        skip(passed.skip)
        continue
      }

      for (const { name, line } of passed.keys) {
        if (contract.accepted.has(name)) continue
        findings.push({
          caller: path.relative(repo_root, caller_file),
          line,
          callee: node.callee.name,
          callee_file: path.relative(repo_root, resolved.file),
          key: name,
          accepted: [...contract.accepted].sort()
        })
      }
    }
  }

  return { findings, skipped }
}

/* -------------------------------------------------------------------------- */
/* Adjudications                                                               */
/* -------------------------------------------------------------------------- */

export const ADJUDICATIONS_FILE =
  'db/gates/call-site-param-contract-adjudications.json'

/**
 * A SITE key -- caller file, callee, argument key. Never the argument key alone.
 *
 * A name-keyed entry would be the stoplist that hid
 * scoring_format_player_projection_points.total from check-renamed-column-consumers,
 * and it is the exact failure this gate's import-edge anchor exists to avoid.
 * The LINE is deliberately not part of the key: Lane 1's repair shifted three
 * findings in finalize-game.mjs by fourteen lines without changing anything
 * about them, and an entry that goes stale on an unrelated edit above it teaches
 * people to regenerate the file wholesale.
 */
const site_key = ({ caller, callee, key }) => `${caller}|${callee}|${key}`

/**
 * Split findings into the ones an adjudication covers and the ones it does not,
 * and report every entry that covers nothing.
 *
 * An entry that no longer suppresses anything is itself a FINDING, so a repaired
 * site forces its entry out rather than leaving a standing exemption. That is
 * the same disposition rename-alias-residue-adjudications.json carries, and it
 * is what makes the file self-cleaning rather than a growing allowlist.
 *
 * @param {object} params
 * @param {object[]} params.findings
 * @param {object[]} params.adjudications
 * @returns {{ reportable: object[], suppressed: object[], stale: object[] }}
 */
export const apply_adjudications = ({ findings, adjudications }) => {
  const used = new Set()
  const by_key = new Map(adjudications.map((entry) => [site_key(entry), entry]))

  const reportable = []
  const suppressed = []

  for (const finding of findings) {
    const key = site_key(finding)
    if (by_key.has(key)) {
      used.add(key)
      suppressed.push(finding)
    } else {
      reportable.push(finding)
    }
  }

  const stale = adjudications.filter((entry) => !used.has(site_key(entry)))

  return { reportable, suppressed, stale }
}

/* -------------------------------------------------------------------------- */
/* Corpus                                                                      */
/* -------------------------------------------------------------------------- */

const walk_directory = ({ directory, files = [] }) => {
  let entries
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) walk_directory({ directory: full, files })
    else if (entry.name.endsWith('.mjs')) files.push(full)
  }
  return files
}

/**
 * Roots this gate's COVERAGE assertion must not fire on, read from the
 * filesystem and NOTHING else.
 *
 * This takes no counts, deliberately, and has exactly two callers -- `main` and
 * the control that drives it. `check-knex-column-resolution` handed a
 * counts-derived missing set to its own coverage assertion in `73a4c82f5`: a
 * zero-file root lands in a counts-derived missing set by construction, so the
 * exclusion list was precisely the set the assertion fires on, and every branch
 * went dead with nothing in the output changing. Rewiring this back to counts
 * must fail a control rather than pass quietly.
 *
 * @returns {string[]} declared roots that do not exist or are empty
 */
export const coverage_exclusions = () => {
  const filesystem_corpus = resolve_corpus({
    roots: CALLER_ROOTS,
    repo_root
  })
  return filesystem_corpus.missing
}

/* -------------------------------------------------------------------------- */
/* Negative controls                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A synthetic module tree the analyzer can be driven over. Keys are repo-root
 * relative; the returned readers close over them.
 */
const synthetic_tree = (files) => {
  const absolute = new Map(
    Object.entries(files).map(([relative, source]) => [
      path.resolve(repo_root, relative),
      source
    ])
  )
  // Which synthetic modules are CALLERS is decided on the repo-relative key, not
  // on the absolute path. Matching the absolute path would fold the checkout's
  // own directory names into the control's input, so a repo cloned under a path
  // containing `caller` would silently promote every synthetic callee to a
  // caller -- a control whose result depends on where the repo happens to live.
  const is_caller = (relative) => path.basename(relative).startsWith('caller-')
  return {
    caller_files: Object.keys(files)
      .filter(is_caller)
      .map((relative) => path.resolve(repo_root, relative)),
    read_file: (file) => {
      if (!absolute.has(file))
        throw new Error(`no such synthetic file: ${file}`)
      return absolute.get(file)
    },
    file_exists: (file) => absolute.has(file)
  }
}

const run_synthetic = (files) => {
  const { caller_files, read_file, file_exists } = synthetic_tree(files)
  return analyze_call_sites({
    caller_files,
    imports_map: {
      '#scripts/*': './scripts/*',
      '#libs-server': './libs-server/index.mjs'
    },
    read_file,
    file_exists
  })
}

const CALLEE_RENAMED = `
export default async ({ season_year, week, season_type = 'REG' }) => season_year
`

/**
 * Each control's verdict is derived from what it DID, never from what it
 * expected. A gate that printed `[FAIL] WENT RED` for a control that went green
 * is in this repo's record.
 *
 * @returns {Array<{ name: string, went_red: boolean }>}
 */
export const run_negative_controls = () => {
  const controls = []

  // 1. The live shape: a default import called with the pre-rename keys.
  const default_import = run_synthetic({
    'scripts/callee-renamed.mjs': CALLEE_RENAMED,
    'libs-server/caller-default.mjs': `
import work from '#scripts/callee-renamed.mjs'
export const go = () => work({ year: 2024, week: 1, seas_type: 'REG' })
`
  })
  controls.push({
    name: 'default-import call passing renamed-away keys is reported',
    went_red:
      default_import.findings.length === 2 &&
      default_import.findings.every((finding) =>
        ['year', 'seas_type'].includes(finding.key)
      )
  })

  // 2. The same defect arriving through a named import.
  const named_import = run_synthetic({
    'scripts/callee-named.mjs': `
export const process_week = ({ season_year, week }) => season_year + week
`,
    'libs-server/caller-named.mjs': `
import { process_week } from '#scripts/callee-named.mjs'
export const go = () => process_week({ year: 2024, week: 1 })
`
  })
  controls.push({
    name: 'named-import call passing a renamed-away key is reported',
    went_red:
      named_import.findings.length === 1 &&
      named_import.findings[0].key === 'year'
  })

  // 3. Through the one re-export hop an index barrel actually uses.
  const barrel = run_synthetic({
    'scripts/callee-barrel-source.mjs': CALLEE_RENAMED,
    'libs-server/index.mjs': `
export { default as run_import } from '#scripts/callee-barrel-source.mjs'
`,
    'libs-server/caller-barrel.mjs': `
import { run_import } from '#libs-server'
export const go = () => run_import({ seas_type: 'POST' })
`
  })
  controls.push({
    name: 'call resolved through one re-export hop is reported',
    went_red:
      barrel.findings.length === 1 && barrel.findings[0].key === 'seas_type'
  })

  // 4. THE DECOY. Two modules define same-named LOCAL functions with different
  //    parameter vocabularies, and the caller calls its own. A name-keyed
  //    implementation reports a mismatch here; an import-resolved one reports
  //    nothing, because a local is not an imported binding. This is the control
  //    that pins the design CHOICE rather than the machinery, and it is the one
  //    that fires in the direction that gets a working gate weakened.
  const decoy = run_synthetic({
    'scripts/callee-decoy-other.mjs': `
const import_for_year = ({ season_year }) => season_year
export default import_for_year
`,
    'libs-server/caller-decoy.mjs': `
import unrelated from '#scripts/callee-decoy-other.mjs'
const import_for_year = ({ year }) => year
export const go = () => {
  unrelated({ season_year: 2024 })
  return import_for_year({ year: 2024 })
}
`
  })
  controls.push({
    name: 'same-named LOCAL function is not matched against an import (decoy)',
    went_red: decoy.findings.length === 0
  })

  // 5. A rest element accepts every key, so nothing after it can be a mismatch.
  const rest_param = run_synthetic({
    'scripts/callee-rest.mjs': `
export const flexible = ({ season_year, ...rest }) => rest
`,
    'libs-server/caller-rest.mjs': `
import { flexible } from '#scripts/callee-rest.mjs'
export const go = () => flexible({ year: 2024, anything: true })
`
  })
  controls.push({
    name: 'callee with a rest element is exempt, not reported',
    went_red:
      rest_param.findings.length === 0 &&
      rest_param.skipped.callee_accepts_rest === 1
  })

  // 6. An adjudication covering nothing is reported STALE, so a repaired site
  //    forces its entry out instead of leaving a standing exemption.
  const stale_entry = apply_adjudications({
    findings: [{ caller: 'scripts/live.mjs', callee: 'work', key: 'year' }],
    adjudications: [
      { caller: 'scripts/live.mjs', callee: 'work', key: 'year' },
      { caller: 'scripts/repaired.mjs', callee: 'work', key: 'seas_type' }
    ]
  })
  controls.push({
    name: 'an adjudication that suppresses nothing is reported STALE',
    went_red:
      stale_entry.stale.length === 1 &&
      stale_entry.stale[0].caller === 'scripts/repaired.mjs' &&
      stale_entry.suppressed.length === 1 &&
      stale_entry.reportable.length === 0
  })

  // 7. Adjudications are keyed on the SITE. An entry must not suppress the same
  //    argument key at a DIFFERENT caller, which is the name-keyed stoplist this
  //    whole gate exists to avoid.
  const site_scoped = apply_adjudications({
    findings: [{ caller: 'scripts/other.mjs', callee: 'work', key: 'year' }],
    adjudications: [{ caller: 'scripts/live.mjs', callee: 'work', key: 'year' }]
  })
  controls.push({
    name: 'an adjudication does not suppress the same key at another caller',
    went_red:
      site_scoped.reportable.length === 1 && site_scoped.stale.length === 1
  })

  // 8. An ALL-unread corpus is the path-depth failure itself, not a narrowed
  //    verdict, and this gate fails on it. Driven through the same function
  //    `main` uses, so rewiring that function to counts breaks this control.
  const exclusions = coverage_exclusions()
  controls.push({
    name: 'coverage exclusions come from the filesystem, not from file counts',
    went_red:
      !exclusions.includes('libs-server') && !exclusions.includes('scripts')
  })

  return controls
}

/* -------------------------------------------------------------------------- */
/* main                                                                        */
/* -------------------------------------------------------------------------- */

const main = () => {
  const imports_map = JSON.parse(
    fs.readFileSync(path.join(repo_root, 'package.json'), 'utf8')
  ).imports

  const caller_files = CALLER_ROOTS.flatMap((root) =>
    walk_directory({ directory: path.join(repo_root, root) })
  )

  const counts = count_files_by_root({
    files: caller_files,
    roots: CALLER_ROOTS,
    repo_root
  })

  // Two resolutions, one source each. This one is counts-driven and is what the
  // CORPUS block and the verdict suffix claim -- a root that yielded no files
  // cannot produce a finding, whatever the filesystem says.
  const corpus = resolve_corpus({ roots: CALLER_ROOTS, repo_root, counts })

  const { findings, skipped } = analyze_call_sites({
    caller_files,
    imports_map,
    read_file: (file) => fs.readFileSync(file, 'utf8'),
    file_exists: (file) => fs.existsSync(file)
  })

  console.log(format_corpus({ corpus, counts }))
  console.log('')

  const control_results = run_negative_controls()
  console.error(format_negative_controls({ controls: control_results }))
  console.error('')

  const { adjudications } = JSON.parse(
    fs.readFileSync(path.join(repo_root, ADJUDICATIONS_FILE), 'utf8')
  )
  const { reportable, suppressed, stale } = apply_adjudications({
    findings,
    adjudications
  })

  // Sorted so two runs diff cleanly against each other.
  const sorted = [...reportable].sort((a, b) =>
    `${a.caller}:${String(a.line).padStart(6, '0')}:${a.key}`.localeCompare(
      `${b.caller}:${String(b.line).padStart(6, '0')}:${b.key}`
    )
  )

  for (const finding of sorted) {
    console.log(
      `${finding.caller}:${finding.line}  ${finding.callee}({ ${finding.key} })  ` +
        `not accepted by ${finding.callee_file}  [accepts: ${finding.accepted.join(', ')}]`
    )
  }

  for (const entry of stale) {
    console.log(
      `STALE ADJUDICATION  ${entry.caller}  ${entry.callee}({ ${entry.key} })  ` +
        'suppresses nothing -- remove the entry'
    )
  }

  console.log('')
  console.log(
    `${suppressed.length} finding(s) suppressed by ${ADJUDICATIONS_FILE}, ` +
      'every one of them tracked debt rather than an approved shape.'
  )
  console.log('')
  console.log('SKIPPED CALL SITES')
  for (const reason of Object.keys(SKIP_REASONS).sort()) {
    const count = skipped[reason] ?? 0
    if (count === 0) continue
    console.log(
      `  ${String(count).padStart(6)}  ${reason} -- ${SKIP_REASONS[reason]}`
    )
  }
  console.log('')

  // An ALL-unread corpus reads to the counts view as a merely narrowed verdict.
  // It is the path-depth regression instead, and it fails here.
  const excluded = coverage_exclusions()
  const readable_roots = CALLER_ROOTS.filter((root) => !excluded.includes(root))
  const unread = readable_roots.filter((root) => (counts.get(root) ?? 0) === 0)
  if (unread.length === readable_roots.length) {
    console.log(
      `GATE FAILED: every readable root yielded zero files (${readable_roots.join(', ')}).`
    )
    console.log('This is the path-depth failure, not a narrowed corpus.')
    process.exit(1)
  }
  if (unread.length) {
    console.log(
      `GATE FAILED: root(s) present on disk but read as empty: ${unread.join(', ')}`
    )
    process.exit(1)
  }

  const control_failures = control_results.filter(({ went_red }) => !went_red)
  if (control_failures.length) {
    console.log(
      `GATE CANNOT REPORT: ${control_failures.length} negative control(s) did not fire.`
    )
    process.exit(1)
  }

  if (sorted.length || stale.length) {
    if (sorted.length) {
      console.log(
        `GATE FAILED: ${sorted.length} call site(s) pass a key their callee does not accept.`
      )
    }
    if (stale.length) {
      console.log(
        `GATE FAILED: ${stale.length} adjudication(s) suppress nothing and must be removed.`
      )
    }
    process.exit(1)
  }

  console.log(
    `GATE OK: no call site passes an unaccepted key${verdict_suffix(corpus)}`
  )
}

main()
