import path from 'path'
import { fileURLToPath } from 'url'

import { readCSV } from '#libs-server'
import {
  levenshtein_distance,
  levenshtein_ratio,
  ngram_distance,
  strings_are_similar,
  format_player_name
} from '#libs-shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NICKNAMES_CSV_PATH = path.join(__dirname, '..', 'data', 'nicknames.csv')

// Module-level cache for nickname sets
let nickname_sets = null
let nickname_sets_loading = null

/**
 * Load nickname sets from CSV file.
 * Results are cached for subsequent calls.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force_reload=false] - Force reload from file even if cached
 * @returns {Promise<Array<Array<string>>>} Array of nickname sets
 */
export const load_nickname_sets = async ({ force_reload = false } = {}) => {
  if (nickname_sets && !force_reload) {
    return nickname_sets
  }

  // Prevent concurrent loading
  if (nickname_sets_loading) {
    return nickname_sets_loading
  }

  nickname_sets_loading = (async () => {
    const csv = await readCSV(NICKNAMES_CSV_PATH)
    nickname_sets = csv.map((row) => Object.values(row))
    return nickname_sets
  })()

  return nickname_sets_loading
}

/**
 * Get the indexes of nickname sets that contain a given name.
 *
 * @param {string} name - Name to search for
 * @param {Array<Array<string>>} sets - Nickname sets to search
 * @returns {Array<number>} Indexes of sets containing the name
 */
const get_nickname_set_indexes_for_name = (name, sets) => {
  const nickname_set_indexes = []
  for (let i = 0; i < sets.length; i++) {
    const nickname_set = sets[i]
    if (nickname_set.includes(name)) {
      nickname_set_indexes.push(i)
    }
  }
  return nickname_set_indexes
}

/**
 * Check if two names are known nicknames of each other.
 *
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @param {Array<Array<string>>} [sets] - Nickname sets (loaded if not provided)
 * @returns {Promise<boolean>} True if names are nicknames
 */
export const is_nicknames = async (name1, name2, sets = null) => {
  if (!sets) {
    sets = await load_nickname_sets()
  }

  const nickname_set_indexes1 = get_nickname_set_indexes_for_name(name1, sets)
  const nickname_set_indexes2 = get_nickname_set_indexes_for_name(name2, sets)

  // find first intersection
  for (const i of nickname_set_indexes1) {
    if (nickname_set_indexes2.includes(i)) {
      return true
    }
  }

  return false
}

/**
 * Synchronous version of is_nicknames for use when nickname sets are pre-loaded.
 *
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @param {Array<Array<string>>} sets - Pre-loaded nickname sets (required)
 * @returns {boolean} True if names are nicknames
 */
export const is_nicknames_sync = (name1, name2, sets) => {
  if (!sets) {
    throw new Error('Nickname sets must be provided for synchronous check')
  }

  const nickname_set_indexes1 = get_nickname_set_indexes_for_name(name1, sets)
  const nickname_set_indexes2 = get_nickname_set_indexes_for_name(name2, sets)

  for (const i of nickname_set_indexes1) {
    if (nickname_set_indexes2.includes(i)) {
      return true
    }
  }

  return false
}

/**
 * Check if two first names match, accounting for nicknames and fuzzy matching.
 * Uses more lenient thresholds for first names since nicknames are common.
 *
 * @param {string} fname1 - First name 1
 * @param {string} fname2 - First name 2
 * @param {Object} [options]
 * @param {Array<Array<string>>} [options.nickname_sets] - Pre-loaded nickname sets
 * @returns {Promise<boolean>} True if first names match
 */
export const first_names_match = async (
  fname1,
  fname2,
  { nickname_sets: sets = null } = {}
) => {
  // Normalize names
  const name1 = format_player_name(fname1)
  const name2 = format_player_name(fname2)

  // Exact match
  if (name1 === name2) return true

  // Substring match (e.g., "Pat" in "Patrick")
  if (name1.includes(name2) || name2.includes(name1)) return true

  // Check nicknames
  if (await is_nicknames(name1, name2, sets)) return true

  // More lenient fuzzy matching for first names
  const l_distance = levenshtein_distance(name1, name2)
  if (l_distance < 3) return true

  const l_ratio = levenshtein_ratio(name1, name2)
  if (l_ratio < 0.5) return true

  const n_distance = ngram_distance(name1, name2)
  if (n_distance < 0.5) return true

  return false
}

/**
 * Check if two last names match using fuzzy matching.
 *
 * @param {string} lname1 - Last name 1
 * @param {string} lname2 - Last name 2
 * @returns {boolean} True if last names match
 */
export const last_names_match = (lname1, lname2) => {
  const name1 = format_player_name(lname1)
  const name2 = format_player_name(lname2)

  return strings_are_similar(name1, name2)
}

/**
 * Check if two full player names match, accounting for nicknames and fuzzy matching.
 *
 * @param {string} full_name1 - Full name 1 (e.g., "Patrick Mahomes")
 * @param {string} full_name2 - Full name 2 (e.g., "Pat Mahomes")
 * @param {Object} [options]
 * @param {Array<Array<string>>} [options.nickname_sets] - Pre-loaded nickname sets
 * @returns {Promise<boolean>} True if names likely refer to same player
 */
export const player_names_match = async (
  full_name1,
  full_name2,
  { nickname_sets: sets = null } = {}
) => {
  // Normalize full names
  const normalized1 = format_player_name(full_name1)
  const normalized2 = format_player_name(full_name2)

  // Exact match on normalized names
  if (normalized1 === normalized2) return true

  // Split into parts
  const parts1 = full_name1.trim().split(/\s+/)
  const parts2 = full_name2.trim().split(/\s+/)

  // Must have at least first and last name
  if (parts1.length < 2 || parts2.length < 2) {
    // Fall back to substring check for single-word names
    return (
      normalized1.includes(normalized2) || normalized2.includes(normalized1)
    )
  }

  // Get first and last names
  const fname1 = parts1[0]
  const fname2 = parts2[0]
  const lname1 = parts1[parts1.length - 1]
  const lname2 = parts2[parts2.length - 1]

  // Check last name first (usually more unique)
  if (!last_names_match(lname1, lname2)) return false

  // Then check first name with nickname support
  return first_names_match(fname1, fname2, { nickname_sets: sets })
}

export default {
  load_nickname_sets,
  is_nicknames,
  is_nicknames_sync,
  first_names_match,
  last_names_match,
  player_names_match
}
