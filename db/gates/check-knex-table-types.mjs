#!/usr/bin/env node

// Asserts the generated knex table-type map is ACTUALLY IN EFFECT.
//
// WHY THIS GATE EXISTS AT ALL. `db/knex-tables.d.ts` augments knex's `Tables`
// interface so that `db('player')` resolves to `PlayerRow` in every checked
// file with no annotation of its own. An augmentation only applies if its file
// is in the program -- and every `include` pattern in tsconfig.json ends in
// `*.mjs`, which matches no `.d.ts`. So the file is listed there explicitly,
// and if that one line is ever dropped, reordered away, or lost to a reformat,
// the augmentation applies to NOTHING while `yarn check:types` keeps exiting 0
// and every file keeps looking covered. That is a vacuous green that is
// indistinguishable from a working one by exit code, which is precisely the
// class this repo has been bitten by three times across this tier's stages.
//
// The gate asserts two DIFFERENT things, and neither one subsumes the other.
//
// 1. The augmentation WORKS, as a red/green pair against a throwaway tsconfig
//    holding only the probe and the generated `.d.ts`:
//
//      RED  : with the augmentation in the program, a misspelled column on a
//             `db('player')` row is reported.
//      GREEN: with the augmentation removed, the SAME probe is silent.
//
//    The pair is what makes the result meaningful. The red alone would still
//    pass if something unrelated were reporting the error, and the green alone
//    proves nothing at all. This half catches a generator that emitted a
//    broken map, or a knex upgrade that moved `knex/types/tables`.
//
// 2. The augmentation is WIRED INTO THE REAL PROGRAM -- that tsconfig.json
//    lists the file. This is a separate check because the pair above builds
//    its own config and so stays green when the repo's `include` has lost the
//    line, which is the exact regression this gate exists for.
//
// The probe config is two files rather than the tree, so the whole gate costs
// a fraction of a full `tsc` run.
//
// Run: node db/gates/check-knex-table-types.mjs

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const tsconfig_path = path.join(repo_root, 'tsconfig.json')
const knex_tables_path = path.join(repo_root, 'db', 'knex-tables.d.ts')
const tsc_bin = path.join(repo_root, 'node_modules', 'typescript', 'bin', 'tsc')

// The probe reaches knex directly rather than through `#db`, so it does not
// depend on the package.json subpath import map and can live outside the repo
// roots. `frist_name` is the deliberate misspelling; `first_name` is a real
// `player` column, so the checker has something to suggest.
const PROBE_SOURCE = `import knex from 'knex'

const db = knex({ client: 'pg' })

export const probe = async () => {
  const rows = await db('player').select('*')
  return rows[0].frist_name
}
`

const run_tsc = ({ dir, include_augmentation }) => {
  const probe_path = path.join(dir, 'probe.mts')
  fs.writeFileSync(probe_path, PROBE_SOURCE)

  const files = include_augmentation
    ? [knex_tables_path, probe_path]
    : [probe_path]

  const config = {
    compilerOptions: {
      noEmit: true,
      target: 'es2022',
      lib: ['es2023', 'dom'],
      module: 'nodenext',
      moduleResolution: 'nodenext',
      strict: false,
      noImplicitAny: true,
      skipLibCheck: true,
      typeRoots: [path.join(repo_root, 'node_modules', '@types')]
    },
    files
  }

  const config_path = path.join(dir, 'tsconfig.probe.json')
  fs.writeFileSync(config_path, JSON.stringify(config, null, 2))

  try {
    execFileSync(process.execPath, [tsc_bin, '-p', config_path], {
      cwd: repo_root,
      encoding: 'utf8',
      stdio: 'pipe'
    })
    return ''
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`
  }
}

const main = () => {
  if (!fs.existsSync(knex_tables_path)) {
    console.error(
      'FAIL: db/knex-tables.d.ts is missing. Regenerate with: node db/tools/generate-schema-types.mjs'
    )
    process.exit(2)
  }

  // Structural half. Cheap, and it names the exact repair when it fires --
  // the behavioral half below would report the same breakage as a silent
  // probe without saying why.
  const tsconfig_source = fs.readFileSync(tsconfig_path, 'utf8')
  const is_listed = /^\s*"db\/knex-tables\.d\.ts",?\s*$/m.test(tsconfig_source)

  // The scratch dir sits UNDER the repo's node_modules, not in the system temp
  // dir. `nodenext` resolution walks up from the importing file looking for a
  // `node_modules`, so a probe in /tmp cannot find `knex` at all and both
  // halves of the pair fail on TS2307 instead of on the property read.
  const cache_root = path.join(repo_root, 'node_modules', '.cache')
  fs.mkdirSync(cache_root, { recursive: true })
  const dir = fs.mkdtempSync(path.join(cache_root, 'knex-table-types-'))
  let with_augmentation
  let without_augmentation
  try {
    with_augmentation = run_tsc({ dir, include_augmentation: true })
    without_augmentation = run_tsc({ dir, include_augmentation: false })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  // TS2551 is "did you mean" -- it fires only when the checker knows the real
  // property set. TS2339 is the same finding without a near-miss suggestion,
  // and either one means the row type reached the read.
  const went_red = /error TS(2551|2339)/.test(with_augmentation)
  const stayed_green = !/error TS/.test(without_augmentation)

  console.log(
    `  CONTROL ${went_red ? 'WENT RED' : 'STAYED GREEN'}: a misspelled column is reported WITH the augmentation`
  )
  console.log(
    `  CONTROL ${stayed_green ? 'WENT GREEN' : 'STAYED RED'}: the same probe is silent WITHOUT it`
  )
  console.log(
    `  tsconfig.json lists db/knex-tables.d.ts in "include": ${is_listed ? 'yes' : 'NO'}`
  )

  let failed = false

  if (!went_red) {
    failed = true
    console.error(
      '\nFAIL: the misspelled column was NOT reported, so `db(<table>)` is not resolving to a row type.'
    )
    console.error('Regenerate: node db/tools/generate-schema-types.mjs')
    console.error(with_augmentation.trim() || '(tsc produced no output)')
  }

  if (!stayed_green) {
    failed = true
    console.error(
      '\nFAIL: the probe reported errors WITHOUT the augmentation, so the red above proves nothing.'
    )
    console.error(without_augmentation.trim())
  }

  if (!is_listed) {
    failed = true
    console.error(
      '\nFAIL: tsconfig.json does not list "db/knex-tables.d.ts" in "include".'
    )
    console.error(
      'Every other include pattern ends in *.mjs and matches no .d.ts, so the augmentation'
    )
    console.error(
      'applies to nothing across the tree while `yarn check:types` still exits 0.'
    )
  }

  if (failed) process.exit(1)
  console.log('GATE OK')
}

main()
