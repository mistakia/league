import {
  validate_combinations,
  create_consolidated_selections
} from './round-robin-helpers.mjs'

// Split invalid combinations into valid subsets
const split_invalid_combinations = (set) => {
  const result_sets = []
  let current_wagers = set.wagers

  while (current_wagers.length > 0) {
    // Get all selections grouped by event for these wagers
    const selections_by_event = new Map()
    current_wagers.forEach((wager) => {
      wager.selections.forEach((selection) => {
        if (!selections_by_event.has(selection.event_id)) {
          selections_by_event.set(selection.event_id, new Set())
        }
        selections_by_event.get(selection.event_id).add(selection.name)
      })
    })

    // Create consolidated selections
    const consolidated = Array.from(selections_by_event.entries()).map(
      ([_, selections]) => {
        const selections_array = Array.from(selections)
        return selections_array.length > 1
          ? selections_array.sort().join(' / ')
          : selections_array[0]
      }
    )

    // Check if all combinations exist
    if (validate_combinations(current_wagers, consolidated)) {
      // This is a valid set
      result_sets.push({
        wagers: current_wagers,
        consolidated_selections: consolidated
      })
      break
    } else {
      // Find the largest valid subset
      const event_selections = Array.from(selections_by_event.entries())
      let best_subset = []

      for (const [event_id, selections] of event_selections) {
        if (selections.size > 1) {
          // Try removing each selection
          for (const selection of selections) {
            const subset = current_wagers.filter(
              (wager) =>
                !wager.selections.some(
                  (s) => s.event_id === event_id && s.name === selection
                )
            )
            if (subset.length > best_subset.length) {
              best_subset = subset
            }
          }
        }
      }

      if (best_subset.length > 0) {
        // Add this subset as a valid set
        const subset_consolidated = create_consolidated_selections(best_subset)
        result_sets.push({
          wagers: best_subset,
          consolidated_selections: subset_consolidated
        })
        // Continue with remaining wagers
        current_wagers = current_wagers.filter((w) => !best_subset.includes(w))
      } else {
        // Fallback: create individual sets
        current_wagers.forEach((wager) => {
          result_sets.push({
            wagers: [wager],
            consolidated_selections: wager.selections.map((s) => s.name)
          })
        })
        break
      }
    }
  }

  return result_sets
}

// Analyze Fanatics wager sets to identify patterns
export const analyze_fanatics_wager_sets = (wagers) => {
  const selection_sets = new Map()

  wagers.forEach((wager) => {
    const selections_by_event = wager.selections.reduce((acc, selection) => {
      if (!acc[selection.event_id]) {
        acc[selection.event_id] = []
      }
      acc[selection.event_id].push({
        name: selection.name,
        eventId: selection.event_id
      })
      return acc
    }, {})

    Object.entries(selections_by_event).forEach(
      ([event_id, event_selections]) => {
        event_selections.forEach((selection) => {
          const metric_match = selection.name.match(/(\d+)\+/)
          const metric_amount = metric_match ? metric_match[1] : ''
          const selection_key = `${selection.name.split(' ')[0]} ${selection.name.split(' ')[1]} ${metric_amount}+ ${selection.name.split(' ').slice(-2).join(' ')}`

          if (!selection_sets.has(selection_key)) {
            selection_sets.set(selection_key, {
              count: 0,
              total_stake: 0,
              potential_win: 0,
              wagers: [],
              combinations: new Map()
            })
          }

          const set = selection_sets.get(selection_key)
          set.count++
          set.total_stake += wager.stake
          set.potential_win += wager.potential_win
          set.wagers.push(wager)

          const other_selections = Object.entries(selections_by_event)
            .filter(([other_event_id]) => other_event_id !== event_id)
            .map(([_, selections]) => ({
              name: selections.map((s) => s.name).join(' & '),
              eventId: selections[0].eventId
            }))

          if (other_selections.length > 0) {
            const combo_key = other_selections
              .map((s) => `${s.eventId}:${s.name}`)
              .sort()
              .join('|')
            if (!set.combinations.has(combo_key)) {
              set.combinations.set(combo_key, {
                count: 0,
                selections: other_selections
              })
            }
            set.combinations.get(combo_key).count++
          }
        })
      }
    )
  })

  const sorted_sets = Array.from(selection_sets.entries()).sort(
    (a, b) => b[1].potential_win - a[1].potential_win
  )

  console.log('\n\nFanatics Wager Sets Analysis:\n')
  sorted_sets.forEach(([selection_key, stats]) => {
    const split_sets = split_invalid_combinations(stats)

    split_sets.forEach((set, index) => {
      const set_label = split_sets.length > 1 ? ` (Set ${index + 1})` : ''
      console.log(`${selection_key}${set_label}:`)
      console.log(`  Total Parlays: ${set.wagers.length}`)
      console.log(
        `  Total Stake: $${set.wagers.reduce((sum, w) => sum + w.stake, 0).toFixed(2)}`
      )
      console.log(
        `  Total Potential Win: $${set.wagers.reduce((sum, w) => sum + w.potential_win, 0).toFixed(2)}`
      )

      console.log('\n  Combinations:')
      console.log(`    Used ${set.wagers.length} times:`)
      set.consolidated_selections.forEach((sel) => {
        console.log(`      ${sel}`)
      })
      console.log()
    })
  })
}
