import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Load all JSON test cases from the data-view-queries directory (async version)
 * @returns {Promise<Array>} Promise resolving to array of test case objects with filename property added
 */
export const load_data_view_test_queries = async () => {
  const test_dir = path.join(__dirname, '..', 'test', 'data-view-queries')

  try {
    const files = await fs.readdir(test_dir)
    const json_files = files.filter((file) => file.endsWith('.json'))

    const data_view_test_queries = []
    for (const file of json_files) {
      const file_path = path.join(test_dir, file)
      const content = await fs.readFile(file_path, 'utf8')
      const data_view_test_query = JSON.parse(content)
      data_view_test_query.filename = file
      data_view_test_queries.push(data_view_test_query)
    }

    return data_view_test_queries
  } catch (error) {
    console.error(`Error loading test cases from ${test_dir}:`, error.message)
    return []
  }
}

/**
 * Load all JSON test cases from the data-view-queries directory (sync version)
 * @returns {Array} Array of test case objects with filename property added
 */
export const load_data_view_test_queries_sync = () => {
  const test_dir = path.join(__dirname, '..', 'test', 'data-view-queries')

  try {
    const files = fsSync.readdirSync(test_dir)
    const json_files = files.filter((file) => file.endsWith('.json'))

    const data_view_test_queries = []
    for (const file of json_files) {
      const file_path = path.join(test_dir, file)
      const content = fsSync.readFileSync(file_path, 'utf8')
      const data_view_test_query = JSON.parse(content)
      data_view_test_query.filename = file
      data_view_test_queries.push(data_view_test_query)
    }

    return data_view_test_queries
  } catch (error) {
    console.error(`Error loading test cases from ${test_dir}:`, error.message)
    return []
  }
}

// Default export
export default load_data_view_test_queries
