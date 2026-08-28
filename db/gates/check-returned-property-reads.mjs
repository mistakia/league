#!/usr/bin/env node

/**
 * Reads of a property the producer never returns.
 *
 * WHY THIS EXISTS. `jobs/finalize-week.mjs` read `finalize_result?.reason` to
 * build the message it handed to `report_job`. `finalize_week` returns
 * `{ success, results }` and has NEVER returned a `reason` key at any revision,
 * so the read was always `undefined`, the `|| 'unknown error'` fallback always
 * won, and every failed week reported the literal string
 * `Week finalization failed: unknown error` -- no step name, no message, not
 * even a count, while `results.steps_failed` held the step names and their
 * errors the whole time. Fixed 2026-08-28 in `93d5e025d`; that site is this
 * gate's known-broken case and the thing it must be able to rediscover.
 *
 * The observable signature is the same one the argument-side gate was built
 * for: green exit, green suite, wrong data. A read of an absent key does not
 * throw, it yields `undefined`, and `undefined` is exactly what an `||` or `??`
 * fallback is written to absorb. Nothing in a type-free tree reports it.
 *
 * THIS IS THE RETURN-VALUE DUAL of `check-call-site-param-contracts.mjs`, which
 * catches the ARGUMENT side of the same mistake -- a call site passing an object
 * key the callee does not destructure. That gate exists, works, and is green.
 * Nothing caught the read side.
 *
 * THE ANCHOR IS THE RESOLUTION EDGE, NOT THE NAME, and that is the whole
 * false-positive answer. The callee of `const x = await foo()` is resolved to
 * ONE function node -- through an ImportDeclaration in the same file, or to a
 * top-level function the same file declares -- and the returned key set is read
 * off THAT node. A name-keyed sweep of this tree runs about 50% false
 * positives, because it defines `download_csv`, `import_for_year` and `run` as
 * unrelated locals in several modules on different vocabularies; the same
 * reasoning that made the argument-side gate resolve the import edge applies
 * unchanged here, and the decoy control pins it.
 *
 * The same-module half is NOT a weakening of that rule. It is the strongest
 * edge there is -- one definition, in a file already parsed, that a reader can
 * point at -- and nothing in it looks outside the module the call appears in.
 * It is also load-bearing: the reference instance calls a function its own file
 * declares, so an import-only resolver could not rediscover the defect this
 * gate was written for. Both edges live in `import-edge-resolution.mjs`, shared
 * with the argument-side gate rather than copied.
 *
 * WHAT THIS DOES NOT COVER, stated rather than left to be discovered. A callee
 * whose return value is dynamic, conditional, spread, or built up across
 * branches is NOT analyzable, and every one of those is a SKIP with a printed
 * count -- read the SKIPPED READS block before treating a zero as coverage. A
 * receiver that is reassigned, mutated, or handed to another function is
 * likewise skipped, because a key can be added to an object after it is
 * returned. Nested reads (`x.results.steps_failed`) are judged at DEPTH ONE
 * only: `results` is checked against the contract, `steps_failed` is not.
 *
 * Usage:
 *   node db/gates/check-returned-property-reads.mjs
 */

import fs from 'fs'
import path from 'path'

