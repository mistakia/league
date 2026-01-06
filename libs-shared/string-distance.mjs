/**
 * String distance functions for comparing string similarity.
 * These are pure functions that work in both browser and Node.js environments.
 */

/**
 * Calculate the Levenshtein distance between two strings.
 * Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into another.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} The edit distance between the two strings
 */
export const levenshtein_distance = (a, b) => {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []

  // increment along the first column of each row
  let i
  for (i = 0; i <= b.length; i += 1) {
    matrix[i] = [i]
  }

  // increment each column in the first row
  let j
  for (j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i += 1) {
    for (j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1
          )
        ) // deletion
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate the Levenshtein ratio (normalized distance) between two strings.
 * Returns a value between 0 and 1, where 0 means identical strings.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Normalized distance ratio (0 = identical, 1 = completely different)
 */
export const levenshtein_ratio = (a, b) => {
  if (a.length === 0 && b.length === 0) return 0
  const distance = levenshtein_distance(a, b)
  return distance / Math.max(a.length, b.length)
}

/**
 * Calculate the Jaccard distance between two sets or strings.
 * Jaccard distance measures dissimilarity between sets as 1 - (intersection/union).
 *
 * @param {string|Array|Set} a - First set, array, or string (string is converted to character set)
 * @param {string|Array|Set} b - Second set, array, or string
 * @returns {number} Jaccard distance (0 = identical, 1 = no common elements)
 */
export const jaccard_distance = (a, b) => {
  // convert to sets if arrays
  if (Array.isArray(a)) a = new Set(a)
  if (Array.isArray(b)) b = new Set(b)

  // convert to sets if strings
  if (typeof a === 'string') a = new Set(a.split(''))
  if (typeof b === 'string') b = new Set(b.split(''))

  const intersection = new Set([...a].filter((x) => b.has(x)))
  const union = new Set([...a, ...b])

  if (union.size === 0) return 0

  return 1 - intersection.size / union.size
}

/**
 * Calculate the n-gram distance between two strings using Jaccard distance on n-grams.
 * N-grams are contiguous sequences of n characters from the string.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @param {number} [n=2] - Size of n-grams (default: 2 for bigrams)
 * @returns {number} N-gram distance (0 = identical, 1 = no common n-grams)
 */
export const ngram_distance = (a, b, n = 2) => {
  const a_ngrams = []
  const b_ngrams = []

  for (let i = 0; i < a.length - n + 1; i += 1) {
    a_ngrams.push(a.slice(i, i + n))
  }

  for (let i = 0; i < b.length - n + 1; i += 1) {
    b_ngrams.push(b.slice(i, i + n))
  }

  return jaccard_distance(a_ngrams, b_ngrams)
}

/**
 * Check if two strings are similar based on multiple distance metrics.
 * Uses a combination of Levenshtein ratio and n-gram distance.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @param {Object} [options] - Threshold options
 * @param {number} [options.levenshtein_threshold=0.3] - Max Levenshtein ratio to consider similar
 * @param {number} [options.ngram_threshold=0.4] - Max n-gram distance to consider similar
 * @returns {boolean} True if strings are similar
 */
export const strings_are_similar = (
  a,
  b,
  { levenshtein_threshold = 0.3, ngram_threshold = 0.4 } = {}
) => {
  if (a === b) return true

  // Check substring relationship
  if (a.includes(b) || b.includes(a)) return true

  // Check Levenshtein ratio
  const l_ratio = levenshtein_ratio(a, b)
  if (l_ratio <= levenshtein_threshold) return true

  // Check n-gram distance
  const n_distance = ngram_distance(a, b)
  if (n_distance <= ngram_threshold) return true

  return false
}

export default {
  levenshtein_distance,
  levenshtein_ratio,
  jaccard_distance,
  ngram_distance,
  strings_are_similar
}
