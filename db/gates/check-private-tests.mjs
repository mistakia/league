// Runs the PRIVATE test suite (`yarn test:private`) as a gate, so the blind
// spot that let `private/test` rot has a named owner instead of a nobody.
//
// THE BLIND SPOT. `private/` is a submodule NO workflow checks out (there is no
// `submodules:` key anywhere under `.github/workflows`), so on the CI runner it
// is an EMPTY directory and `yarn test:private` is invoked by no workflow. The
// cost was concrete: private/test kept updating `seasons.year` long after the
// conform renamed the column to `season_year`, because every consumer sweep
// that would have caught it ran over a corpus `private/` was not in, and no
// gate ran the private suite at all.
//
// CAN CI RUN IT? No. The submodule is `git@github.com:mistakia/league-private.git`
// -- an SSH URL into a PRIVATE repo, and `mistakia/league` itself is PUBLIC
// (see contribution-guardrails.yml), so the runner has no deploy key and the
// job has no `submodules:` step. Checking the suite out in CI would be an
// operator security decision (provision SSH credentials with write access to
// league-private onto a public-repo runner), not a wiring one. So this gate
// does the honest thing the runner CAN see: it runs the suite wherever `private`
// IS present, and -- when the submodule is absent or empty -- it says so through
// the CORPUS block instead of printing an unqualified green. A green in CI and
// a green locally stop being the same claim.
//
// THREE STATES, THREE SENTENCES.
//   private absent/empty  -> CORPUS INCOMPLETE, exit 0. The narrowing is VISIBLE:
//                            `GATE OK (CORPUS INCOMPLETE: private)` is not a
//                            green over the private surface, it is a scoped one.
//                            CI's private-tests job asserts this marker is
//                            PRESENT, so a version of this gate that silently
//                            passed over nothing fails the job.
//   private present, no   -> TOOLING, exit 2. The suite is destructive: it drops
//   isolated test DB           and reloads every table in the database it is
//                            pointed at. Refusing to guess a target is the only
//                            safe default, and a gate that cannot run must be
//                            loud, never green.
//   private present, DB    -> run the real private suite (direct mocha, NOT
//                            `yarn test:private`, which blanks the port
//                            overrides and hangs on :5432). Exit with its code.
//
// THE DATABASE. Taken from the environment and deliberately NOT defaulted to the
// shared container: `mochaGlobalSetup` in test/global.mjs drops every table in
// whatever database it is pointed at, so running against the shared
// compose.test.yaml `league_test` on :5433 stomps any sibling. The gate refuses
// unless `LEAGUE_DB_DATABASE` names an ISOLATED `league_test_*` database the
// operator created, on an explicit host/port. It reads:
//   LEAGUE_DB_HOST      (default 127.0.0.1)
//   LEAGUE_DB_PORT      (default 5433)
//   LEAGUE_DB_DATABASE  (REQUIRED, must be `league_test_*` and != `league_test`)
//
// Usage:
//   node db/gates/check-private-tests.mjs
//   LEAGUE_DB_PORT=5547 LEAGUE_DB_DATABASE=league_test_privsuite \
//     node db/gates/check-private-tests.mjs
//
// Exit 0 on a clean private suite, or on a private corpus that is absent or
// empty (the CORPUS block carries the narrowing). Exit 1 on a private-suite
// failure. Exit 2 when the suite cannot run: no isolated database target, or
// the target is unreachable.
//
// NEGATIVE CONTROLS run on every invocation, proving the presence-detection
// that decides between "run the suite" and "report the corpus missing" cannot
// silently mislabel an uninitialized mountpoint as scanned -- the exact defect
// scan-corpus.mjs exists to catch.

import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import { format_negative_controls } from './negative-control.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// The submodule this gate exists to cover. Absence is the standing condition on
// every CI runner; presence is the local condition where the suite can run.
const PRIVATE_ROOT = 'private'
const PRIVATE_SUITE_GLOB = `${PRIVATE_ROOT}/test/**/*.spec.mjs`

// A private-suite database must be unmistakably this run's own. Requiring the
// `league_test_priv` stem keeps the destructive suite off `league_test` itself
// and off a shared slug, matching the guide's `league_test_<slug>` isolation
// convention with an extra marker so a future run cannot accidentally reuse a
// common one.
const is_isolated_db = (name) => /^league_test_priv/.test(name)

const count_files_recursive = (dir, exts = ['.mjs', '.js', '.json']) => {
  let count = 0
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    if (entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) count += count_files_recursive(full, exts)
    else if (!exts.length || exts.includes(path.extname(entry.name))) count += 1
  }
  return count
}

// The corpus, resolved from the FILESYSTEM. `counts` here is a files-count per
// root so a root that contributes no files is visible; the `private` root as an
// uninitialized mountpoint is EMPTY and therefore MISSING, never scanned.
const read_corpus = () => {
  const counts = {
    [PRIVATE_ROOT]: count_files_recursive(path.join(repo_root, PRIVATE_ROOT))
  }
  const corpus = resolve_corpus({
    roots: [PRIVATE_ROOT],
    repo_root,
    counts
  })
  return { corpus, counts }
}

