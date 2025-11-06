/**
 * Normalizes selection metric line values for prop market storage.
 *
 * For "N+" discrete stat markets (e.g., "3+ Passing Touchdowns", "5+ Receptions"),
 * the line needs to be stored as N-0.5 to work correctly with the strict inequality
 * comparison logic (>) used in hit rate calculations.
 *
 * @param {Object} params - Named parameters
 * @param {number|string|null|undefined} params.raw_value - The raw line value from the sportsbook API
 * @param {string} params.selection_name - The selection name/label (e.g., "3+", "Aaron Jones Over")
 * @returns {number|null} - The normalized line value, or null if input is null/undefined
 *
 * @example
 * // N+ discrete stat markets - subtract 0.5
 * normalize_selection_metric_line({ raw_value: 3.0, selection_name: "3+" }) // Returns 2.5
 * normalize_selection_metric_line({ raw_value: "250", selection_name: "250+" }) // Returns 249.5
 *
 * @example
 * // Already normalized markets - no change
 * normalize_selection_metric_line({ raw_value: 149.5, selection_name: "149.5+" }) // Returns 149.5
 * normalize_selection_metric_line({ raw_value: 199.5, selection_name: "200+ Passing Yards" }) // Returns 199.5
 *
 * @example
 * // Traditional over/under markets - no change
 * normalize_selection_metric_line({ raw_value: 24.5, selection_name: "Aaron Jones Over" }) // Returns 24.5
 * normalize_selection_metric_line({ raw_value: 44.0, selection_name: "Over" }) // Returns 44.0
 *
 * @example
 * // Spread markets (negative values) - no change
 * normalize_selection_metric_line({ raw_value: -7.5, selection_name: "ATL Falcons -7.5" }) // Returns -7.5
 *
 * @example
 * // Null/undefined handling
 * normalize_selection_metric_line({ raw_value: null, selection_name: "3+" }) // Returns null
 * normalize_selection_metric_line({ raw_value: undefined, selection_name: "Over" }) // Returns null
 */
export function normalize_selection_metric_line({ raw_value, selection_name }) {
  // Handle null/undefined inputs
  if (raw_value === null || raw_value === undefined) {
    return null
  }

  // Parse numeric value from input
  let line_value
  if (typeof raw_value === 'number') {
    line_value = raw_value
  } else if (typeof raw_value === 'string') {
    // Strip leading '+' or '-' signs and trailing '+' from string values
    const cleaned = raw_value.replace(/^\+/, '').replace(/\+$/, '')
    line_value = Number(cleaned)

    // Return null if parsing failed
    if (isNaN(line_value)) {
      return null
    }
  } else {
    return null
  }

  // Don't normalize negative values (spreads)
  if (line_value < 0) {
    return line_value
  }

  // Don't normalize if selection_name is missing
  if (!selection_name || typeof selection_name !== 'string') {
    return line_value
  }

  // Detect "N+" discrete stat markets using three-layer safety check:
  //
  // Layer 1: Pure pattern - selection_name matches "N+" format exactly (e.g., "3+", "250+", "1000+")
  // This pattern will NEVER match traditional over/under names like "Aaron Jones Over" or "Over 249.5"
  const pure_plus_pattern = /^\d+\+$/
  const is_pure_plus_market = pure_plus_pattern.test(selection_name.trim())

  if (!is_pure_plus_market) {
    // Not a pure N+ market - return unchanged
    return line_value
  }

  // Layer 2: Verify line is an integer matching the N value in the name
  const is_integer_line = line_value === Math.floor(line_value)

  if (!is_integer_line) {
    // Already normalized (has .5) - return unchanged
    return line_value
  }

  // Extract the N value from the selection name (e.g., "3+" → 3, "250+" → 250)
  const n_value = parseInt(selection_name.replace('+', ''), 10)

  if (line_value !== n_value) {
    // Line doesn't match the N value in name - return unchanged
    // This protects against edge cases
    return line_value
  }

  // Layer 3 passed: This is a pure "N+" market with integer line matching N
  // Normalize by subtracting 0.5
  return line_value - 0.5
}
