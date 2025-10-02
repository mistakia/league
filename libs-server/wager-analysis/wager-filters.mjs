// Filter wagers by week
export const filter_wagers_by_week = (wagers, week) => {
  if (!week) {
    return wagers
  }
  return wagers.filter((wager) => wager.week === week)
}

// Filter wagers by lost leg count
export const filter_wagers_by_lost_legs = (wagers, max_lost_legs) => {
  return wagers.filter((wager) => {
    const lost_legs = wager.selections.filter(
      (selection) => selection.is_lost
    ).length
    return lost_legs <= max_lost_legs
  })
}

// Filter wagers by minimum number of legs
export const filter_wagers_by_min_legs = (wagers, min_legs) => {
  if (min_legs === 0) {
    return wagers
  }
  return wagers.filter((wager) => wager.selections.length >= min_legs)
}

// Filter wagers by excluding selections
export const filter_wagers_excluding_selections = (
  wagers,
  exclude_selections
) => {
  if (exclude_selections.length === 0) {
    return wagers
  }
  return wagers.filter((wager) => {
    return !wager.selections.some((selection) =>
      exclude_selections.some((filter) =>
        selection.name.toLowerCase().includes(filter.toLowerCase())
      )
    )
  })
}

// Filter wagers by including only specific selections
export const filter_wagers_including_selections = (
  wagers,
  include_selections
) => {
  if (include_selections.length === 0) {
    return wagers
  }
  return wagers.filter((wager) => {
    return include_selections.every((filter) =>
      wager.selections.some((selection) =>
        selection.name.toLowerCase().includes(filter.toLowerCase())
      )
    )
  })
}

// Filter wagers by source
export const filter_wagers_by_source = (wagers, source_id) => {
  return wagers.filter((wager) => wager.source_id === source_id)
}

// Sort wagers by criteria
export const sort_wagers = (wagers, sort_by = 'odds') => {
  return [...wagers].sort((a, b) => {
    if (sort_by === 'payout') {
      return b.potential_win - a.potential_win
    }
    return b.parsed_odds - a.parsed_odds
  })
}

// Apply all filters in sequence
export const apply_wager_filters = ({
  wagers,
  week = null,
  max_lost_legs = Infinity,
  min_legs = 0,
  exclude_selections = [],
  include_selections = [],
  source_id = null,
  sort_by = 'odds'
}) => {
  let filtered = wagers

  // Apply week filter
  filtered = filter_wagers_by_week(filtered, week)

  // Apply min legs filter
  filtered = filter_wagers_by_min_legs(filtered, min_legs)

  // Apply lost legs filter
  filtered = filter_wagers_by_lost_legs(filtered, max_lost_legs)

  // Apply exclusion filter
  filtered = filter_wagers_excluding_selections(filtered, exclude_selections)

  // Apply inclusion filter
  filtered = filter_wagers_including_selections(filtered, include_selections)

  // Apply source filter
  if (source_id) {
    filtered = filter_wagers_by_source(filtered, source_id)
  }

  // Sort results
  filtered = sort_wagers(filtered, sort_by)

  return filtered
}
