import { blake2b } from 'blakejs'

/**
 * Generate a BLAKE2b hash from input data
 * @param {string|Buffer|Uint8Array} data - The data to hash
 * @param {number} [bytes=32] - Hash output length in bytes
 * @param {string} [prefix=''] - Optional prefix to add to the hash string
 * @returns {string} Hex-encoded hash string, optionally with prefix
 */
export default function get_blake2b_hash(data, bytes = 32, prefix = '') {
  const hash = Array.from(blake2b(data, null, bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return prefix + hash
}
