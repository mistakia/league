#!/usr/bin/env node

/**
 * Every automated `createPlayer` call site must sit behind a
 * `resolve_canonical_player` call that guards IT specifically.
 *
 * WHY THIS EXISTS. The `duplicate-person-rows` class is minted by exactly one
 * gap: an importer whose narrow matcher missed reads that miss as "this person
 * is new" and inserts a second row for someone already in the table. The
 * resolver closes the gap, and on 2026-08-28 it was wired into ONE of the eight
 * scripts that mint. Wiring the other seven is a one-time repair; keeping them
 * wired is not. Each call site is a place a future edit can drop the guard, and
 * nothing about that edit looks wrong -- the importer still runs, still creates
 * players, still passes its own tests. The duplicates reappear quietly, one
 * import cycle at a time, and surface months later as another round of
 * adjudication.
 *
 * Per docs/guides/gates.md, a checker with a verdict but no manifest entry is a
 * gate nobody runs, so this is registered in scripts/check-cluster-gates.mjs.
 *
 * ## The oracle, and the three ways the first version of it was wrong
 *
 * It parses each file and, for every call that resolves to `createPlayer`,
 * requires a call resolving to `resolve_canonical_player` earlier in the SAME
 * innermost enclosing function, matched one-guard-per-mint. Each of those three
 * words is load-bearing, because the first version got all three wrong and a
 * review had to run the predicate against synthetic modules to find it:
 *
 * - **INNERMOST, not outermost.** Scoping the search to the outermost enclosing
 *   function let a guard anywhere in a large function vouch for every mint in
 *   it, including one inside a sibling nested helper the mint path never calls.
 * - **ONE GUARD PER MINT.** A single guard satisfying every mint in a function
 *   meant a second, completely unguarded `createPlayer` loop added below a
 *   guarded one read as green -- which is precisely the "new mint path added to
 *   a file nobody re-read" case this gate claims to catch.
 * - **RESOLVED, not name-matched.** Matching the bare callee name would count a
 *   local function that happens to be called `createPlayer`, and would count a
 *   guard imported from somewhere unrelated. gates.md records that a name-keyed
 *   sweep of this tree measured roughly 50% false positives; both callees are
 *   resolved through the import edge with `db/gates/import-edge-resolution.mjs`,
 *   the same module the two other name-anchored gates share, so a rewiring back
 *   to name matching fails their decoys and this one together.
 *
 * A green here still does NOT mean the caller branched on the verdict
 * correctly, or asked about the same person it then creates -- those are the
 * tests' job, in test/scripts.player-mint-guard.spec.mjs, which drives the
 * shipped importer against a real fixture pair and asserts row counts.
 *
 * A new file that calls createPlayer is a FAILURE here until it is classified,
 * which is the point -- an unclassified minter is the exact thing that got us
 * eight scripts with one guard.
 */

import fs from 'fs'
import path from 'path'

import {
  CORPUS_INCOMPLETE_MARKER,
  resolve_corpus,
  count_files_by_root,
  format_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import {
  repo_root,
  parse_module,
  resolve_specifier,
  collect_import_bindings,
  resolve_exported_function
} from './import-edge-resolution.mjs'
import { format_negative_controls } from './negative-control.mjs'

/*
  The modules that DEFINE the two functions. Resolution compares the file a
  callee resolves to against these, rather than comparing the callee's spelling
  against a name -- so an importer that renames its local binding is still
  matched, and a same-named local function is not.
*/
const MINT_DEFINITION = 'libs-server/create-player.mjs'
const GUARD_DEFINITION = 'libs-server/resolve-canonical-player.mjs'

/*
  Declared corpus. These are TOP-LEVEL roots because scan-corpus attributes a
  file to a root by its first path segment; `private` rather than
  `private/scripts` is what lets its per-root count be reported honestly.

  `private` is the standing incomplete-corpus case: no GitHub workflow checks
  the submodule out, so on a CI runner it is an empty directory holding three of
  this gate's guarded mint sites. That narrowing is REPORTED rather than
  silently tolerated -- see the CORPUS block this prints.
*/
const SCAN_ROOTS = ['scripts', 'private', 'jobs', 'libs-server', 'db']

/*
  Every file that calls createPlayer and is NOT held to the guard, each with the
  reason. This list is the gate's editorial content: adding an entry is how a
  reviewer says "a duplicate here is not a silent failure", and it should be
  hard to add one without meaning it.
*/
const EXEMPT = new Map([
  [
    'libs-server/create-player.mjs',
    "createPlayer itself. The guard is the CALLER's question -- pushing it in here would make an unconditional refusal that operator tools could not override."
  ],
  [
    'scripts/resolve-player-match.mjs',
    'Operator-directed. `action_create_player` is an explicit subcommand a human typed; a deliberate create is the point, and refusing would break the legitimate case of minting the second of two genuine namesakes. It WARNS with candidate pids instead -- see the comment at that call site.'
  ],
  [
    'db/adhoc/2026-08-24-untangle-gsis-conflict-conflations.mjs',
    'A dated one-shot adhoc that has already run, minting a single hardcoded row. It is a historical artifact, not a path that mints again.'
  ]
])

const imports_map = JSON.parse(
  fs.readFileSync(path.join(repo_root, 'package.json'), 'utf8')
).imports

/**
 * Recursive, because the first version used a flat `readdirSync` and could not
 * see `scripts/platform-collectors/`, `scripts/social-cards/` or the twenty-odd
 * directories under `libs-server/` -- so a new unguarded minter one level down
 * produced GATE OK and exit 0.
 *
 * @param {object} params
 * @param {string} params.directory
 * @param {(file: string) => boolean} params.file_exists
 * @param {string[]} [params.files]
 * @returns {string[]} absolute paths
 */
const walk_directory = ({ directory, file_exists, files = [] }) => {
  let entries
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      walk_directory({ directory: full, file_exists, files })
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full)
    }
  }
  return files
}

