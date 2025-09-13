import { get_blake2b_hash } from '#libs-shared'

export default function get_table_hash(key) {
  const hash = get_blake2b_hash(key, 16, 't')
  return hash
}
