#!/usr/bin/env node

/**
 * Fails when a stylesheet or component sets a global-layer z-index as a bare
 * numeric literal instead of taking it from the scale in app/styles/variables.styl.
 *
 * The defect this exists for: the app hand-rolls its nav drawer, its context
 * menu and several poppers, so their z-indexes share one unnamed space with
 * MUI's own layers (drawer 1200, modal 1300, tooltip 1500). Nothing declared
 * that space, so every collision was fixed by nudging one surface upward — and
 * each nudge silently jumped over every MUI layer in between. 6d8490f78 raised
 * the selected-player drawer to 1400 to clear the nav drawer at 1300, which put
 * it above every MUI Dialog; from then on the place-bid, sign-free-agent,
 * waiver and poach confirmations all opened BEHIND the panel that launched
 * them. Nothing failed — the dialog rendered, took focus and worked; it was
 * just not visible.
 *
 * A literal cannot be reviewed, because the reviewer cannot see what it is
 * above or below. A scale name can: $z_dialog is above $z_selected_player by
 * construction, and moving one layer is a diff in one file.
 *
 * Only values >= LOCAL_STACKING_CEILING are checked. A small z-index (1, 2, 10)
 * orders siblings inside one component and never participates in the overlay
 * space, so requiring a scale name there would be noise with no defect behind
 * it.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// Below this, a z-index orders siblings within a component and is not part of
// the global overlay space. Above it, the value only means something relative
// to other floating surfaces, and so has to be named.
const LOCAL_STACKING_CEILING = 100

const SEARCH_ROOTS = ['app', 'private']

const SCALE_FILE = path.join(repo_root, 'app/styles/variables.styl')

// z-index 1400  |  z-index: 1400  |  zIndex: 1400
const Z_INDEX_LITERAL = /(?:z-index|zIndex)\s*:?\s*(-?\d+)/

/**
 * A literal that is deliberately outside the scale. Each entry needs a reason.
 * Prefer moving the surface onto the scale over adding an entry here — an
 * exemption is a layer nobody can reason about from the scale alone.
 */
const ALLOWED_LITERALS = new Map()

const list_files = (dir, extensions) => {
  const found = []
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full_path = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...list_files(full_path, extensions))
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(full_path)
    }
  }
  return found
}

const read_scale_layers = () => {
  const source = fs.readFileSync(SCALE_FILE, 'utf8')
  const layers = new Map()
  for (const line of source.split('\n')) {
    const match = line.match(/^\$(z_[a-z0-9_]+)\s*=\s*(\d+)/)
    if (match) layers.set(`$${match[1]}`, Number(match[2]))
  }
  return layers
}

const main = () => {
  const scale_layers = read_scale_layers()

  if (scale_layers.size === 0) {
    console.error(
      `no $z_* layers found in ${path.relative(repo_root, SCALE_FILE)} — ` +
        'the scale is the oracle for this check, so an empty one means the ' +
        'check is vacuous rather than passing.\n'
    )
    return 1
  }

  // A scale that reuses a value cannot order the two layers that share it.
  const by_value = new Map()
  for (const [name, value] of scale_layers) {
    if (!by_value.has(value)) by_value.set(value, [])
    by_value.get(value).push(name)
  }
  const duplicate_layers = [...by_value.entries()].filter(
    ([, names]) => names.length > 1
  )

  const violations = []
  const files = [
    ...SEARCH_ROOTS.flatMap((root) =>
      list_files(path.join(repo_root, root), ['.styl'])
    ),
    ...SEARCH_ROOTS.flatMap((root) =>
      list_files(path.join(repo_root, root), ['.js', '.jsx'])
    )
  ]

  for (const full_path of files) {
    const relative_path = path.relative(repo_root, full_path)
    if (full_path === SCALE_FILE) continue

    const lines = fs.readFileSync(full_path, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const without_comment = line.replace(/\/\/.*$/, '')
      const match = without_comment.match(Z_INDEX_LITERAL)
      if (!match) return

      const value = Number(match[1])
      if (value < LOCAL_STACKING_CEILING) return

      const site = `${relative_path}:${index + 1}`
      if (ALLOWED_LITERALS.has(site)) return

      violations.push({ site, value, line: line.trim() })
    })
  }

  // An exemption for a site that no longer carries a literal is dead weight
  // that would mask the next regression at that line.
  const dead_exemptions = [...ALLOWED_LITERALS.keys()].filter((site) => {
    const [relative_path, line_number] = site.split(':')
    const full_path = path.join(repo_root, relative_path)
    if (!fs.existsSync(full_path)) return true
    const line = fs.readFileSync(full_path, 'utf8').split('\n')[
      Number(line_number) - 1
    ]
    if (!line) return true
    const match = line.replace(/\/\/.*$/, '').match(Z_INDEX_LITERAL)
    return !match || Number(match[1]) < LOCAL_STACKING_CEILING
  })

  if (
    violations.length === 0 &&
    dead_exemptions.length === 0 &&
    duplicate_layers.length === 0
  ) {
    console.log(
      `z-index scale OK — ${scale_layers.size} named layers, no bare literals ` +
        `at or above ${LOCAL_STACKING_CEILING}`
    )
    return 0
  }

  if (duplicate_layers.length) {
    console.error('\nlayers sharing one value in app/styles/variables.styl:\n')
    for (const [value, names] of duplicate_layers) {
      console.error(`  ${value} — ${names.join(', ')}`)
    }
    console.error(
      '\nTwo layers on the same value are ordered by DOM order, which is not ' +
        'something the scale can express. Give each its own value.\n'
    )
  }

  if (violations.length) {
    console.error(
      `\n${violations.length} bare z-index literal(s) at or above ` +
        `${LOCAL_STACKING_CEILING}:\n`
    )
    for (const { site, value, line } of violations) {
      console.error(`  ${site} — ${value}    ${line}`)
    }
    console.error(
      '\nA value in the global overlay space has to come from the scale in ' +
        'app/styles/variables.styl, which stylus-loader injects into every ' +
        'stylesheet (no import needed). Available layers:\n'
    )
    for (const [name, value] of [...scale_layers].sort((a, b) => a[1] - b[1])) {
      console.error(`  ${name} = ${value}`)
    }
    console.error(
      '\nIf none of them fits, add a layer to the scale rather than picking a ' +
        'number — the point is that the ordering is reviewable in one file. ' +
        'A genuinely exempt site goes in ALLOWED_LITERALS in ' +
        'scripts/check-z-index-scale.mjs with a reason.\n'
    )
  }

  if (dead_exemptions.length) {
    console.error(
      `\n${dead_exemptions.length} stale entr(ies) in ALLOWED_LITERALS — the ` +
        'site no longer carries a global-layer literal:\n'
    )
    for (const site of dead_exemptions) {
      console.error(`  ${site}`)
    }
    console.error(
      '\nRemove them so a real regression cannot hide behind one.\n'
    )
  }

  return 1
}

process.exit(main())
