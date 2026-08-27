import * as constants from '#constants'
import { current_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'

/**
 * Process expected query with template literal syntax
 * Handles ${...} expressions by evaluating them in a context where constants is available
 *
 * @param {string} expected_query_string - The expected query string that may contain template literals
 * @returns {string} - The processed query string with variables interpolated
 */
export function process_expected_query(expected_query_string) {
  // If the string contains ${...} template literal syntax, evaluate it
  if (expected_query_string && expected_query_string.includes('${')) {
    // Create all_years array for use in templates
    const all_years = Array.from(
      { length: constants.current_season.year - 1999 },
      (_, i) => i + 2000
    )

    // Create last_3_years array for use in templates
    const last_3_years = []
    for (
      let i = constants.current_season.year - 2;
      i <= constants.current_season.year;
      i++
    ) {
      last_3_years.push(i)
    }

    // Mirror of the next_week_opponent_total branch in get-data-view-results:
    // the week/seas_type a "next week" matchup column resolves to right now.
    // Goldens that embed those values must template them or they self-break on
    // the next date rollover that moves the derived week.
    const next_week = constants.current_season.calculate_week(
      constants.current_season.now.add(1, 'week')
    )

    // Create a template literal by wrapping in backticks and evaluating
    // Provide both current_season (for new syntax) and constants (for old syntax compatibility)
    // The nfl_week_id every current-week column family defaults to. Same
    // reason as next_week above: a golden that hardcodes it is pinned to the
    // clock it was blessed under and self-breaks at the next rollover that
    // moves the week -- and it moved for every one of them when the current
    // week stopped taking its year from the last completed season.
    const current_nfl_week = current_nfl_week_identifier()

    // eslint-disable-next-line no-new-func
    const template_function = new Function(
      'current_season',
      'constants',
      'all_years',
      'last_3_years',
      'next_week',
      'current_nfl_week',
      `return \`${expected_query_string}\``
    )
    return template_function(
      constants.current_season,
      constants,
      all_years,
      last_3_years,
      next_week,
      current_nfl_week
    )
  }

  // Otherwise return as-is
  return expected_query_string
}
