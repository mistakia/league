/**
 * Utility function to transform pass route values to standardized uppercase enum format
 * for the nfl_pass_route enum type.
 *
 * This function:
 * - Converts route values to uppercase
 * - Maps specific Sportradar screen types to generic 'SCREEN'
 * - Returns null for null/undefined input
 *
 * @param {string|null|undefined} route - The route value to transform
 * @returns {string|null|undefined} - The transformed route in uppercase, or original if null/undefined
 */
const transform_play_route = (route) => {
  if (!route) return route

  // Convert to uppercase
  const uppercase_route = route.toUpperCase()

  // Map Sportradar-specific screen types to generic SCREEN
  if (
    uppercase_route === 'WR_SCREEN' ||
    uppercase_route === 'UNDERNEATH_SCREEN'
  ) {
    return 'SCREEN'
  }

  return uppercase_route
}

export default transform_play_route