/**
 * Which of the two tracked functions this call resolves to, or null.
 *
 * @param {object} params
 * @param {object} params.callee
 * @param {Map<string, { specifier: string, imported: string }>} params.import_bindings
 * @param {string} params.file absolute path of the calling module
 * @param {Map<string, object>} params.cache
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @returns {'mint' | 'guard' | null}
 */
const classify_callee = ({
  callee,
  import_bindings,
  file,
  cache,
  read_file,
  file_exists
}) => {
  // Only a bare identifier can carry an import binding. A member call
  // (`libs.createPlayer()`) has no edge to resolve and is deliberately NOT
  // treated as a mint -- guessing from the property name is the name matching
  // this gate exists to avoid. No such call exists in the tree today; if one
  // appears it will surface as an unguarded-looking site somewhere else, or as
  // the denominator moving.
  if (callee.type !== 'Identifier') return null

  const binding = import_bindings.get(callee.name)
  if (!binding) return null

  const target = resolve_specifier({
    specifier: binding.specifier,
    from_file: file,
    imports_map,
    file_exists
  })
  if (!target) return null

  const resolved = resolve_exported_function({
    file: target,
    export_name: binding.imported,
    imports_map,
    cache,
    read_file,
    file_exists
  })
  if (!resolved || resolved.skip) return null

  const relative = path.relative(repo_root, resolved.file)
  if (relative === MINT_DEFINITION) return 'mint'
  if (relative === GUARD_DEFINITION) return 'guard'
  return null
}

/**
 * The innermost function enclosing a node, identified by its start offset.
 *
 * @param {object[]} ancestors innermost-first
 * @returns {number|null}
 */
const innermost_function_start = (ancestors) => {
  for (const node of ancestors) {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ObjectMethod' ||
      node.type === 'ClassMethod'
    ) {
      return node.start
    }
  }
  return null
}

/**
 * Unguarded mint sites in one already-parsed module.
 *
 * @param {object} params
 * @param {object} params.program
 * @param {string} params.file absolute path
 * @param {Map<string, object>} params.cache
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @returns {{ mints: object[], unguarded: object[] }}
 */
const analyze_module = ({ program, file, cache, read_file, file_exists }) => {
  const import_bindings = collect_import_bindings({ program })
  const mints = []
  const guards = []

  // Ancestors are tracked explicitly because the enclosing-function scope is the
  // whole oracle here, and the shared walk_ast generator yields nodes without
  // the ancestor chain needed to compute it.
  const visit = (node, ancestors) => {
    if (!node || typeof node.type !== 'string') return
    if (node.type === 'CallExpression') {
      const kind = classify_callee({
        callee: node.callee,
        import_bindings,
        file,
        cache,
        read_file,
        file_exists
      })
      if (kind === 'guard') {
        guards.push({
          start: node.start,
          function_start: innermost_function_start(ancestors)
        })
      } else if (kind === 'mint') {
        mints.push({
          start: node.start,
          line: node.loc ? node.loc.start.line : 0,
          function_start: innermost_function_start(ancestors)
        })
      }
    }

    const next = [node, ...ancestors]
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue
      const value = node[key]
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child, next)
        }
      } else if (value && typeof value.type === 'string') {
        visit(value, next)
      }
    }
  }
  visit(program, [])

  /*
    One guard per mint, consumed in source order. A single guard vouching for
    every mint in a function is what let a second unguarded loop pass; matching
    greedily and CONSUMING the guard means the second mint needs its own.
  */
  const available = guards
    .slice()
    .sort((left, right) => left.start - right.start)
  const unguarded = []

  for (const mint of mints.slice().sort((l, r) => l.start - r.start)) {
    const index = available.findIndex(
      (guard) =>
        guard.function_start === mint.function_start && guard.start < mint.start
    )
    if (index === -1) unguarded.push(mint)
    else available.splice(index, 1)
  }

  return { mints, unguarded }
}

