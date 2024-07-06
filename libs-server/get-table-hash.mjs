import { blake2b } from 'blakejs'

export default function get_table_hash(key) {
  const hash = Array.from(blake2b(key, null, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `t${hash}`
}
