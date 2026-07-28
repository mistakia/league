import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import prettier from 'prettier'

import {
  get_data_view_results_query,
  load_data_view_test_queries,
  process_expected_query
} from '#libs-server'
import { compare_queries } from '#test/utils/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures_dir = path.join(__dirname, '..', 'test', 'data-view-queries')

const main = async () => {
  const cases = await load_data_view_test_queries()
  let updated = 0
  let skipped = 0
  for (const test_case of cases) {
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
  console.log(`\n${updated} updated, ${skipped} template-skipped`)
}

main().then(() => process.exit(0))
