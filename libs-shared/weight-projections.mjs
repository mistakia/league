import { projected_fantasy_stats, sources } from './constants.mjs'

const removeFalsy = (obj) => {
  const newObj = {}
  Object.keys(obj).forEach((prop) => {
    if (obj[prop]) newObj[prop] = obj[prop]
  })
  return newObj
}

const weightProjections = ({ projections, weights = [], userId, week }) => {
  const data = {}
  for (const r of projected_fantasy_stats) {
    data[r] = []
  }

  const userProjection =
    projections.find((p) => p.userid === userId && p.week === week) || {}
  const sourceProjections = projections.filter(
    (p) => p.sourceid && p.week === week && p.sourceid !== sources.AVERAGE
  )

  for (const projection of sourceProjections) {
    const { sourceid } = projection
    const source = weights.find((w) => w.uid === sourceid)
    const weight = source && source.weight !== null ? source.weight : 1

    for (const r in data) {
      if (projection[r]) {
        data[r].push({
          weight,
          value: projection[r]
        })
      }
    }
  }

  const result = {}
  for (const r in data) {
    const item = data[r]
    if (!item.length) {
      result[r] = 0
      continue
    }

    const totalWeight = item.reduce((a, b) => a + b.weight, 0)
    const values = item.map((a) => a.value)
    const appliedWeight = values.reduce(
      (sum, val, idx) => sum + item[idx].weight * val,
      0
    )

    result[r] = appliedWeight / totalWeight || 0
  }

  return Object.assign({}, result, removeFalsy(userProjection))
}

export default weightProjections
