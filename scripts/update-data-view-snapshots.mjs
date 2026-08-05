import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import MockDate from 'mockdate'
import prettier from 'prettier'

import {
  get_data_view_results_query,
  load_data_view_test_queries,
  process_expected_query
} from '#libs-server'
import { compare_queries } from '#test/utils/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures_dir = path.join(__dirname, '..', 'test', 'data-view-queries')

// This script runs outside test/global.mjs, so it has no clock mock of its own.
// Honor the same LEAGUE_MOCK_DATE the suite honors, so a regeneration and a
// verification run can be pinned to the same instant.
if (process.env.LEAGUE_MOCK_DATE) {
  MockDate.set(process.env.LEAGUE_MOCK_DATE)
}

// Name the fixtures you intend to bless:
//   node scripts/update-data-view-snapshots.mjs some-fixture.json other.json
//
// An EMPTY filter list rewrites every fixture that currently mismatches, which
// silently absorbs a sibling session's uncommitted drift in this shared tree
// along with whatever you meant to regenerate. That is not a hypothetical: an
// argument list built from a `git diff` that happened to return nothing blessed
// 28 fixtures instead of 13 on 2026-08-05, with a success message and no gate
// downstream that could see it. A header comment warning about it was already
// here and did not prevent it, so the empty list is now refused and the
// whole-corpus regeneration has to be asked for by name.
const args = process.argv.slice(2)
const regenerate_all = args.includes('--all')
const filters = args
  .filter((arg) => arg !== '--all')
  .map((arg) => path.basename(arg))

if (!filters.length && !regenerate_all) {
  console.error(
    'Refusing to regenerate every mismatching fixture.\n' +
      'Name the fixtures to bless, or pass --all deliberately:\n' +
      '  node scripts/update-data-view-snapshots.mjs some-fixture.json other.json\n' +
      '  node scripts/update-data-view-snapshots.mjs --all'
  )
  process.exit(1)
}

if (filters.length && regenerate_all) {
  console.error('Pass filenames or --all, not both.')
  process.exit(1)
}

const main = async () => {
  const cases = await load_data_view_test_queries()
  const selected = filters.length
    ? cases.filter((test_case) => filters.includes(test_case.filename))
    : cases

  if (filters.length) {
    const matched = new Set(selected.map((test_case) => test_case.filename))
    for (const filter of filters) {
      if (!matched.has(filter)) {
        console.error(`no such fixture: ${filter}`)
        process.exit(1)
      }
    }
  }

  let updated = 0
  let skipped = 0
  let inert_skipped = 0
  for (const test_case of selected) {
    // A `skip_query_match` fixture's expected_query is inert -- the harness
    // logs its diff and continues, so the fixture cannot fail on a query
    // change. Rewriting one is bookkeeping, not coverage, and under --all it
    // is pure noise in the diff. Regenerate one only when it is named.
    if (!filters.length && test_case.skip_query_match) {
      inert_skipped++
      continue
    }
    if (test_case.expected_query && test_case.expected_query.includes('${')) {
      skipped++
      continue
    }
    try {
      const { query } = await get_data_view_results_query(test_case.request)
      const actual = query.toString()
      const expected = process_expected_query(test_case.expected_query)
      try {
        compare_queries(actual, expected)
        continue
      } catch (e) {}
      const raw = await fs.readFile(
        path.join(fixtures_dir, test_case.filename),
        'utf8'
      )
      const parsed = JSON.parse(raw)
      parsed.expected_query = actual
      const fixture_path = path.join(fixtures_dir, test_case.filename)
      // Format through prettier, not bare JSON.stringify: stringify always
      // expands short arrays while prettier collapses them, so the committed
      // goldens and a freshly regenerated one disagreed on every regeneration
      // and the pre-commit prettier guard blocked the commit.
      const formatted = await prettier.format(JSON.stringify(parsed), {
        ...(await prettier.resolveConfig(fixture_path)),
        filepath: fixture_path
      })
      await fs.writeFile(fixture_path, formatted)
      updated++
      console.log(`updated: ${test_case.filename}`)
    } catch (e) {
      console.error(`error ${test_case.filename}: ${e.message}`)
    }
  }
  console.log(
    `\n${updated} updated, ${skipped} template-skipped` +
      (inert_skipped ? `, ${inert_skipped} skip_query_match-skipped` : '')
  )
}

main().then(() => process.exit(0))
