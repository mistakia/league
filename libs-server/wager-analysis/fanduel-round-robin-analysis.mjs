import { format_round_robin_display } from './round-robin-formatters.mjs'

// Analyze FanDuel round robin selections to track usage patterns
export const analyze_fanduel_round_robin_selections = (wagers) => {
  // Track selection usage and combinations
  const selection_stats = new Map()

  wagers.forEach((wager) => {
    // Group selections by event for this wager
    const selections_by_event = wager.legs.reduce((acc, leg) => {
      const selection = leg.parts[0]
      if (!acc[selection.eventId]) {
        acc[selection.eventId] = []
      }
      acc[selection.eventId].push(selection)
      return acc
    }, {})

    // Process each selection
    Object.entries(selections_by_event).forEach(
      ([event_id, event_selections]) => {
        event_selections.forEach((selection) => {
          const is_q1 = selection.eventMarketDescription.includes('1st Qtr')
          const market_parts = selection.eventMarketDescription.split(' - ')
          const stat_type = market_parts[1]
            ? market_parts[1]
                .replace('Alt ', '')
                .replace('1st Qtr ', '')
                .replace('Receiving Yds', 'rec')
                .replace('Rushing Yds', 'rush')
                .replace('Passing Yds', 'pass')
            : ''

          const player_name = selection.eventMarketDescription.split(' - ')[0]
          const match = selection.selectionName.match(/(\d+)\+ ?(Yards?)?/)
          const threshold = match ? match[1] : null

          const selection_key = `${player_name} ${threshold}+ ${is_q1 ? 'q1 ' : ''}${stat_type}`

          if (!selection_stats.has(selection_key)) {
            selection_stats.set(selection_key, {
              count: 0,
              combinations: []
            })
          }

          const stat = selection_stats.get(selection_key)
          stat.count++

          // Add the other selections from this round robin, grouped by game
          const other_selections = Object.entries(selections_by_event)
            .filter(([other_event_id]) => other_event_id !== event_id)
            .map(([_, game_selections]) => {
              // Format the selections for this game
              const formatted_selections = format_round_robin_display({
                legs: game_selections.map((sel) => ({ parts: [sel] }))
              })
              return formatted_selections
            })

          if (other_selections.length > 0) {
            stat.combinations.push(other_selections)
          }
        })
      }
    )
  })

  // Sort by usage count and format output
  const sorted_selections = Array.from(selection_stats.entries()).sort(
    (a, b) => b[1].count - a[1].count
  )

  console.log('\n\nSelection Analysis:\n')
  sorted_selections.forEach(([selection_key, stats]) => {
    console.log(`${selection_key} (${stats.count} round robins)`)
    stats.combinations.forEach((combination, index) => {
      console.log(`  Round Robin ${index + 1}:`)
      combination.forEach((game_selections) => {
        console.log(`    ${game_selections}`)
      })
    })
    console.log()
  })
}
