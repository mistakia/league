// Shared helper functions for round robin wager analysis
// Used by both FanDuel and Fanatics round robin analysis modules

// Validate that all combinations exist in the wager set
export const validate_combinations = (wagers, consolidated_selections) => {
  // Create a map of all actual combinations that exist in wagers
  const actual_combinations = new Set()

  wagers.forEach((wager) => {
    const wager_selections = wager.selections.map((s) => s.name)
    actual_combinations.add(wager_selections.sort().join('|'))
  })

  // For each event's alternative selections, check if all combinations exist
  const selection_groups = consolidated_selections.map((sel) =>
    sel.split(' / ')
  )

  // Generate all possible combinations
  const check_combinations = (index, current_combo = []) => {
    if (index === selection_groups.length) {
      // Check if this combination exists in any wager
      const combo_exists = Array.from(actual_combinations).some(
        (actual_combo) => {
          return current_combo.every((sel) => actual_combo.includes(sel))
        }
      )
      return combo_exists
    }

    // Try each alternative for this position
    return selection_groups[index].every((selection) => {
      return check_combinations(index + 1, [...current_combo, selection])
    })
  }

  return check_combinations(0)
}

// Create consolidated selections grouped by event
export const create_consolidated_selections = (wagers) => {
  const selections_by_event = new Map()
  wagers.forEach((wager) => {
    wager.selections.forEach((selection) => {
      if (!selections_by_event.has(selection.event_id)) {
        selections_by_event.set(selection.event_id, new Set())
      }
      selections_by_event.get(selection.event_id).add(selection.name)
    })
  })

  return Array.from(selections_by_event.values()).map((selections) => {
    const selections_array = Array.from(selections)
    return selections_array.length > 1
      ? selections_array.sort().join(' / ')
      : selections_array[0]
  })
}
