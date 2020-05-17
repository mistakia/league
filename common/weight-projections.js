import { stats } from './constants'

const weightProjections = ({ projections, weights = [] }) => {
  const data = {}
  for (const r of stats) {
    data[r] = []
  }

  for (const projection of projections) {
    const { sourceid } = projection
    const source = weights.find(w => w.sourceid === sourceid)
    const weight = source ? source.weight : (1 / projections.length)

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

  return result
}

export default weightProjections
