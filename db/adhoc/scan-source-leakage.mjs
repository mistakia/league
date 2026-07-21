// Source-leakage scan for the league four-layer redesign publish gate.
//
// The schema-standards guideline (user:guideline/league/database-schema-standards.md
// § Source obfuscation, § Publish gate) requires that no data-source vendor name,
// abbreviation, or allusion appears in any PUBLIC artifact — schema, migrations,
// data-view definition files and field ids, fixtures, seed data, comments. This is
// the tool that enforces it, the sibling of audit-schema-conformance.mjs: run it
// whole to see the standing leakage debt, or scoped (--path) to prove a migrated
// cluster's surface is clean before publish.
//
// This file is PUBLIC and committed, so it deliberately contains NO vendor names.
// The vendor legend — the code-to-vendor map and the full term list to scan for —
// lives only in the private submodule (private/source-legend.json) and is loaded at
// runtime. If the private submodule is not initialized (e.g. a production checkout),
// the scan cannot run and exits 2 (distinct from a leak finding, which exits 1).
//
// Usage:
//   node db/adhoc/scan-source-leakage.mjs                       # default public surface
//   node db/adhoc/scan-source-leakage.mjs --path db/adhoc/2026-07-19-x.sql  # scope
//   node db/adhoc/scan-source-leakage.mjs --summary             # counts only
//   node db/adhoc/scan-source-leakage.mjs --detail              # every occurrence
//   node db/adhoc/scan-source-leakage.mjs --json                # machine output
//   node db/adhoc/scan-source-leakage.mjs --selftest            # verify the matcher
//   node db/adhoc/scan-source-leakage.mjs --legend <path>       # override legend
//
// Exit codes: 0 = clean, 1 = leak(s) found (gate-friendly), 2 = legend unavailable.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.resolve(__dirname, '..', '..')

// --- legend loading ----------------------------------------------------------

const default_legend_path = path.join(
  repo_root,
  'private',
  'source-legend.json'
)

function load_legend(legend_path) {
  if (!fs.existsSync(legend_path)) {
    console.error(
      `source legend not found at ${legend_path}\n` +
        'The vendor legend lives only in the private submodule; this scan cannot\n' +
        'run without it. Initialize it (`git submodule update --init private`) or\n' +
        'pass --legend <path>. Exiting 2 (legend unavailable, not a clean pass).'
    )
    process.exit(2)
  }
  const raw = JSON.parse(fs.readFileSync(legend_path, 'utf8'))
  if (!Array.isArray(raw.sources)) {
    console.error(`legend at ${legend_path} has no "sources" array`)
    process.exit(2)
  }
  return raw
}

// --- matcher construction ----------------------------------------------------

// Turn one legend term into a case-insensitive word-boundary regex. A multi-word
// phrase ("pro football focus") is allowed to be joined by space, underscore, or
// hyphen, or nothing, so it also matches pro_football_focus / ProFootballFocus.
// The boundaries reject accidental substrings (`sis` does not match `basis`).
function term_to_regex(term) {
  const words = term
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return null
  const body = words.join('[\\s_\\-]*')
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'i')
}

function build_matchers(legend) {
  const matchers = []
  const seen = new Set()
  for (const source of legend.sources) {
    for (const term of source.terms || []) {
      const key = term.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const regex = term_to_regex(term)
      if (regex) {
        matchers.push({ term: key, vendor: source.vendor, regex })
      }
    }
  }
  return matchers
}

// Operator-ratified identifiers kept un-obfuscated (legend.accepted_kept_identifiers,
// e.g. the player table's retained pff/ngs columns). A vendor-term hit that falls
// INSIDE one of these exact identifiers is not a leak. The identifiers live in the
// private legend, not here, because they embed the very tokens this public file
// must never name. The same token anywhere else still flags.
function build_accepted(legend) {
  const ids = Array.isArray(legend.accepted_kept_identifiers)
    ? legend.accepted_kept_identifiers
    : []
  return ids.map((id) => new RegExp(`(?<![a-z0-9_])${id}(?![a-z0-9_])`, 'gi'))
}

// True if the hit at char index `idx` on `line` is inside an accepted identifier.
function covered_by_accepted(line, idx, accepted) {
  for (const re of accepted) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(line)) !== null) {
      if (idx >= m.index && idx < m.index + m[0].length) return true
    }
  }
  return false
}

// --- scan surface ------------------------------------------------------------

// The default public surface: the artifacts that form the published schema and
// query API, per the guideline's leakage-surface list. NOT the whole repo — vendor
// integration code under libs-server/ names its vendors legitimately, and the
// private importers live in the excluded private/ submodule. Each entry is a file
// or a directory; a directory is walked for the given extensions.
const default_targets = [
  { p: 'db/schema.postgres.sql' },
  { p: 'db/adhoc', exts: ['.sql'] },
  { p: 'db/migrations', exts: ['.sql'], optional: true },
  { p: 'db/seeds', exts: ['.sql', '.mjs', '.js'], optional: true },
  { p: 'libs-server/data-views-column-definitions', exts: ['.mjs', '.js'] },
  { p: 'app/core/data-views-fields', exts: ['.mjs', '.js'], optional: true },
  { p: 'libs-shared/data-view-fields-index.mjs', optional: true },
  { p: 'test', exts: ['.mjs', '.js', '.json'] }
]

const all_scan_exts = ['.sql', '.mjs', '.js', '.cjs', '.json']

// Directory names never descended into.
const excluded_dirs = new Set([
  'node_modules',
  '.git',
  'private',
  'data',
  'dist',
  'build',
  'coverage',
  'tmp'
])

