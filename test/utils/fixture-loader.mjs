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

  const file_path = path.join(
    fixtures_root,
    'expected-outputs',
    `${test_scenario}.json`
  )

  try {
    const fixture = await read_json(file_path)
    cache.set(cache_key, fixture)
    return fixture
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Expected output fixture not found: ${test_scenario}`)
    }
    throw err
  }
}

export async function load_test_fixture(relative_path) {
  const cache_key = `test:${relative_path}`
  if (cache.has(cache_key)) return cache.get(cache_key)

  const file_path = path.join(fixtures_root, relative_path)

  try {
    const fixture = await read_json(file_path)
    cache.set(cache_key, fixture)
    return fixture
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Test fixture not found: ${relative_path}`)
    }
    throw err
  }
}