/**
 * @param {object} params
 * @param {string[]} params.files absolute paths
 * @param {(file: string) => string} params.read_file
 * @param {(file: string) => boolean} params.file_exists
 * @returns {{ findings: string[], mint_sites: number, scanned: string[], exempt_seen: Set<string> }}
 */
const run_scan = ({ files, read_file, file_exists }) => {
  const cache = new Map()
  const findings = []
  const exempt_seen = new Set()
  const scanned = []
  let mint_sites = 0

  for (const file of files) {
    const relative = path.relative(repo_root, file)

    let source
    try {
      source = read_file(file)
    } catch {
      continue
    }
    // A file with no mention at all cannot hold a call, and parsing every file
    // in these roots is the slow path for no gain.
    if (!source.includes('createPlayer')) continue
    scanned.push(relative)

    if (EXEMPT.has(relative)) {
      exempt_seen.add(relative)
      continue
    }

    const parsed = parse_module({ file, cache, read_file })
    if (!parsed) continue

    const { mints, unguarded } = analyze_module({
      program: parsed.program,
      file,
      cache,
      read_file,
      file_exists
    })
    mint_sites += mints.length

    for (const mint of unguarded) {
      findings.push(
        `${relative}:${mint.line} calls createPlayer with no resolve_canonical_player guarding it in the enclosing function`
      )
    }
  }

  return { findings, mint_sites, scanned, exempt_seen }
}

/*
  Controls. The first three prove the gate can SEE a defect; the last two are
  DECOYS, proving it can tell a defect from a look-alike. gates.md requires the
  pair for any oracle that could be written as a name match: singly, "reported"
  and "did not report" are each consistent with a scanner broken in one
  direction.

  Each synthetic module imports the REAL create-player/resolve-canonical-player
  through the real package imports map, so the controls exercise the actual
  resolution path rather than a stub of it.
*/
const SYNTHETIC_ROOT = 'scripts/__control__'

const run_synthetic = (modules) => {
  const virtual = new Map(
    Object.entries(modules).map(([relative, source]) => [
      path.join(repo_root, relative),
      source
    ])
  )
  const read_file = (file) =>
    virtual.has(file) ? virtual.get(file) : fs.readFileSync(file, 'utf8')
  const file_exists = (file) => virtual.has(file) || fs.existsSync(file)

  return run_scan({ files: [...virtual.keys()], read_file, file_exists })
}

const control_results = () => {
  const guarded = `
import { createPlayer, resolve_canonical_player } from '#libs-server'
export const run = async (items) => {
  for (const item of items) {
    const resolution = await resolve_canonical_player({ name: item.name })
    if (resolution.status !== 'new') continue
    await createPlayer(item)
  }
}
`

  const unguarded = `
import { createPlayer } from '#libs-server'
export const run = async (items) => {
  for (const item of items) await createPlayer(item)
}
`

  const guard_after_create = `
import { createPlayer, resolve_canonical_player } from '#libs-server'
export const run = async (items) => {
  for (const item of items) {
    const player = await createPlayer(item)
    const resolution = await resolve_canonical_player({ name: item.name })
    if (resolution.status !== 'new') return null
    return player
  }
}
`

  // The regression the review found: a guarded loop followed by a second,
  // entirely unguarded one in the same function.
  const second_mint_path = `
import { createPlayer, resolve_canonical_player } from '#libs-server'
export const run = async (items, extras) => {
  for (const item of items) {
    const resolution = await resolve_canonical_player({ name: item.name })
    if (resolution.status !== 'new') continue
    await createPlayer(item)
  }
  for (const extra of extras) await createPlayer(extra)
}
`

  // The other half of it: a guard in a sibling nested helper the mint path
  // never calls.
  const sibling_helper_guard = `
import { createPlayer, resolve_canonical_player } from '#libs-server'
export const run = async (items) => {
  const never_called = async (name) => resolve_canonical_player({ name })
  for (const item of items) await createPlayer(item)
}
`

  // DECOY 1: a LOCAL function named createPlayer. A name-keyed oracle reports
  // this; a resolved one must not.
  const decoy_local_definition = `
const createPlayer = async (row) => ({ ...row })
export const run = async (items) => {
  for (const item of items) await createPlayer(item)
}
`

  // DECOY 2: a createPlayer imported from an UNRELATED module. Same spelling,
  // different definition, no duplicate-person risk.
  const decoy_foreign_import = `
import { createPlayer } from '#scripts/__control__/other-factory.mjs'
export const run = async (items) => {
  for (const item of items) await createPlayer(item)
}
`
  const other_factory = `
export const createPlayer = (row) => ({ ...row })
`

  const findings_for = (modules) => run_synthetic(modules).findings.length

  return [
    {
      name: 'an unguarded createPlayer is reported',
      went_red: findings_for({ [`${SYNTHETIC_ROOT}/a.mjs`]: unguarded }) === 1
    },
    {
      name: 'a guarded createPlayer is NOT reported',
      went_red: findings_for({ [`${SYNTHETIC_ROOT}/b.mjs`]: guarded }) === 0
    },
    {
      name: 'a guard placed AFTER the create is reported',
      went_red:
        findings_for({ [`${SYNTHETIC_ROOT}/c.mjs`]: guard_after_create }) === 1
    },
    {
      name: 'a SECOND unguarded mint path in a guarded function is reported',
      went_red:
        findings_for({ [`${SYNTHETIC_ROOT}/d.mjs`]: second_mint_path }) === 1
    },
    {
      name: 'a guard in a sibling nested helper does NOT vouch for the mint',
      went_red:
        findings_for({ [`${SYNTHETIC_ROOT}/e.mjs`]: sibling_helper_guard }) ===
        1
    },
    {
      name: 'a LOCAL function named createPlayer is not matched (decoy)',
      went_red:
        findings_for({
          [`${SYNTHETIC_ROOT}/f.mjs`]: decoy_local_definition
        }) === 0
    },
    {
      name: 'a createPlayer imported from another module is not matched (decoy)',
      went_red:
        findings_for({
          [`${SYNTHETIC_ROOT}/g.mjs`]: decoy_foreign_import,
          [`${SYNTHETIC_ROOT}/other-factory.mjs`]: other_factory
        }) === 0
    }
  ]
}

