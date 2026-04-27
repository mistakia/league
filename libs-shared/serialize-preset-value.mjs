export default function serialize_preset_value(value_object) {
  if (!value_object || typeof value_object !== 'object' || Array.isArray(value_object)) {
    return ''
  }
  const sorted_keys = Object.keys(value_object).sort()
  return sorted_keys.map((k) => `${k}:${value_object[k]}`).join(',')
}