import {
  resolve_corpus,
  count_files_by_root,
  format_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import { format_negative_controls } from './negative-control.mjs'
import {
  repo_root,
  walk_ast,
  parse_module,
  is_function_node,
  resolve_specifier,
  collect_import_bindings,
  collect_local_functions,
  resolve_exported_function,
  RESOLUTION_SKIP_REASONS
} from './import-edge-resolution.mjs'

// Roots scanned for READ SITES. A CALLEE is reached through the resolution edge
// and may live anywhere, so it needs no declaration here.
//
// `app/` is deliberately absent, for the same reason the argument-side gate
// omits it: covering it means carrying a second resolution scheme for the
// webpack aliases (@core, @libs-shared, @constants, @components), and the SPA's
// cross-module values are props and action creators rather than returned
// option objects. One root name and one alias map adds it back if a real
// instance turns up.
//
// `private/` is a submodule NO workflow checks out, so on a runner and in a
// fresh worktree it is a present, EMPTY mountpoint. It is declared so that
// narrowing is visible rather than silent.
const READER_ROOTS = [
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
 * Members that exist on every object, so a read of one proves nothing about the
 * producer's contract. `then`, `catch` and `finally` are here as well: a
 * receiver bound to a promise reads them legitimately, and the awaited-call
 * rule below is not the only way one can arrive.
 */
const UNIVERSAL_MEMBERS = new Set([
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  'then',
  'catch',
  'finally'
])

/**
 * Every reason a read was seen but not judged. Counted and printed, so this
 * gate's blind spots are a number on the output rather than an absence. A gate
 * that quietly narrows to nothing and reports a confident zero is the failure
 * mode here.
 */
const SKIP_REASONS = {
  ...RESOLUTION_SKIP_REASONS,
  receiver_not_a_call_result:
    'the receiver is not a variable bound to a call in this file',
  callee_not_resolvable:
    'callee is a global, a shadowed name, or not a top-level function of this module',
  receiver_rebound:
    'the receiver is declared more than once, reassigned, or bound from two sources',
  receiver_escapes:
    'the receiver is mutated, passed to another function, or placed in a literal, so a key can be added after the return',
  call_not_awaited:
    'async callee whose result is not awaited, so the receiver is a promise',
  callee_returns_nothing:
    'callee has no return statement yielding an object literal',
  callee_returns_non_literal:
    'at least one return in the callee is not an object literal -- dynamic, conditional, or a call',
  callee_return_spreads: 'a returned object literal carries a spread element',
  callee_return_computed_key: 'a returned object literal carries a computed key'
}

/* -------------------------------------------------------------------------- */
/* The callee's return contract                                                */
/* -------------------------------------------------------------------------- */

/**
 * The return statements a function makes on its OWN behalf, never those of a
 * function nested inside it.
 *
 * @param {object} node
 * @param {Array<object|null>} out
 */
const collect_own_returns = (node, out) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) collect_own_returns(child, out)
    return
  }
  if (typeof node.type !== 'string') return
  // A nested function's returns belong to it, not to the callee being analyzed.
  if (
    is_function_node(node) ||
    node.type === 'ObjectMethod' ||
    node.type === 'ClassMethod'
  ) {
    return
  }
  if (node.type === 'ReturnStatement') {
    out.push(node.argument)
    return
  }
  for (const key of Object.keys(node)) {
    if (
      key === 'loc' ||
      key === 'leadingComments' ||
      key === 'trailingComments'
    ) {
      continue
    }
    collect_own_returns(node[key], out)
  }
}

const is_nullish_literal = (node) =>
  node === null ||
  node === undefined ||
  node.type === 'NullLiteral' ||
  (node.type === 'Identifier' && node.name === 'undefined')

/**
 * The keys a function PROVABLY returns, as the union over its return
 * statements.
 *
 * The union is the conservative direction: a key returned on any branch is a
 * legitimate read, so only a key present in NO returned literal is a finding.
 * A bare `return`, `return null` and `return undefined` contribute no keys and
 * disqualify nothing -- a read of a key absent from every literal is still
 * always `undefined` on those paths too.
 *
 * Anything else -- a returned call, a conditional, a spread, a computed key --
 * makes the function unanalyzable and is a SKIP, never a finding.
 *
 * @param {object} params
 * @param {object} params.node a function node
 * @returns {{ keys: Set<string> }|{ skip: string }}
 */
