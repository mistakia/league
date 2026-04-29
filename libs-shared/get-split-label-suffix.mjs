/**
 * Returns a display suffix string for a data row based on the active splits.
 *
 * Week split takes precedence over year split. Returns an empty string when
 * required fields are absent or no splits are active.
 *
 * @param {string[]} splits - Active split identifiers (e.g. ['week'], ['year'])
 * @param {object} row - Data row object with optional `year` and `week` fields
 * @returns {string}
 */
export default function get_split_label_suffix(splits, row) {
  if (splits.includes('week')) {
    if (row.year == null || row.week == null) return ''
    return ` (${row.year} W${row.week})`
  }
  if (splits.includes('year')) {
    if (row.year == null) return ''
    return ` (${row.year})`
  }
  return ''
}
