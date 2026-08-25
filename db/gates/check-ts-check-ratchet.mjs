#!/usr/bin/env node

/**
 * The adopted-file ratchet for the incremental `//@ts-check` tier.
 *
 * WHAT IT GUARDS, AND WHY IT IS NOT `tsc`. `yarn check:types` answers "do the
 * checked files type-check", which is a question about the CODE. This answers a
 * different one: "is the set of checked files still what we committed to". Those
 * come apart in exactly one direction, and it is the direction that matters --
 * a session facing a type error can make `tsc` green by deleting one comment.
 * Nothing about the tree then looks wrong: the file still runs, the suite still
 * passes, `yarn check:types` still exits 0, and a producer that was covered
 * silently is not. That is the same shape as every "gate nobody ran" failure in
 * this repo, with the gate still running and its corpus quietly shrinking.
 *
 * The list is therefore checked in BOTH directions and is self-cleaning, the
 * same rule the adjudication files and the conformance baseline already carry:
 * a file that loses its pragma fails, and a file that gains one fails until it
 * is added. The second half is what keeps the list from decaying into a stale
 * artifact nobody updates -- adopting a file is one reviewed line, and there is
 * no way to adopt one quietly.
 *
 * CI-ELIGIBLE. It reads only the checked-out tree, needs no database, no base
 * ref, no network and no binary that is not node itself, so it cannot go red on
 * a sibling's in-flight migration. Its four negative controls run on every
 * invocation and a control that stays green fails the run.
 *
 * Run: node db/gates/check-ts-check-ratchet.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { format_negative_controls } from './negative-control.mjs'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const adoption_path = path.join(repo_root, 'db/gates/ts-check-adoption.json')

// The roots tsconfig.json includes. Kept in step with it deliberately rather
// than parsed out of it: a file carrying the pragma OUTSIDE those roots is not
// checked by anything, and would otherwise be adopted in name only.
const SCAN_ROOTS = [
  'libs-server',
  'libs-shared',
  'api',
  'db',
  'jobs',
  'scripts',
  'config'
]

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'private', 'data'])

// The pragma must be the first statement-free line, or the first line after a
// shebang. It is NOT enough to find the text anywhere: TypeScript honours it
// only ahead of the first statement, so a `// @ts-check` sitting halfway down a
// file is inert and must not read as adoption. The shebang case is load-bearing
// in the other direction -- `#!` is a syntax error anywhere but line 1, and a
// pragma inserted above one makes tsc report ONLY that parse error and suppress
// every semantic diagnostic in the whole program, which reads as a clean tree.
const carries_pragma = ({ source }) => {
  const lines = source.split('\n')
  const start = lines[0]?.startsWith('#!') ? 1 : 0
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue
    if (/^\/\/\s*@ts-check\b/.test(line)) return true
    // Any other content ends the prologue.
    return false
  }
  return false
}

const walk = ({ root }) => {
  const found = []
  const absolute_root = path.join(repo_root, root)
  if (!fs.existsSync(absolute_root)) return found

  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.name.endsWith('.mjs')) found.push(full)
    }
  }
  visit(absolute_root)
  return found
}

const collect_all_files = () =>
  SCAN_ROOTS.flatMap((root) => walk({ root })).sort()

const collect_adopted = ({ files, read }) => {
  const adopted = []
  for (const full of files) {
    if (carries_pragma({ source: read(full) })) {
      adopted.push(path.relative(repo_root, full))
    }
  }
  return adopted.sort()
}

const diff = ({ expected, actual }) => {
  const expected_set = new Set(expected)
  const actual_set = new Set(actual)
  return {
    lost: expected.filter((f) => !actual_set.has(f)),
    unlisted: actual.filter((f) => !expected_set.has(f))
  }
}

const main = () => {
  if (!fs.existsSync(adoption_path)) {
    console.error(
      `FAIL: ${path.relative(repo_root, adoption_path)} is missing.`
    )
    process.exit(2)
  }

  const declared = JSON.parse(fs.readFileSync(adoption_path, 'utf8'))
  const expected = [...(declared.files || [])].sort()

  const all_files = collect_all_files()
  const read = (f) => fs.readFileSync(f, 'utf8')

  // A walk that reaches nothing reports a clean, empty tree, so the run asserts
  // it found real material before it is allowed to conclude anything. The floor
  // is structural (each declared root must contribute), not a tuned number, so
  // ordinary churn cannot move it.
  if (!all_files.length) {
    console.error('FAIL: the scan reached no .mjs files at all.')
    process.exit(2)
  }
  for (const root of SCAN_ROOTS) {
    const contributed = all_files.filter((f) =>
      path.relative(repo_root, f).startsWith(`${root}${path.sep}`)
    )
    if (!contributed.length) {
      console.error(
        `FAIL: corpus root '${root}' contributed no files -- the walk is not reaching it.`
      )
      process.exit(2)
    }
  }

  const actual = collect_adopted({ files: all_files, read })
  const { lost, unlisted } = diff({ expected, actual })

  console.log(
    `ts-check adoption: ${actual.length} file(s) checked, ${all_files.length} scanned across ${SCAN_ROOTS.length} roots`
  )

  // NEGATIVE CONTROLS. Each mutates real corpus material in memory and asserts
  // the comparison reports it. They need a non-empty adopted set to work, so an
  // adoption list that silently emptied cannot report a green here either.
  const controls = []
  const record = (name, went_red) => controls.push({ name, went_red })

  if (!actual.length) {
    console.error('FAIL: no adopted files, so no control can be exercised.')
    process.exit(2)
  }

  const sample = actual[0]

  record(
    'a listed file losing its pragma is reported',
    diff({ expected, actual: actual.filter((f) => f !== sample) }).lost.length >
      0
  )
  record(
    'an unlisted file gaining a pragma is reported',
    diff({ expected, actual: [...actual, '__synthetic_adopted__.mjs'] })
      .unlisted.length > 0
  )
  // The prologue rule itself, in both directions -- this is the half that
  // decides a file IS adopted, so an over-eager reader would silently inflate
  // coverage and an under-eager one would report every adopted file as lost.
  record(
    'a pragma below the first statement does not count as adoption',
    carries_pragma({ source: "import x from 'y'\n// @ts-check\n" }) === false
  )
  record(
    'a pragma after a shebang does count as adoption',
    carries_pragma({ source: '#!/usr/bin/env node\n// @ts-check\n' }) === true
  )

  const failed_controls = controls.filter((c) => !c.went_red)
  // Printed through the shared formatter rather than hand-rolled: this gate ran
  // four healthy controls under its own `CONTROL WENT RED:` spelling, and the
  // cluster runner -- which anchors on the declared header -- reported it BLIND.
  console.log(format_negative_controls({ controls }))

  let failed = false

  if (lost.length) {
    failed = true
    console.error(
      `\nFAIL: ${lost.length} file(s) are listed as type-checked but no longer carry the pragma.`
    )
    console.error(
      'This is the ratchet slipping -- deleting the pragma is how a type error is made to disappear.'
    )
    for (const f of lost) console.error(`  ${f}`)
  }

  if (unlisted.length) {
    failed = true
    console.error(
      `\nFAIL: ${unlisted.length} file(s) carry the pragma but are not listed.`
    )
    console.error(
      `Add them to ${path.relative(repo_root, adoption_path)} -- adoption is a reviewed line, not a silent one.`
    )
    for (const f of unlisted) console.error(`  ${f}`)
  }

  if (failed_controls.length) {
    failed = true
    console.error(
      `\nGATE FAIL: ${failed_controls.length} negative control(s) did not go red.`
    )
  }

  if (failed) process.exit(1)
  console.log('GATE OK')
}

main()
