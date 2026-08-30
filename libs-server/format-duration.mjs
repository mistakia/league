/**
 * Format a millisecond duration as human-readable log text
 *
 * Shared by the import reporting summary and prop-market settlement, which
 * previously each carried their own copy with divergent output for the same
 * input (`1m 30s` here versus `1.5min`). Log text only -- nothing user-facing
 * or machine-parsed reads this, so the two were free to be reconciled onto the
 * form that keeps its resolution past an hour.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const format_duration = (ms) => {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}
