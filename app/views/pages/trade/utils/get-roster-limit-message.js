/**
 * Generate user-friendly roster limit error message based on validation details
 * @param {Object} validation_details - Validation details with needs_active_releases, needs_ps_releases, and counts
 * @returns {string} Formatted error message indicating which players need to be released
 */
export function get_roster_limit_message(validation_details) {
  const messages = []

  if (validation_details.needs_active_releases) {
    messages.push(
      `Release ${validation_details.active_release_count} active roster player(s)`
    )
  }

  if (validation_details.needs_ps_releases) {
    messages.push(
      `Release ${validation_details.ps_release_count} practice squad player(s)`
    )
  }

  return messages.join(' and ')
}
