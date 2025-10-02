// Format round robin display showing selections grouped by event and player
export const format_round_robin_display = (wager) => {
  // Group selections by event_id
  const selections_by_event = wager.legs.reduce((acc, leg) => {
    const selection = leg.parts[0]
    if (!acc[selection.eventId]) {
      acc[selection.eventId] = []
    }
    acc[selection.eventId].push(selection)
    return acc
  }, {})

  // Format each event's selections
  const formatted_lines = Object.values(selections_by_event).map(
    (event_selections) => {
      // Group selections by player name
      const selections_by_player = event_selections.reduce((acc, selection) => {
        // Extract player name from eventMarketDescription
        const player_name = selection.eventMarketDescription.split(' - ')[0]
        if (!acc[player_name]) {
          acc[player_name] = []
        }
        acc[player_name].push(selection)
        return acc
      }, {})

      // Format each player's selections
      const player_lines = Object.entries(selections_by_player).map(
        ([player_name, player_selections]) => {
          // Group by stat type and quarter
          const grouped_by_stat = player_selections.reduce((acc, selection) => {
            const is_q1 = selection.eventMarketDescription.includes('1st Qtr')
            const parts = selection.eventMarketDescription.split(' - ')
            const stat_type =
              parts.length > 1
                ? parts[1]
                    .replace('Alt ', '')
                    .replace('1st Qtr ', '')
                    .replace('Receptions', 'recs')
                    .replace('Receiving Yds', 'recv')
                    .replace('Rushing Yds', 'rush')
                    .replace('Passing Yds', 'pass')
                : ''

            const key = is_q1 ? `q1_${stat_type}` : stat_type
            if (!acc[key]) {
              acc[key] = []
            }
            acc[key].push(selection)
            return acc
          }, {})

          // Format each stat type group
          const stat_lines = Object.entries(grouped_by_stat).map(
            ([stat_key, stat_selections]) => {
              const thresholds = stat_selections
                .map((selection) => {
                  const match =
                    selection.selectionName.match(/(\d+)\+ ?(Yards?)?/)
                  return match ? match[1] : null
                })
                .filter(Boolean)
                .sort((a, b) => Number(a) - Number(b))
                .map((threshold) => `${threshold}+`)
                .join(' / ')

              const is_q1 = stat_key.startsWith('q1_')
              const stat_type = is_q1 ? stat_key.replace('q1_', '') : stat_key

              return `${thresholds} ${is_q1 ? 'q1 ' : ''}${stat_type}`
            }
          )

          return `${player_name} ${stat_lines.join(' / ')}`
        }
      )

      return player_lines.join(' / ')
    }
  )

  return formatted_lines.join('\n')
}
