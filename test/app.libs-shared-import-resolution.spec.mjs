/* global describe it before */

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const expect = chai.expect

const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// The defect this exists for: `app/core/selectors.js` imported
// `is_within_daily_window` from `@libs-shared` for a day after the published
// slate deleted that export. Webpack resolves a missing named import to
// `undefined` rather than failing the build, so the bundle shipped and the
// call site threw `TypeError: is_within_daily_window is not a function` -- but
// only on the branch where a pick's window had opened while the pick ahead of
// it was still unmade, which is the one state the whole draft rail exists for.
// It was invisible in production only because the draft was paused, which
// makes every window null and short-circuits the `&&` before the call.
//
// A SOURCE scan, deliberately, because `app/` resolves the `@`-prefixed
// webpack aliases that mocha has no harness for -- the same reasoning that
// makes `test/app.connected-component-prop-contract.spec.mjs` a parse rather
// than a behavioral spec.
const SCAN_ROOTS = ['app', 'scripts', 'libs-server', 'jobs', 'api']

// Specifiers that resolve to `libs-shared/index.mjs`. A deep import
// (`@libs-shared/get-draft-window.mjs`) names its own file and is checked
// against that file instead.
const BARREL_SPECIFIERS = new Set(['@libs-shared', '#libs-shared'])

const walk_files = (dir, out = []) => {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    // A root that cannot be read must not read as an empty root -- that is how
    // a scan goes silently blind. Surfaced as a thrown error instead.
    throw new Error(`could not read scan root ${dir}: ${err.message}`)
  }

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      walk_files(full_path, out)
    } else if (/\.(mjs|js|jsx)$/.test(entry.name)) {
      out.push(full_path)
    }
  }

  return out
}

// The REAL named exports of a module, read by importing it rather than by
// parsing it. An earlier draft parsed the source and reported 30-odd false
// positives, because `libs-shared/index.mjs` re-exports through `export * from`
// and through namespace objects that no reasonable regex recovers. The module
// is isomorphic and reaches only `#`-prefixed and bare specifiers, so it loads
// under plain node with no harness.
const read_exported_names = async (specifier) => {
  const loaded = await import(specifier)
  return new Set(Object.keys(loaded))
}

// `import { a, b as c } from '<specifier>'` -- named imports only. A default
// or namespace import cannot be missing in this way.
//
// Block comments are stripped and the statement is anchored to the start of a
// line, because a COMMENTED-OUT import is not a consumer. Without both,
// `sync-orchestrator.mjs`'s `// import { constants } from '#libs-shared'`
// reports as a defect -- the same comment-is-not-a-consumer trap that blinded
// `check-saved-view-param-coverage`, arriving here as a false positive rather
// than a false negative.
const read_named_imports = (source) => {
  const imports = []
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '')

  for (const match of code.matchAll(
    /^[ \t]*import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm
  )) {
    const specifier = match[2]
    for (const clause of match[1].split(',')) {
      const name = clause
        .trim()
        .split(/\s+as\s+/)[0]
        .trim()
      if (name) imports.push({ name, specifier })
    }
  }

  return imports
}

describe('APP libs-shared import resolution', function () {
  const findings = []
  let checked_imports = 0
  let files_scanned = 0
  let unresolvable_modules = 0

  before(async () => {
    const barrel_exports = await read_exported_names('#libs-shared')

    const deep_export_cache = new Map()
    const resolve_deep = async (module_specifier) => {
      if (!deep_export_cache.has(module_specifier)) {
        // Webpack resolves `@libs-shared/job-constants` without an extension
        // and node does not, so a deep specifier is tried the way each
        // toolchain would resolve it before being called unresolvable.
        const candidates = [
          module_specifier,
          `${module_specifier}.mjs`,
          `${module_specifier}.js`,
          `${module_specifier}/index.mjs`
        ]

        let exports = null
        for (const candidate of candidates) {
          try {
            exports = await read_exported_names(candidate)
            break
          } catch (err) {
            continue
          }
        }

        // A module this cannot load is a module it cannot check, so the miss
        // is counted rather than silently skipped.
        if (!exports) unresolvable_modules += 1
        deep_export_cache.set(module_specifier, exports)
      }
      return deep_export_cache.get(module_specifier)
    }

    for (const root of SCAN_ROOTS) {
      for (const file_path of walk_files(path.join(repo_root, root))) {
        files_scanned += 1
        const source = fs.readFileSync(file_path, 'utf8')

        for (const { name, specifier } of read_named_imports(source)) {
          let available = null

          if (BARREL_SPECIFIERS.has(specifier)) {
            available = barrel_exports
          } else if (/^[@#]libs-shared\//.test(specifier)) {
            available = await resolve_deep(
              specifier.replace(/^[@#]libs-shared\//, '#libs-shared/')
            )
          }

          if (!available) continue

          checked_imports += 1
          if (!available.has(name)) {
            findings.push(
              `${path.relative(repo_root, file_path)} imports { ${name} } from '${specifier}', which does not export it`
            )
          }
        }
      }
    }
  })

  it('scans a corpus rather than reporting a vacuous zero', () => {
    // Without this an empty scan -- a moved directory, a regex that stopped
    // matching -- reads exactly like a clean result.
    expect(files_scanned, 'no files scanned').to.be.greaterThan(0)
    expect(
      checked_imports,
      'no libs-shared imports resolved'
    ).to.be.greaterThan(0)
    // A module this cannot load is a module it cannot check, so a rising count
    // here is coverage quietly draining away rather than a clean run.
    expect(
      unresolvable_modules,
      'libs-shared modules that would not load under plain node'
    ).to.equal(0)
  })

  it('resolves every named libs-shared import against a real export', () => {
    expect(findings, findings.join('\n')).to.deep.equal([])
  })
})
