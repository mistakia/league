import fs from 'fs/promises'
import path from 'path'

/**
 * Update a test file with new expected_query
 */
export const update_test_file = async (filename, new_query) => {
  const test_dir = path.join(process.cwd(), 'test', 'data-view-queries')
  const file_path = path.join(test_dir, filename)

  // Read the current file
  const content = await fs.readFile(file_path, 'utf8')
  const test_data = JSON.parse(content)

  // Update the expected_query
  test_data.expected_query = new_query

  // Write back to file with proper formatting
  const updated_content = JSON.stringify(test_data, null, 2)
  await fs.writeFile(file_path, updated_content, 'utf8')
}

export default update_test_file
