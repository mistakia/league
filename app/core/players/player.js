import { List, Map } from 'immutable'

export function createPlayer({
  fname,
  lname,
  pname,
  current_nfl_team,

  projection,
  points,
  market_salary,
  pts_added,
  salary_adj_pts_added,
  projections,
  practice,
  transactions,
  stats,
  betting_markets,
  m,
  tu,
  w,
  th,
  f,
  s,
  su,
  practice_week,
  ...data
}) {
  const params = {
    ...data
  }

  // Handle practice day columns from get-players query
  if (
    m !== undefined ||
    tu !== undefined ||
    w !== undefined ||
    th !== undefined ||
    f !== undefined ||
    s !== undefined ||
    su !== undefined
  ) {
    params.practice_week = new Map({ m, tu, w, th, f, s, su })
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

  if (fname && lname) {
    params.fname = fname
    params.lname = lname
    params.name = `${fname} ${lname}`
    params.pname = pname || `${fname[0]}. ${lname}`
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

  if (salary_adj_pts_added) {
    params.salary_adj_pts_added = new Map(salary_adj_pts_added)
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
