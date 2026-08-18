import { List, Map } from 'immutable'

export function createPlayer({
  first_name,
  last_name,
  short_name,
  current_nfl_team,

  projection,
  points,
  market_salary,
  pts_added,
  projected_points_added_positive_including_cap_savings,
  projections,
  practice,
  transactions,
  stats,
  betting_markets,
  monday_practice_status,
  tuesday_practice_status,
  wednesday_practice_status,
  thursday_practice_status,
  friday_practice_status,
  saturday_practice_status,
  sunday_practice_status,
  source_status,
  game_designation,
  roster_status,
  practice_week,
  practice_game_designation,
  practice_roster_status,
  ...data
}) {
  const params = {
    ...data
  }

  // Handle practice day columns from get-players query
  if (
    monday_practice_status !== undefined ||
    tuesday_practice_status !== undefined ||
    wednesday_practice_status !== undefined ||
    thursday_practice_status !== undefined ||
    friday_practice_status !== undefined ||
    saturday_practice_status !== undefined ||
    sunday_practice_status !== undefined
  ) {
    params.practice_week = new Map({
      monday_practice_status,
      tuesday_practice_status,
      wednesday_practice_status,
      thursday_practice_status,
      friday_practice_status,
      saturday_practice_status,
      sunday_practice_status,
      source_status,
      // Use practice table values for practice_week sub-map if available,
      // otherwise fall back to top-level values
      game_designation:
        practice_game_designation !== undefined
          ? practice_game_designation
          : game_designation,
      roster_status:
        practice_roster_status !== undefined
          ? practice_roster_status
          : roster_status
    })
  } else if (practice_week) {
    // If practice_week is passed directly (e.g., from data.toJS() spreading),
    // ensure it's converted back to an Immutable Map
    params.practice_week = Map.isMap(practice_week)
      ? practice_week
      : new Map(practice_week)
  }

  if (current_nfl_team) {
    params.team = current_nfl_team
  }

  if (first_name && last_name) {
    params.first_name = first_name
    params.last_name = last_name
    params.name = `${first_name} ${last_name}`
    params.short_name = short_name || `${first_name[0]}. ${last_name}`
  }

  // Add status fields to top-level player object for direct access
  if (source_status !== undefined) {
    params.source_status = source_status
  }

  if (game_designation !== undefined) {
    params.game_designation = game_designation
  }

  if (roster_status !== undefined) {
    params.roster_status = roster_status
  }

  if (projection) {
    params.projection = new Map(projection)
  }

  if (points) {
    params.points = new Map(points)
  }

  if (market_salary) {
    params.market_salary = new Map(market_salary)
  }

  if (pts_added) {
    params.pts_added = new Map(pts_added)
  }

  if (projected_points_added_positive_including_cap_savings) {
    params.projected_points_added_positive_including_cap_savings = new Map(
      projected_points_added_positive_including_cap_savings
    )
  }

  if (projections) {
    params.projections = new List(projections)
  }

  if (practice) {
    params.practice = new List(practice)
  }

  if (transactions) {
    params.transactions = new List(transactions)
  }

  if (stats) {
    params.stats = new Map(stats)
  }

  if (betting_markets) {
    params.betting_markets = new List(betting_markets)
  }

  return new Map(params)
}
