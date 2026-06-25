/**
 * Returns a display suffix string for a data row based on the active row axes.
 *
 * Week axis takes precedence over year axis. Returns an empty string when
 * required fields are absent or no row axes are active.
 *
 * @param {string[]} row_axes - Active row axis identifiers (e.g. ['week'], ['year'])
 * @param {object} row - Data row object with optional `year` and `week` fields
 * @returns {string}
 */
export default function get_row_axis_label_suffix(row_axes, row) {
  if (row_axes.includes('week')) {
    if (row.year == null || row.week == null) return ''
    return ` (${row.year} W${row.week})`
  }
  if (row_axes.includes('year')) {
    if (row.year == null) return ''
    return ` (${row.year})`
  }
  return ''
}
