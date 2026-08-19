#!/usr/bin/env node

// Writes eslint-rules/bare-container-jsdoc-baseline.json -- the per-file
// allowance the no-bare-container-jsdoc rule ratchets against.
//
// The file set comes from ESLint ITSELF (`eslint . --format json`), not from a
// walk of its own. A walk would be a second, independently-drifting opinion
// about which files are linted, and the failure mode is silent in the worst
// direction: a file ESLint lints but the walk missed gets an allowance of zero
// and errors on every pre-existing tag, which reads as the rule being broken.
// The counts themselves come from the same detector the rule uses.
//
// `--check` is the RATCHET-DOWN half, and the reason this is a ratchet rather
// than a floor. It fails when a baseline entry is HIGHER than the file's real
// count -- that is, when someone fixed occurrences without lowering the
// allowance, leaving slack that a future regression could be reabsorbed into
// silently. Entries at or below reality are what the rule already enforces.
//
// Run: node eslint-rules/generate-bare-container-jsdoc-baseline.mjs [--check]

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

import { find_bare_containers } from './bare-container-jsdoc.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..')
const baseline_path = path.join(__dirname, 'bare-container-jsdoc-baseline.json')

const linted_files = () => {
  let stdout
  try {
    stdout = execFileSync(
      process.execPath,
      [
        path.join(repo_root, 'node_modules', '.bin', 'eslint'),
        '.',
        '--format',
        'json'
      ],
      { cwd: repo_root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
    )
  } catch (err) {
    // ESLint exits non-zero when it reports errors, which is expected here --
    // the JSON is still on stdout and is what this needs.
    stdout = err.stdout
  }

  if (!stdout) {
    console.error('FAIL: eslint produced no JSON output.')
    process.exit(2)
  }

  return JSON.parse(stdout).map((result) => result.filePath)
}

const main = () => {
  const files = linted_files()

  // A run that reached nothing would write an empty baseline, which reads as
  // "no violations anywhere" and disarms the rule for the whole tree.
  if (files.length < 100) {
    console.error(
      `FAIL: eslint reported only ${files.length} linted file(s) -- the run is not reaching the tree.`
    )
    process.exit(2)
  }

  const allowances = {}
  for (const file_path of files) {
    let source
    try {
      source = fs.readFileSync(file_path, 'utf8')
    } catch {
      continue
    }
    const count = find_bare_containers({ source }).length
    if (count) allowances[path.relative(repo_root, file_path)] = count
  }

  const sorted = Object.fromEntries(
    Object.entries(allowances).sort((a, b) => a[0].localeCompare(b[0]))
  )
  const total = Object.values(sorted).reduce((n, c) => n + c, 0)

  if (process.argv.includes('--check')) {
    const existing = JSON.parse(fs.readFileSync(baseline_path, 'utf8'))
    const stale = []
    for (const [file, allowance] of Object.entries(existing.allowances || {})) {
      const actual = sorted[file] || 0
      if (allowance > actual) stale.push({ file, allowance, actual })
    }

    if (stale.length) {
      console.error(
        `FAIL: ${stale.length} baseline entr(ies) allow more than the file actually contains.`
      )
      console.error(
        'Fixed occurrences must lower the allowance, or the slack lets a regression back in silently.'
      )
      for (const { file, allowance, actual } of stale) {
        console.error(`  ${file}: allows ${allowance}, actual ${actual}`)
      }
      console.error(
        '\nRegenerate with: node eslint-rules/generate-bare-container-jsdoc-baseline.mjs'
      )
      process.exit(1)
    }

    console.log(
      `bare-container JSDoc baseline current: ${Object.keys(existing.allowances || {}).length} file(s), ${total} occurrence(s) remaining`
    )
    return
  }

  const output = {
    description:
      'Per-file allowance for eslint-rules/no-bare-container-jsdoc. Occurrences beyond a file allowance are errors; a file absent here is allowed zero. Allowances only move DOWN -- --check fails on any entry that allows more than the file contains.',
    generated_by:
      'node eslint-rules/generate-bare-container-jsdoc-baseline.mjs',
    total_occurrences: total,
    allowances: sorted
  }

  fs.writeFileSync(baseline_path, `${JSON.stringify(output, null, 2)}\n`)
  console.log(
    `wrote eslint-rules/bare-container-jsdoc-baseline.json: ${Object.keys(sorted).length} file(s), ${total} occurrence(s)`
  )
}

main()
