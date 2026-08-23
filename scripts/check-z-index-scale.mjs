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

import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from '../db/gates/scan-corpus.mjs'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// Below this, a z-index orders siblings within a component and is not part of
// the global overlay space. Above it, the value only means something relative
// to other floating surfaces, and so has to be named.
const LOCAL_STACKING_CEILING = 100

// `app` only. `private` was listed here and could never match: this check reads
// .styl/.js/.jsx and that submodule is 64 .mjs files, two .json and a cron --
// no stylesheet and no JSX anywhere in it, so the root contributed a permanent
// zero that read as coverage. A declared root whose extensions cannot match is
// worse than an undeclared one, because it is indistinguishable from a clean
// scan. The corpus block below states the file count per root so a root that
// stops contributing is visible rather than silent.
const SEARCH_ROOTS = ['app']

const SCALE_FILE = path.join(repo_root, 'app/styles/variables.styl')

// z-index 1400  |  z-index: 1400  |  zIndex: 1400
const Z_INDEX_LITERAL = /(?:z-index|zIndex)\s*:?\s*(-?\d+)/

/**
 * A literal that is deliberately outside the scale. Each entry needs a reason.
 * Prefer moving the surface onto the scale over adding an entry here — an
 * exemption is a layer nobody can reason about from the scale alone.
 */
const ALLOWED_LITERALS = new Map()

const GLOBAL_STYLESHEET = path.join(repo_root, 'app/styles/general.styl')

/**
 * MUI overlay components carry their z-index in their own source
 * (theme.zIndex.*), so nothing in this repo is a literal the sweep above can
 * see. That blind spot is not hypothetical: Snackbar's library default of 1400
 * ties the selected-player drawer and loses to every dialog, and it survived
 * the first pass of this check precisely because there was no number to find.
 *
 * So each of these has to be pinned onto the scale in general.styl, by a rule
 * whose selector is COMPOUND. MUI's emotion class is a single class injected
 * after the app stylesheet, so a single-class pin ties on specificity and loses
 * on source order — it changes nothing, and nothing reports that it changed
 * nothing. The first version of this block was written single-class and was
 * entirely inert; the check below is what makes that state fail rather than
 * look fixed.
 *
 * A component this app stops using should leave this list rather than stay
 * unpinned.
 */
const MUI_OVERLAYS_REQUIRING_A_PIN = [
  '.MuiDialog-root',
  '.MuiPopover-root',
  '.MuiMenu-root',
  '.MuiAutocomplete-popper',
  '.MuiTooltip-popper',
  '.MuiSnackbar-root'
]

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

  // Each required MUI overlay must be pinned in general.styl by a rule whose
  // first declaration is a z-index taken from the scale. Reading the block
  // rather than just grepping for the class name is what makes this an
  // assertion — the selector appearing under some unrelated rule proves nothing.
  const global_lines = fs.readFileSync(GLOBAL_STYLESHEET, 'utf8').split('\n')
  const unpinned_overlays = MUI_OVERLAYS_REQUIRING_A_PIN.filter((selector) => {
    // Compound means at least two classes on one element — no descendant
    // combinator, which would select a child rather than raise specificity.
    const is_compound_pin = (line) =>
      /^(\.[A-Za-z0-9_-]+){2,},?$/.test(line) && line.includes(selector)

    const start = global_lines.findIndex((line) => is_compound_pin(line.trim()))
    if (start === -1) return true
    for (let index = start + 1; index < global_lines.length; index++) {
      const line = global_lines[index].trim()
      if (line === '' || line.startsWith('//')) return true
      if (line.startsWith('.') || line.startsWith('&')) continue
      return !/^z-index\s+\$z_[a-z0-9_]+$/.test(line)
    }
    return true
  })

  const violations = []

  // Declared per root so the count is the gate's OWN read, not a filesystem
  // guess: `private` is a submodule CI does not check out, and this check runs
  // in CI, so it has been reporting a clean scale over a root it never opened.
  const counts = {}
  for (const root of SEARCH_ROOTS) {
    counts[root] =
      list_files(path.join(repo_root, root), ['.styl']).length +
      list_files(path.join(repo_root, root), ['.js', '.jsx']).length
  }
  const corpus = resolve_corpus({ roots: SEARCH_ROOTS, repo_root, counts })
  console.log(format_corpus({ corpus, counts }))
  console.log('')

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
    duplicate_layers.length === 0 &&
    unpinned_overlays.length === 0
  ) {
    console.log(
      `z-index scale OK — ${scale_layers.size} named layers, ` +
        `${MUI_OVERLAYS_REQUIRING_A_PIN.length} MUI overlays pinned, no bare ` +
        `literals at or above ${LOCAL_STACKING_CEILING}` +
        verdict_suffix(corpus)
    )
    return 0
  }

  if (unpinned_overlays.length) {
    console.error(
      `\n${unpinned_overlays.length} MUI overlay(s) not pinned to the scale in ` +
        `${path.relative(repo_root, GLOBAL_STYLESHEET)}:\n`
    )
    for (const selector of unpinned_overlays) {
      console.error(`  ${selector}`)
    }
    console.error(
      "\nThese carry their z-index in MUI's own source (theme.zIndex.*), so " +
        'the literal sweep below cannot see them and an unpinned one fails ' +
        'silently — Snackbar defaults to 1400, which loses to every dialog. ' +
        'Add a rule whose first declaration is `z-index $z_<layer>`, or drop ' +
        'the selector from MUI_OVERLAYS_REQUIRING_A_PIN if the app no longer ' +
        'uses that component.\n'
    )
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
