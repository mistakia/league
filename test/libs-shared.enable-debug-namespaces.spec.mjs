/* global describe before after it */
import { expect } from 'chai'
import { spawnSync } from 'child_process'
import fs from 'fs'

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..')
const helper = path.join(repo_root, 'libs-shared/enable-debug-namespaces.mjs')

// This has to run OUT OF PROCESS. The enabled namespace set is process-global
// state established during ESM evaluation, so the property under test is about
// module evaluation ORDER -- a mocha spec sharing one process with 300 other
// files cannot observe it, and importing the helper here would only measure the
// suite's own already-settled state.
//
// The graph is deliberately three modules deep with the entry point's own call
// LAST, because that is the shape that fails under a bare debug.enable: ESM
// evaluates lib_a and lib_b before the entry body, enable() REPLACES the set,
// and the entry's own call then leaves only its namespace alive. That is the
// production defect this helper exists to remove (2026-08-03, prop write path).
const module_sources = {
  'lib-a.mjs': `
import debug from 'debug'
import { enable_debug_namespaces } from '${helper}'
const log = debug('ns-a')
enable_debug_namespaces('ns-a')
export const run_a = () => log('A')
`,
  'lib-b.mjs': `
import debug from 'debug'
import { enable_debug_namespaces } from '${helper}'
const log = debug('ns-b')
enable_debug_namespaces('ns-b')
export const run_b = () => log('B')
`,
  'entry.mjs': `
import debug from 'debug'
import { enable_debug_namespaces } from '${helper}'
import { run_a } from './lib-a.mjs'
import { run_b } from './lib-b.mjs'
const log = debug('ns-entry')
enable_debug_namespaces('ns-entry')
log('ENTRY')
run_a()
run_b()
`
}

// debug writes to stderr. Which namespaces are live is read off which of the
// three marker lines appear, rather than off any internal of the debug module.
const namespaces_that_logged = (stderr) =>
  ['ns-entry', 'ns-a', 'ns-b'].filter((ns) =>
    new RegExp(`\\b${ns}\\b`).test(stderr)
  )

describe('enable_debug_namespaces', function () {
  let dir

  before(function () {
    // Inside the repo, not os.tmpdir(): the fixtures import 'debug' by bare
    // specifier and must resolve it to the SAME module instance the helper
    // uses, which only holds under the repo's own node_modules. From a system
    // temp directory the fixture dies on ERR_MODULE_NOT_FOUND.
    const scratch_root = path.join(repo_root, 'tmp')
    fs.mkdirSync(scratch_root, { recursive: true })
    dir = fs.mkdtempSync(path.join(scratch_root, 'enable-debug-namespaces-'))
    for (const [name, source] of Object.entries(module_sources)) {
      fs.writeFileSync(path.join(dir, name), source)
    }
  })

  after(function () {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const run = (env) => {
    const result = spawnSync('node', [path.join(dir, 'entry.mjs')], {
      encoding: 'utf8',
      // The parent environment can carry a DEBUG of its own (an interactive
      // shell often does), which would silently make every case here the
      // "explicit DEBUG" case and the union assertion vacuous.
      env: { ...process.env, DEBUG: undefined, ...env }
    })
    if (result.status !== 0) {
      throw new Error(`fixture exited ${result.status}: ${result.stderr}`)
    }
    return namespaces_that_logged(result.stderr)
  }

  it('unions namespaces across the import graph rather than replacing them', function () {
    // The whole point: every module that asked is still enabled afterwards,
    // regardless of the order ESM evaluated them in.
    expect(run({}).sort()).to.deep.equal(['ns-a', 'ns-b', 'ns-entry'])
  })

  it('leaves an explicit DEBUG authoritative', function () {
    // A module list is only the default for a bare CLI run. When the operator
    // (or a pm2 config, which is how all three workers are configured) states
    // DEBUG, nothing in the tree may widen it.
    expect(run({ DEBUG: 'ns-b' })).to.deep.equal(['ns-b'])
  })

  it('does not treat the DEBUG it writes itself as an explicit DEBUG', function () {
    // The regression guard for the trap that broke the first version of this
    // helper. debug.enable() calls save(), which on node assigns
    // process.env.DEBUG -- so a per-call read of the variable sees the value
    // this function just wrote and treats every subsequent module as
    // overridden, collapsing the union back to whichever module was imported
    // first. Asserted as "more than one namespace survives", which is false
    // under that bug and true under any correct implementation.
    expect(run({}).length).to.be.greaterThan(1)
  })
})