export const collect_returned_keys = ({ node }) => {
  const returns = []

  if (
    node.type === 'ArrowFunctionExpression' &&
    node.body.type !== 'BlockStatement'
  ) {
    // `() => ({ a, b })` -- the concise-body form.
    returns.push(node.body)
  } else {
    collect_own_returns(node.body, returns)
  }

  if (returns.length === 0) return { skip: 'callee_returns_nothing' }

  const keys = new Set()
  let saw_object = false

  for (const argument of returns) {
    if (is_nullish_literal(argument)) continue
    if (argument.type !== 'ObjectExpression') {
      return { skip: 'callee_returns_non_literal' }
    }
    saw_object = true
    for (const property of argument.properties) {
      if (property.type === 'SpreadElement') {
        return { skip: 'callee_return_spreads' }
      }
      if (property.computed) return { skip: 'callee_return_computed_key' }
      const key = property.key
      if (key.type === 'Identifier') keys.add(key.name)
      else if (key.type === 'StringLiteral') keys.add(key.value)
      else return { skip: 'callee_return_computed_key' }
    }
  }

  if (!saw_object) return { skip: 'callee_returns_nothing' }

  return { keys }
}

/* -------------------------------------------------------------------------- */
/* The receiver                                                                */
/* -------------------------------------------------------------------------- */

const pattern_identifiers = (node, out = []) => {
  if (!node || typeof node !== 'object') return out
  switch (node.type) {
    case 'Identifier':
      out.push(node.name)
      break
    case 'ObjectPattern':
      for (const property of node.properties) {
        pattern_identifiers(
          property.type === 'RestElement' ? property.argument : property.value,
          out
        )
      }
      break
    case 'ArrayPattern':
      for (const element of node.elements) pattern_identifiers(element, out)
      break
    case 'AssignmentPattern':
      pattern_identifiers(node.left, out)
      break
    case 'RestElement':
      pattern_identifiers(node.argument, out)
      break
    default:
      break
  }
  return out
}

const unwrap_await = (node) =>
  node?.type === 'AwaitExpression'
    ? { expression: node.argument, awaited: true }
    : { expression: node, awaited: false }

/**
 * Every identifier in a module, with what would stop this gate from trusting it
 * as the result of one call.
 *
 * The rules are deliberately blunt and file-local. A name declared twice, bound
 * from two sources, mutated through a member write, or handed to anything that
 * could add a key to it is DROPPED rather than judged, because the contract
 * this gate reads off the producer stops describing the object the moment
 * something else can write to it.
 *
 * @param {object} params
 * @param {object} params.program
 * @returns {{ declarations: Map<string, number>,
 *   sources: Map<string, object[]>, escaped: Set<string> }}
 */
export const collect_identifier_facts = ({ program }) => {
  const declarations = new Map()
  const sources = new Map()
  const escaped = new Set()

  const declare = (name) =>
    declarations.set(name, (declarations.get(name) ?? 0) + 1)
  const add_source = (name, node) => {
    if (!sources.has(name)) sources.set(name, [])
    sources.get(name).push(node)
  }

  for (const { node } of walk_ast(program)) {
    switch (node.type) {
      case 'ImportDeclaration':
        for (const specifier of node.specifiers) declare(specifier.local.name)
        break
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
        if (node.id) declare(node.id.name)
        break
      case 'CatchClause':
        for (const name of pattern_identifiers(node.param)) declare(name)
        break
      case 'VariableDeclarator':
        for (const name of pattern_identifiers(node.id)) declare(name)
        if (node.id.type === 'Identifier' && node.init) {
          add_source(node.id.name, node.init)
        }
        break
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier') {
          if (node.operator === '=') add_source(node.left.name, node.right)
          else escaped.add(node.left.name)
        } else if (
          (node.left.type === 'MemberExpression' ||
            node.left.type === 'OptionalMemberExpression') &&
          node.left.object.type === 'Identifier'
        ) {
          // A member write can add the very key that would otherwise be a
          // finding, so the receiver stops being described by the producer.
          escaped.add(node.left.object.name)
        }
        break
      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') escaped.add(node.argument.name)
        break
      case 'SpreadElement':
        if (node.argument.type === 'Identifier') escaped.add(node.argument.name)
        break
      case 'ObjectProperty':
        // `report_job({ result })` -- the object travels and the callee may
        // write to it.
        if (!node.computed && node.value?.type === 'Identifier') {
          escaped.add(node.value.name)
        }
        break
      case 'ArrayExpression':
        for (const element of node.elements || []) {
          if (element?.type === 'Identifier') escaped.add(element.name)
        }
        break
      case 'CallExpression':
      case 'NewExpression':
        for (const argument of node.arguments) {
          if (argument.type === 'Identifier') escaped.add(argument.name)
        }
        break
      default:
        break
    }

    if (is_function_node(node)) {
      for (const parameter of node.params) {
        for (const name of pattern_identifiers(parameter)) declare(name)
      }
    }
  }

  return { declarations, sources, escaped }
}