// The suite command, mirroring the direct-mocha recipe in docs/guides/test.md
// rather than `yarn test:private`, which blanks the port overrides and hangs on
// the missing :5432 server. LEAGUE_SUITE_SUBSET suppresses the narrowed-run-only
// response-validation hold-out hook (see test/global.mjs mochaHooks.afterAll).
const suite_env = ({ host, port, database }) => ({
  ...process.env,
  LEAGUE_SUITE_SUBSET: '1',
  LEAGUE_DB_HOST: host,
  LEAGUE_DB_PORT: String(port),
  LEAGUE_DB_DATABASE: database,
  TZ: 'America/New_York',
  NODE_ENV: 'test',
  TEST: 'all'
})

const run_private_suite = ({ host, port, database }) => {
  const result = spawnSync(
    'node',
    [
      'node_modules/mocha/bin/mocha.js',
      '--exit',
      '--require',
      'test/global.mjs',
      '--reporter',
      'min',
      PRIVATE_SUITE_GLOB
    ],
    {
      cwd: repo_root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: suite_env({ host, port, database })
    }
  )
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.error)
    return { exit_code: 2, output: String(result.error.message) }
  return { exit_code: result.status, output }
}

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

// Runs on EVERY invocation and does not need the private submodule or a
// database: it drives the presence-detection that decides between scanning and
// reporting the corpus missing. The empty-vs-present distinction is the one
// scan-corpus.mjs records as the signature failure (an uninitialized submodule
// is a present, EMPTY mountpoint), so a regression there must turn the gate
// BLIND rather than silently pass.
const run_negative_controls = () => {
  const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-private-'))

  // A NON-EMPTY directory must read as a present root.
  const nonempty = path.join(tmp_dir, 'nonempty')
  fs.mkdirSync(nonempty, { recursive: true })
  fs.writeFileSync(path.join(nonempty, 'a.mjs'), '// x')

  // An EMPTY directory -- the uninitialized-submodule shape -- must read as
  // MISSING, never as scanned.
  const empty = path.join(tmp_dir, 'empty')
  fs.mkdirSync(empty, { recursive: true })

  const root = 'probe'
  const present = resolve_corpus({
    roots: [root],
    repo_root: tmp_dir,
    counts: { [root]: 1 }
  })
  const empty_corpus = resolve_corpus({
    roots: [root],
    repo_root: tmp_dir,
    counts: { [root]: 0 } // counts say zero files were read
  })
  const absent_corpus = resolve_corpus({
    roots: ['absent'],
    repo_root: tmp_dir,
    counts: { absent: undefined }
  })

  fs.rmSync(tmp_dir, { recursive: true, force: true })

  return [
    {
      name: 'a root with files reads as present, not missing',
      went_red: present.present.includes(root)
    },
    {
      name: 'an EMPTY root (uninitialized submodule) reads as MISSING, never as scanned',
      went_red: empty_corpus.missing.includes(root)
    },
    {
      name: 'an absent root reads as missing',
      went_red: absent_corpus.missing.includes('absent')
    }
  ]
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const main = () => {
  const { corpus, counts } = read_corpus()
  const controls = run_negative_controls()

  console.log(format_corpus({ corpus, counts }))
  console.log('')
  console.log(format_negative_controls({ controls }))
  console.log('')

  if (corpus.missing.includes(PRIVATE_ROOT)) {
    // The submodule is not present (CI) or not initialized. The narrowing is
    // carried by the CORPUS block and the verdict suffix; this is NOT a green
    // over the private surface.
    console.log(
      `PRIVATE TEST SUITE NOT RUN -- ${PRIVATE_ROOT} is not present, so this ` +
        'run cannot execute it. A green here is scoped to the roots marked ' +
        'scanned above, never a claim about private.\n'
    )
    console.log(`GATE OK.${verdict_suffix(corpus)}`)
    return 0
  }

  // The submodule is present, so the suite is runnable -- but only against an
  // ISOLATED test database. Refusing to guess a target keeps this destructive
  // suite off the shared container and off anything not clearly a test DB.
  const host = process.env.LEAGUE_DB_HOST || '127.0.0.1'
  const port = Number(process.env.LEAGUE_DB_PORT || 5433)
  const database = process.env.LEAGUE_DB_DATABASE
  if (!database || !is_isolated_db(database)) {
    console.error(
      `PRIVATE TEST SUITE CANNOT RUN -- set LEAGUE_DB_DATABASE to an isolated ` +
        'league_test_private* database. The private suite drops and reloads ' +
        'every table in whatever database it runs against, so it must never ' +
        'target the shared league_test or anything non-test.\n' +
        '  e.g. docker exec -u postgres <pg-container> psql -U league_test \\\n' +
        '       -d league_test -c "CREATE DATABASE league_test_privsuite OWNER league_test;"\n'
    )
    return 2
  }

  const { exit_code, output } = run_private_suite({ host, port, database })
  process.stdout.write(output)
  if (exit_code !== 0) {
    console.error(`\nPRIVATE TEST SUITE FAILED (exit ${exit_code})`)
    return 1
  }
  console.log('\nPRIVATE TEST SUITE OK.')
  return 0
}

process.exitCode = main()
