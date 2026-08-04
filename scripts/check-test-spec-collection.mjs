#!/usr/bin/env node

/**
 * Fails when a test file under test/ is not collected by mocha.
 *
 * The defect this exists for: mocha's default spec glob is one level deep
 * (./test/*.{js,cjs,mjs}), so 13 spec files under test/ subdirectories — 205
 * tests — never ran in `yarn test` or in CI, and two of them had been failing
 * undetected. A file's LOCATION silently decided whether it was a test or a
 * decoration, and nothing reported the difference.
 *
 * The oracle is mocha's own resolution, not a reimplementation of it: this
 * loads the effective .mocharc through mocha's options loader and resolves the
 * file list through mocha's collect-files, so it tracks any change to `spec`,
 * `ignore`, `extension` or `recursive` without being told about it.
 *
 * Every intentionally-uncollected test file needs an entry in
 * INTENTIONALLY_UNCOLLECTED carrying a reason. That is the whole point: an
 * exclusion becomes a reviewed line in this file rather than an invisible
 * property of where someone happened to put a spec.
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const collect_files = require('mocha/lib/cli/collect-files.js')
const { loadOptions } = require('mocha/lib/cli/options.js')

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const test_root = path.join(repo_root, 'test')

// A file whose name matches one of these is a test file, and must either be
// collected or be listed below with a reason.
const TEST_FILE_PATTERN = /\.(spec|test)\.(js|cjs|mjs)$/

const INTENTIONALLY_UNCOLLECTED = new Map([
  [
    'test/importer-espn.spec.mjs',
    'excluded from `yarn test` and CI — hits the live ESPN API'
  ]
])

const list_test_files = (dir) => {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full_path = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...list_test_files(full_path))
    } else if (TEST_FILE_PATTERN.test(entry.name)) {
      found.push(full_path)
    }
  }
  return found
}

const main = () => {
  const options = loadOptions([])
  const { files: collected } = collect_files({
    spec: options.spec || ['./test'],
    ignore: options.ignore || [],
    file: options.file || [],
    sort: false,
    recursive: Boolean(options.recursive),
    extension: options.extension || ['js', 'cjs', 'mjs']
  })

  const collected_set = new Set(collected.map((file) => path.resolve(file)))
  const on_disk = list_test_files(test_root)

  const uncollected = []

  for (const full_path of on_disk) {
    const relative_path = path.relative(repo_root, full_path)
    if (collected_set.has(full_path)) {
      continue
    }
    if (INTENTIONALLY_UNCOLLECTED.has(relative_path)) {
      continue
    }
    uncollected.push(relative_path)
  }

  // An exemption for a file that IS collected (or no longer exists) is dead
  // weight that would mask a future regression, so it fails too.
  const dead_exemptions = [...INTENTIONALLY_UNCOLLECTED.keys()].filter(
    (relative_path) => {
      const full_path = path.join(repo_root, relative_path)
      return !fs.existsSync(full_path) || collected_set.has(full_path)
    }
  )

  if (uncollected.length === 0 && dead_exemptions.length === 0) {
    console.log(
      `test spec collection OK — ${on_disk.length} test files under test/, ` +
        `${on_disk.length - INTENTIONALLY_UNCOLLECTED.size} collected by mocha`
    )
    return 0
  }

  if (uncollected.length) {
    console.error(
      `\n${uncollected.length} test file(s) under test/ are NOT collected by mocha:\n`
    )
    for (const relative_path of uncollected) {
      console.error(`  ${relative_path}`)
    }
    console.error(
      '\nThese never run — not locally, not in CI. Every spec lives FLAT in ' +
        'test/, named test/<area>.<name>.spec.mjs, because mocha collects one ' +
        'level deep. Move them there (and see the note in .mocharc.yml on why ' +
        'a `spec` glob is NOT the fix), or add them to ' +
        'INTENTIONALLY_UNCOLLECTED in scripts/check-test-spec-collection.mjs ' +
        'with a reason.\n'
    )
  }

  if (dead_exemptions.length) {
    console.error(
      `\n${dead_exemptions.length} stale entr(ies) in INTENTIONALLY_UNCOLLECTED ` +
        '— the file is collected or no longer exists:\n'
    )
    for (const relative_path of dead_exemptions) {
      console.error(`  ${relative_path}`)
    }
    console.error(
      '\nRemove them so a real regression cannot hide behind one.\n'
    )
  }

  return 1
}

process.exit(main())
