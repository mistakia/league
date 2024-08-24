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
  ...data
}) {
  const params = {
    ...data
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

  return new Map(params)
}
