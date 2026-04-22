import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

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
      await fs.writeFile(
        path.join(fixtures_dir, test_case.filename),
        JSON.stringify(parsed, null, 2) + '\n'
      )
      updated++
      console.log(`updated: ${test_case.filename}`)
    } catch (e) {
      console.error(`error ${test_case.filename}: ${e.message}`)
    }
  }
  console.log(`\n${updated} updated, ${skipped} template-skipped`)
}

main().then(() => process.exit(0))