/* -------------------------------------------------------------------------- */
/* The analyzer                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every read of a property its producer never returns, in the given files.
 *
 * The whole analyzer takes its readers as parameters so the negative controls
 * can drive it over a synthetic module tree without touching the filesystem.
 *
 * @param {object} params
 * @param {string[]} params.reader_files absolute paths
 * @param {object} params.imports_map
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @returns {{ findings: object[], skipped: object }}
 */
export const analyze_returned_property_reads = ({
  reader_files,
  imports_map,
  read_file,
  file_exists
}) => {
  const cache = new Map()
  const findings = []
  const skipped = {}
  // The DENOMINATOR. Findings alone cannot distinguish a clean tree from a gate
  // that reached no analyzable read at all, and a confident zero is this gate's
  // whole failure mode -- every skip reason below is a way of narrowing to
  // nothing. `main` fails when this is zero.
  let judged = 0
  const skip = (reason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
  }

  for (const reader_file of reader_files) {
    const parsed = parse_module({ file: reader_file, cache, read_file })
    if (!parsed) continue

    const { declarations, sources, escaped } = collect_identifier_facts({
      program: parsed.program
    })
    const import_bindings = collect_import_bindings({ program: parsed.program })
    const local_functions = collect_local_functions({ program: parsed.program })

    // The contract per receiver name, resolved lazily and once. `null` means
    // this name is not judgeable and the reason has already been counted.
    const contracts = new Map()

    const contract_for = (name) => {
      if (contracts.has(name)) return contracts.get(name)

      const resolve = () => {
        const source_nodes = sources.get(name)
        if (!source_nodes || source_nodes.length === 0) {
          return { skip: 'receiver_not_a_call_result' }
        }
        if (source_nodes.length > 1 || declarations.get(name) !== 1) {
          return { skip: 'receiver_rebound' }
        }

        const { expression, awaited } = unwrap_await(source_nodes[0])
        if (
          expression?.type !== 'CallExpression' ||
          expression.callee.type !== 'Identifier'
        ) {
          return { skip: 'receiver_not_a_call_result' }
        }
        if (escaped.has(name)) return { skip: 'receiver_escapes' }

        const callee_name = expression.callee.name
        if (declarations.get(callee_name) !== 1) {
          return { skip: 'callee_not_resolvable' }
        }

        let resolved
        const binding = import_bindings.get(callee_name)
        if (binding) {
          const callee_file = resolve_specifier({
            specifier: binding.specifier,
            from_file: reader_file,
            imports_map,
            file_exists
          })
          if (!callee_file) return { skip: 'unresolved_specifier' }
          resolved = resolve_exported_function({
            file: callee_file,
            export_name: binding.imported,
            imports_map,
            cache,
            read_file,
            file_exists
          })
          if (resolved.skip) return { skip: resolved.skip }
        } else if (local_functions.has(callee_name)) {
          resolved = {
            node: local_functions.get(callee_name),
            file: reader_file
          }
        } else {
          return { skip: 'callee_not_resolvable' }
        }

        if (resolved.node.async && !awaited) {
          return { skip: 'call_not_awaited' }
        }

        const returned = collect_returned_keys({ node: resolved.node })
        if (returned.skip) return { skip: returned.skip }

        return {
          callee: callee_name,
          callee_file: resolved.file,
          keys: returned.keys
        }
      }

      const contract = resolve()
      contracts.set(name, contract)
      return contract
    }

    for (const { node } of walk_ast(parsed.program)) {
      let receiver = null
      let property = null
      let line = 0

      if (
        (node.type === 'MemberExpression' ||
          node.type === 'OptionalMemberExpression') &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.property.type === 'Identifier'
      ) {
        receiver = node.object.name
        property = node.property.name
        line = node.property.loc?.start.line ?? 0
      } else if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'ObjectPattern' &&
        node.init?.type === 'Identifier'
      ) {
        // `const { week, season_year } = finalize_result`
        const contract = contract_for(node.init.name)
        if (contract.skip) {
          skip(contract.skip)
          continue
        }
        for (const pattern_property of node.id.properties) {
          if (pattern_property.type === 'RestElement') continue
          judged += 1
          if (pattern_property.computed) {
            skip('callee_return_computed_key')
            continue
          }
          const key = pattern_property.key
          const key_name =
            key.type === 'Identifier'
              ? key.name
              : key.type === 'StringLiteral'
                ? key.value
                : null
          if (key_name === null) continue
          if (contract.keys.has(key_name)) continue
          findings.push({
            reader: path.relative(repo_root, reader_file),
            line: key.loc?.start.line ?? 0,
            callee: contract.callee,
            callee_file: path.relative(repo_root, contract.callee_file),
            property: key_name,
            returns: [...contract.keys].sort()
          })
        }
        continue
      } else {
        continue
      }

      if (UNIVERSAL_MEMBERS.has(property)) continue

      const contract = contract_for(receiver)
      if (contract.skip) {
        skip(contract.skip)
        continue
      }
      judged += 1
      if (contract.keys.has(property)) continue

      findings.push({
        reader: path.relative(repo_root, reader_file),
        line,
        callee: contract.callee,
        callee_file: path.relative(repo_root, contract.callee_file),
        property,
        returns: [...contract.keys].sort()
      })
    }
  }

  return { findings, skipped, judged }
}

