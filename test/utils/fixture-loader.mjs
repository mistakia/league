/**
 * Fixture loader for external fantasy leagues testing.
 *
 * Loads raw platform API responses and expected mapper outputs from
 * test/fixtures/external-fantasy-leagues with simple in-process caching.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fixtures_root = path.join(
  __dirname,
  '..',
  'fixtures',
  'external-fantasy-leagues'
)

const cache = new Map()

async function find_fixture_file(directory, filename) {
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }

  const direct_match = entries.find(
    (entry) => entry.isFile() && entry.name === filename
  )
  if (direct_match) return path.join(directory, filename)

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = await find_fixture_file(
        path.join(directory, entry.name),
        filename
      )
      if (found) return found
    }
  }
  return null
}

async function read_json(file_path) {
  const content = await fs.readFile(file_path, 'utf8')
  return JSON.parse(content)
}

export async function load_platform_response(platform, data_type) {
  const cache_key = `platform:${platform}:${data_type}`
  if (cache.has(cache_key)) return cache.get(cache_key)

  const file_path = path.join(
    fixtures_root,
    'platform-responses',
    platform,
    `${data_type}.json`
  )

  try {
    const fixture = await read_json(file_path)
    cache.set(cache_key, fixture)
    return fixture
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `Platform response fixture not found: ${platform}/${data_type}`
      )
    }
    throw err
  }
}

export async function load_expected_output(test_scenario) {
  const cache_key = `expected:${test_scenario}`
  if (cache.has(cache_key)) return cache.get(cache_key)

  const expected_dir = path.join(fixtures_root, 'expected-outputs')
  const fixture_path = await find_fixture_file(
    expected_dir,
    `${test_scenario}.json`
  )

  if (!fixture_path) {
    throw new Error(`Expected output fixture not found: ${test_scenario}`)
  }

  const fixture = await read_json(fixture_path)
  cache.set(cache_key, fixture)
  return fixture
}

export function clear_fixture_cache() {
  cache.clear()
}
