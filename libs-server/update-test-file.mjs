import fs from 'fs/promises'
import path from 'path'

/**
 * Update a test file with new expected_query.
 *
 * Prefers a surgical, value-only replacement of the expected_query string in
 * the raw file text so the rest of the fixture (request params, key order,
 * prettier array formatting) is preserved byte-for-byte and the resulting diff
 * is a single line. A full JSON.stringify rewrite reflows every array and
 * leaves the file prettier-dirty, producing noisy diffs that obscure the actual
 * SQL change. Falls back to a structured rewrite only when a surgical edit
 * cannot be applied unambiguously (no existing expected_query, an empty one, or
 * a value that does not appear exactly once).
 */
export const update_test_file = async (filename, new_query) => {
  const test_dir = path.join(process.cwd(), 'test', 'data-view-queries')
  const file_path = path.join(test_dir, filename)

  // Read the current file
  const content = await fs.readFile(file_path, 'utf8')
  const test_data = JSON.parse(content)
  const old_query = test_data.expected_query

  // Escaped JSON representation of a string value, without the surrounding
  // quotes, so it matches the value as it appears inside the raw file text.
  const as_json_value = (value) => JSON.stringify(value).slice(1, -1)

  if (typeof old_query === 'string' && old_query.length > 0) {
    const old_escaped = as_json_value(old_query)
    const occurrences = content.split(old_escaped).length - 1

    if (occurrences === 1) {
      const updated_content = content.replace(
        old_escaped,
        as_json_value(new_query)
      )
      await fs.writeFile(file_path, updated_content, 'utf8')
      return
    }
  }

  // Fallback: structured rewrite (new/empty/ambiguous expected_query). The
  // request is re-read from disk above, so it is never mutated by query
  // generation; only formatting is reflowed.
  test_data.expected_query = new_query
  const updated_content = JSON.stringify(test_data, null, 2)
  await fs.writeFile(file_path, updated_content, 'utf8')
}

export default update_test_file