/* -------------------------------------------------------------------------- */
/* Adjudications                                                               */
/* -------------------------------------------------------------------------- */

export const ADJUDICATIONS_FILE =
  'db/gates/returned-property-read-adjudications.json'

/**
 * A SITE key -- reader file, callee, property. Never the property name alone.
 *
 * A name-keyed entry would suppress `reason` at every reader in the tree, which
 * is the stoplist that hid
 * scoring_format_player_projection_points.total from check-renamed-column-consumers.
 * The LINE is deliberately not part of the key: an unrelated edit above a
 * finding must not stale its entry, because that teaches people to regenerate
 * the file wholesale rather than read it.
 */
const site_key = ({ reader, callee, property }) =>
  `${reader}|${callee}|${property}`

/**
 * Split findings into the ones an adjudication covers and the ones it does not,
 * and report every entry that covers nothing.
 *
 * An entry that no longer suppresses anything is itself a FINDING, so a
 * repaired site forces its entry out rather than leaving a standing exemption.
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
 * the control that drives it. A zero-file root lands in a counts-derived
 * missing set by construction, so feeding counts here would make the exclusion
 * list precisely the set the assertion fires on and every branch would go dead
 * with nothing in the output changing. That is `73a4c82f5`, and rewiring this
 * back to counts must fail a control rather than pass quietly.
 *
 * @returns {string[]} declared roots that do not exist or are empty
 */