const main = () => {
  const controls = control_results()
  console.log(format_negative_controls({ controls }))
  console.log('')

  const read_file = (file) => fs.readFileSync(file, 'utf8')
  const file_exists = (file) => fs.existsSync(file)

  const files = SCAN_ROOTS.flatMap((root) =>
    walk_directory({ directory: path.join(repo_root, root), file_exists })
  )

  const counts = count_files_by_root({ files, roots: SCAN_ROOTS, repo_root })
  const corpus = resolve_corpus({ roots: SCAN_ROOTS, repo_root, counts })
  console.log(format_corpus({ corpus, counts }))
  console.log('')

  const { findings, mint_sites, exempt_seen } = run_scan({
    files,
    read_file,
    file_exists
  })

  // A stale exemption reads as a deliberate decision while excluding nothing --
  // the same silent-difference defect the .mocharc `ignore` list carries.
  const stale_exemptions = [...EXEMPT.keys()].filter(
    (relative) => !exempt_seen.has(relative)
  )

  for (const finding of findings) console.log(`UNGUARDED  ${finding}`)
  for (const relative of stale_exemptions) {
    console.log(
      `STALE EXEMPTION  ${relative} is exempted but no longer calls createPlayer`
    )
  }

  const failed_controls = controls.filter(({ went_red }) => !went_red)
  if (failed_controls.length) {
    console.log(
      `\nGATE CANNOT REPORT: ${failed_controls.length} negative control(s) did not behave as declared.`
    )
    process.exit(1)
  }

  /*
    An ALL-unread corpus is the path-depth failure, not a narrowed verdict:
    every scanner under db/ resolves the repo root by relative hops, so a file
    moved to a different depth reads zero files in every root and would
    otherwise exit 0 over nothing.
  */
  if (files.length === 0) {
    console.log('\nGATE FAILED: every declared root yielded zero files.')
    console.log('This is the path-depth failure, not a narrowed corpus.')
    process.exit(1)
  }

  /*
    The denominator, asserted rather than merely printed. Zero findings over
    zero resolved mint sites is not a result -- it is what a broken resolver,
    a renamed module or a wrong root set all look like from the outside.
  */
  if (mint_sites === 0) {
    console.log(
      '\nGATE FAILED: no createPlayer call resolved to libs-server/create-player.mjs.'
    )
    console.log(
      'A zero finding count over zero resolved mint sites is not a result.'
    )
    process.exit(1)
  }

  if (findings.length || stale_exemptions.length) {
    console.log(
      `\nGATE FAILED: ${findings.length} unguarded mint(s), ${stale_exemptions.length} stale exemption(s)`
    )
    process.exit(1)
  }

  console.log(
    `GATE OK: ${mint_sites} guarded mint site(s), ${EXEMPT.size} file(s) classified exempt${verdict_suffix(corpus)}`
  )
  if (corpus.missing.length) {
    console.log(
      `  ${CORPUS_INCOMPLETE_MARKER} means a mint path inside ${corpus.missing.join(', ')} was NOT checked.`
    )
  }
}

main()
