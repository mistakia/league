export default function format_starting_hash(value) {
  if (!value) return null
  const uppercase_hash = value.toUpperCase()
  switch (uppercase_hash) {
    case 'L':
      return 'LEFT'
    case 'M':
      return 'MIDDLE'
    case 'R':
      return 'RIGHT'
    default:
      return null
  }
}