// Migration/redesign tooling scripts legitimately reference retired vendor tokens
// and old names (they are the machinery that retires them), so they are excluded
// even when a --path sweeps their directory.
const excluded_files = new Set([
  'audit-schema-conformance.mjs',
  'scan-source-leakage.mjs',
  'generate-migration-inventory.mjs',
  'check-migration-coverage.mjs'
])

function walk_dir(abs, exts, out) {
  let entries
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excluded_dirs.has(entry.name)) continue
      walk_dir(path.join(abs, entry.name), exts, out)
    } else if (entry.isFile()) {
      if (excluded_files.has(entry.name)) continue
      if (exts && !exts.includes(path.extname(entry.name))) continue
      out.push(path.join(abs, entry.name))
    }
  }
}

function collect_files(targets) {
  const files = []
  for (const t of targets) {
    const abs = path.isAbsolute(t.p) ? t.p : path.join(repo_root, t.p)
    let stat
    try {
      stat = fs.statSync(abs)
    } catch {
      if (!t.optional) {
        console.error(`warning: scan target not found: ${t.p}`)
      }
      continue
    }
    if (stat.isDirectory()) {
      walk_dir(abs, t.exts || all_scan_exts, files)
    } else if (!excluded_files.has(path.basename(abs))) {
      files.push(abs)
    }
  }
  return [...new Set(files)]
}

// --- scanning ----------------------------------------------------------------

function scan_file(abs, matchers, accepted = []) {
  const findings = []
  let text
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch {
    return findings
  }
  const rel = path.relative(repo_root, abs)
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const m of matchers) {
      const hit = line.match(m.regex)
      if (hit) {
        if (covered_by_accepted(line, hit.index, accepted)) continue
        findings.push({
          file: rel,
          line: i + 1,
          column: hit.index + 1,
          term: m.term,
          vendor: m.vendor,
          snippet: line.trim().slice(0, 200)
        })
      }
    }
  }
  return findings
}

// --- self-test ---------------------------------------------------------------

// Proves the matcher flags a real vendor term and passes on an obfuscated name,
// which is the Verify step the plan names for this tool. Uses the FIRST loaded
// term but does not print its value (it is a private term).
function run_selftest(matchers) {
  if (!matchers.length) {
    console.error('selftest: no matchers loaded from legend')
    process.exitCode = 1
    return
  }
  const m = matchers[0]
  const positive = `    ${m.term}_player_id integer NOT NULL,`
  const negative = '    source_a1b2_player_id integer NOT NULL,'
  const flags_vendor = m.regex.test(positive)
  const passes_obfuscated = matchers.every((x) => !x.regex.test(negative))
  console.log('source-leakage scan self-test')
  console.log(`  matchers loaded:            ${matchers.length}`)
  console.log(`  flags a vendor identifier:  ${flags_vendor ? 'yes' : 'NO'}`)
  console.log(
    `  passes an obfuscated name:  ${passes_obfuscated ? 'yes' : 'NO'}`
  )
  const ok = flags_vendor && passes_obfuscated
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL')
  process.exitCode = ok ? 0 : 1
}

// --- reporting ---------------------------------------------------------------

function report(findings, targets, argv) {
  if (argv.json) {
    console.log(
      JSON.stringify(
        { scanned_targets: targets.map((t) => t.p), findings },
        null,
        2
      )
    )
    process.exitCode = findings.length ? 1 : 0
    return
  }

  const by_vendor = new Map()
  const by_file = new Map()
  for (const f of findings) {
    by_vendor.set(f.vendor, (by_vendor.get(f.vendor) || 0) + 1)
    by_file.set(f.file, (by_file.get(f.file) || 0) + 1)
  }

  console.log(
    `source-leakage scan -- ${findings.length} occurrence(s) across ${by_file.size} file(s)`
  )
  console.log('')
  console.log('by vendor:')
  for (const [vendor, n] of [...by_vendor.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${String(n).padStart(6)}  ${vendor}`)
  }

  if (!findings.length) {
    console.log('\nclean -- no source-revealing tokens in the scanned surface.')
    process.exitCode = 0
    return
  }

  console.log('\ntop files:')
  const top = [...by_file.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [file, n] of top) {
    console.log(`  ${String(n).padStart(6)}  ${file}`)
  }

  const show_detail = argv.detail || findings.length <= 200
  if (!argv.summary && show_detail) {
    console.log('\n--- detail ---')
    for (const f of findings) {
      console.log(
        `  ${f.file}:${f.line}:${f.column}  [${f.vendor}]  ${f.snippet}`
      )
    }
  } else if (!argv.summary) {
    console.log(
      `\n${findings.length} occurrences -- pass --detail to list all, or --path to scope to a cluster.`
    )
  }

  process.exitCode = 1
}

// --- runner ------------------------------------------------------------------

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('path', {
      type: 'array',
      description:
        'Scope the scan to these files/dirs instead of the default surface'
    })
    .option('legend', {
      type: 'string',
      description: 'Override the private legend path'
    })
    .option('summary', { type: 'boolean', default: false })
    .option('detail', { type: 'boolean', default: false })
    .option('json', { type: 'boolean', default: false })
    .option('selftest', { type: 'boolean', default: false })
    .help().argv

  const legend = load_legend(
    argv.legend || process.env.LEAGUE_SOURCE_LEGEND || default_legend_path
  )
  const matchers = build_matchers(legend)
  const accepted = build_accepted(legend)

  if (argv.selftest) {
    run_selftest(matchers)
    return
  }

  const targets = argv.path
    ? argv.path.map((p) => ({ p: String(p) }))
    : default_targets
  const files = collect_files(targets)
  const findings = []
  for (const abs of files) {
    findings.push(...scan_file(abs, matchers, accepted))
  }

  report(findings, targets, argv)
}

main()