export const coverage_exclusions = () => {
  const filesystem_corpus = resolve_corpus({
    roots: READER_ROOTS,
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
  // Which synthetic modules are READERS is decided on the repo-relative key,
  // not on the absolute path. Matching the absolute path would fold the
  // checkout's own directory names into the control's input, so a repo cloned
  // under a path containing `reader` would silently promote every synthetic
  // producer to a reader.
  const is_reader = (relative) => path.basename(relative).startsWith('reader-')
  return {
    reader_files: Object.keys(files)
      .filter(is_reader)
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
  const { reader_files, read_file, file_exists } = synthetic_tree(files)
  return analyze_returned_property_reads({
    reader_files,
    imports_map: {
      '#scripts/*': './scripts/*',
      '#libs-server': './libs-server/index.mjs'
    },
    read_file,
    file_exists
  })
}

/**
 * Each control's verdict is derived from what it DID, never from what it
 * expected. A gate that printed `[FAIL] WENT RED` for a control that went green
 * is in this repo's record.
 *
 * @returns {Array<{ name: string, went_red: boolean }>}
 */
export const run_negative_controls = () => {
  const controls = []

  // 1. THE REFERENCE INSTANCE, in miniature: a same-module producer returning
  //    { success, results }, a `let` receiver assigned in a try block, and a
  //    read of `reason` behind an `|| 'unknown error'` fallback. This is the
  //    exact shape of jobs/finalize-week.mjs before 93d5e025d.
  const same_module = run_synthetic({
    'jobs/reader-same-module.mjs': `
const finalize_week = async () => {
  const success = true
  const results = { steps_failed: [] }
  return { success, results }
}
export const main = async () => {
  let finalize_result
  finalize_result = await finalize_week()
  if (!finalize_result?.success) {
    throw new Error(\`failed: \${finalize_result?.reason || 'unknown error'}\`)
  }
  return finalize_result.results
}
`
  })
  controls.push({
    name: 'read of a key a SAME-MODULE producer never returns is reported',
    went_red:
      same_module.findings.length === 1 &&
      same_module.findings[0].property === 'reason' &&
      same_module.findings[0].callee === 'finalize_week'
  })

  // 2. The same defect arriving across an import edge.
  const named_import = run_synthetic({
    'scripts/producer-named.mjs': `
export const finalize_game = async () => {
  return { success: false, results: {} }
}
`,
    'libs-server/reader-named.mjs': `
import { finalize_game } from '#scripts/producer-named.mjs'
export const go = async () => {
  const result = await finalize_game()
  return result.reason
}
`
  })
  controls.push({
    name: 'read of a key an IMPORTED producer never returns is reported',
    went_red:
      named_import.findings.length === 1 &&
      named_import.findings[0].property === 'reason' &&
      named_import.findings[0].callee_file === 'scripts/producer-named.mjs'
  })

  // 3. Through the one re-export hop an index barrel actually uses.
  const barrel = run_synthetic({
    'scripts/producer-barrel-source.mjs': `
export default async () => ({ success: true, results: {} })
`,
    'libs-server/index.mjs': `
export { default as run_import } from '#scripts/producer-barrel-source.mjs'
`,
    'libs-server/reader-barrel.mjs': `
import { run_import } from '#libs-server'
export const go = async () => {
  const outcome = await run_import()
  return outcome.reason
}
`
  })
  controls.push({
    name: 'read resolved through one re-export hop is reported',
    went_red:
      barrel.findings.length === 1 && barrel.findings[0].property === 'reason'
  })

  // 4. THE DECOY, false-positive direction. The reader calls its OWN local
  //    `build_result`, which DOES return `reason`, while an unrelated module
  //    exports a same-named function that does not. A name-keyed resolver that
  //    reaches the other module's definition reports `reason` here; the correct
  //    one reports nothing, because resolution never leaves the reader's module
  //    for a name the reader itself declares. This is the control that pins the
  //    design CHOICE rather than the machinery, and it is the one that fires in
  //    the direction that gets a working gate weakened.
  const decoy = run_synthetic({
    'scripts/producer-decoy-other.mjs': `
export const build_result = () => ({ success: true })
`,
    'libs-server/reader-decoy.mjs': `
import { build_result as unrelated } from '#scripts/producer-decoy-other.mjs'
const build_result = () => ({ reason: 'no step reported a failure' })
export const go = () => {
  const other = unrelated()
  const mine = build_result()
  return [other.success, mine.reason]
}
`
  })
  controls.push({
    name: 'same-named function in another module is not matched (decoy)',
    went_red: decoy.findings.length === 0
  })

  // 5. THE DECOY's other half, which a UNION of same-named definitions would
  //    pass. The reader's own local returns only `success`, while an unrelated
  //    module's same-named export returns `reason` -- so a resolver that
  //    merged the two contracts would report nothing here. It must still fire.
  const union_decoy = run_synthetic({
    'scripts/producer-union-other.mjs': `
export const build_result = () => ({ reason: 'from the wrong module' })
`,
    'libs-server/reader-union.mjs': `
import { build_result as unrelated } from '#scripts/producer-union-other.mjs'
const build_result = () => ({ success: false })
export const go = () => {
  const other = unrelated()
  const mine = build_result()
  return [other.reason, mine.reason]
}
`
  })
  controls.push({
    name: 'contracts of same-named producers are not unioned (decoy)',
    went_red:
      union_decoy.findings.length === 1 &&
      union_decoy.findings[0].property === 'reason' &&
      union_decoy.findings[0].callee_file === 'libs-server/reader-union.mjs'
  })

  // 6. A spread in the returned literal means the key set is not knowable from
  //    the source, so it is a SKIP with a printed count and never a finding.
  const spread_return = run_synthetic({
    'libs-server/reader-spread.mjs': `
const build = ({ base }) => ({ ...base, success: true })
export const go = () => {
  const result = build({ base: {} })
  return result.reason
}
`
  })
  controls.push({
    name: 'a spread in the returned literal is a SKIP, not a finding',
    went_red:
      spread_return.findings.length === 0 &&
      spread_return.skipped.callee_return_spreads === 1
  })

  // 7. A producer whose return is dynamic is likewise unanalyzable. This is the
  //    largest honest blind spot and it must be counted rather than silent.
  const dynamic_return = run_synthetic({
    'libs-server/reader-dynamic.mjs': `
const build = ({ ok }) => (ok ? { success: true } : make_failure())
export const go = () => {
  const result = build({ ok: false })
  return result.reason
}
`
  })
  controls.push({
    name: 'a conditional or computed return is a SKIP, not a finding',
    went_red:
      dynamic_return.findings.length === 0 &&
      dynamic_return.skipped.callee_returns_non_literal === 1
  })

  // 8. A receiver written to after the call is no longer described by the
  //    producer, so the read is not judged.
  const mutated_receiver = run_synthetic({
    'libs-server/reader-mutated.mjs': `
const build = () => ({ success: false })
export const go = () => {
  const result = build()
  result.reason = 'set by the caller'
  return result.reason
}
`
  })
  controls.push({
    name: 'a receiver mutated after the call is a SKIP, not a finding',
    went_red:
      mutated_receiver.findings.length === 0 &&
      (mutated_receiver.skipped.receiver_escapes ?? 0) > 0
  })

  // 9. An UNAWAITED async call binds a promise, whose members are the promise's
  //    and not the producer's. Reporting against the producer's contract there
  //    would be a confident false positive.
  const unawaited = run_synthetic({
    'libs-server/reader-unawaited.mjs': `
const build = async () => ({ success: false })
export const go = () => {
  const pending = build()
  return pending.reason
}
`
  })
  controls.push({
    name: 'an unawaited async call is a SKIP, not a finding',
    went_red:
      unawaited.findings.length === 0 &&
      unawaited.skipped.call_not_awaited === 1
  })

  // 10. An adjudication covering nothing is reported STALE, so a repaired site
  //     forces its entry out instead of leaving a standing exemption.
  const stale_entry = apply_adjudications({
    findings: [
      { reader: 'jobs/live.mjs', callee: 'build', property: 'reason' }
    ],
    adjudications: [
      { reader: 'jobs/live.mjs', callee: 'build', property: 'reason' },
      { reader: 'jobs/repaired.mjs', callee: 'build', property: 'detail' }
    ]
  })
  controls.push({
    name: 'an adjudication that suppresses nothing is reported STALE',
    went_red:
      stale_entry.stale.length === 1 &&
      stale_entry.stale[0].reader === 'jobs/repaired.mjs' &&
      stale_entry.suppressed.length === 1 &&
      stale_entry.reportable.length === 0
  })

  // 11. Adjudications are keyed on the SITE. An entry must not suppress the
  //     same property at a DIFFERENT reader, which is the name-keyed stoplist
  //     this whole gate exists to avoid.
  const site_scoped = apply_adjudications({
    findings: [
      { reader: 'jobs/other.mjs', callee: 'build', property: 'reason' }
    ],
    adjudications: [
      { reader: 'jobs/live.mjs', callee: 'build', property: 'reason' }
    ]
  })
  controls.push({
    name: 'an adjudication does not suppress the same property at another reader',
    went_red:
      site_scoped.reportable.length === 1 && site_scoped.stale.length === 1
  })

  // 12. An ALL-unread corpus is the path-depth failure itself, not a narrowed
  //     verdict, and this gate fails on it. Driven through the same function
  //     `main` uses, so rewiring that function to counts breaks this control.
  const exclusions = coverage_exclusions()
  controls.push({
    name: 'coverage exclusions come from the filesystem, not from file counts',
    went_red:
      !exclusions.includes('libs-server') && !exclusions.includes('jobs')
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

  const reader_files = READER_ROOTS.flatMap((root) =>
    walk_directory({ directory: path.join(repo_root, root) })
  )

  const counts = count_files_by_root({
    files: reader_files,
    roots: READER_ROOTS,
    repo_root
  })

  // Two resolutions, one source each. This one is counts-driven and is what the
  // CORPUS block and the verdict suffix claim -- a root that yielded no files
  // cannot produce a finding, whatever the filesystem says.
  const corpus = resolve_corpus({ roots: READER_ROOTS, repo_root, counts })

  const { findings, skipped, judged } = analyze_returned_property_reads({
    reader_files,
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
    `${a.reader}:${String(a.line).padStart(6, '0')}:${a.property}`.localeCompare(
      `${b.reader}:${String(b.line).padStart(6, '0')}:${b.property}`
    )
  )

  for (const finding of sorted) {
    console.log(
      `${finding.reader}:${finding.line}  .${finding.property} read off ${finding.callee}()  ` +
        `never returned by ${finding.callee_file}  [returns: ${finding.returns.join(', ')}]`
    )
  }

  for (const entry of stale) {
    console.log(
      `STALE ADJUDICATION  ${entry.reader}  ${entry.callee}().${entry.property}  ` +
        'suppresses nothing -- remove the entry'
    )
  }

  console.log('')
  console.log(
    `${suppressed.length} finding(s) suppressed by ${ADJUDICATIONS_FILE}, ` +
      'none of them an approved shape.'
  )
  const by_verdict = new Map()
  for (const entry of adjudications) {
    by_verdict.set(entry.verdict, (by_verdict.get(entry.verdict) ?? 0) + 1)
  }
  for (const [verdict, count] of [...by_verdict].sort()) {
    console.log(`  ${String(count).padStart(4)}  entries  ${verdict}`)
  }
  console.log('')
  console.log(`${judged} read(s) judged against a resolved producer contract.`)
  console.log('')
  console.log('SKIPPED READS')
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
  const readable_roots = READER_ROOTS.filter((root) => !excluded.includes(root))
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

  // A zero over a corpus that was read is a claim; a zero over a corpus where
  // nothing was ANALYZABLE is the same confident zero the skip table exists to
  // expose, arriving as a green. Every skip reason is a way to reach it, so the
  // denominator is asserted rather than merely printed.
  if (judged === 0) {
    console.log(
      'GATE FAILED: no read was judged against a resolved producer contract.'
    )
    console.log('A zero finding count over zero judged reads is not a result.')
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
        `GATE FAILED: ${sorted.length} read(s) of a property their producer never returns.`
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
    `GATE OK: no read of a property its producer never returns${verdict_suffix(corpus)}`
  )
}

main()
