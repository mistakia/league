import { constants } from '#libs-shared'

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
      { length: constants.season.year - 1999 },
      (_, i) => i + 2000
    )

    // Create last_3_years array for use in templates
    const last_3_years = []
    for (let i = constants.season.year - 2; i <= constants.season.year; i++) {
      last_3_years.push(i)
    }

    // Create a template literal by wrapping in backticks and evaluating
    // eslint-disable-next-line no-new-func
    const template_function = new Function(
      'constants',
      'all_years',
      'last_3_years',
      `return \`${expected_query_string}\``
    )
    return template_function(constants, all_years, last_3_years)
  }

  // Otherwise return as-is
  return expected_query_string
}
