import { stats } from './constants'

const removeFalsy = (obj) => {
  const newObj = {}
  Object.keys(obj).forEach((prop) => {
    if (obj[prop]) newObj[prop] = obj[prop]
  })
  return newObj
}

const weightProjections = ({ projections, weights = [], userId }) => {
  const data = {}
  for (const r of stats) {
    data[r] = []
  }

  const userProjection = projections.find(p => p.userid === userId) || {}
  const sourceProjections = projections.filter(p => p.sourceid)

  for (const projection of sourceProjections) {
    const { sourceid } = projection
    const source = weights.find(w => w.uid === sourceid)
    const weight = source ? source.weight : (1 / sourceProjections.length)

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

    const totalWeight = item.reduce((a, b) => (a + b.weight), 0)
    const values = item.map(a => a.value)
    // weighted mean
    result[r] = values.reduce((a, b, idx) => (a + ((item[idx].weight / totalWeight) * b)), 0)
  }

  return Object.assign({}, result, removeFalsy(userProjection))
}

export default weightProjections
