import { List, Map } from 'immutable'

export function createPlayer({
  fname,
  lname,
  cteam,
  projection,
  points,
  market_salary,
  vorp,
  vorp_adj,
  projections,
  practice,
  transactions,
  ...data
}) {
  const params = {
    fname,
    lname,
    name: `${fname} ${lname}`,
    team: cteam,
    ...data
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

  if (vorp) {
    params.vorp = new Map(vorp)
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

  return new Map(params)
}
