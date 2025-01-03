import percentile from 'percentile'

const calculatePercentiles = ({
  items,
  stats,
  qualifiers = {},
  prefix = ''
}) => {
  const percentiles = {}

  for (const stat of stats) {
    const qualifier = qualifiers[stat]
    const filtered = qualifier
      ? items.filter((i) => i[qualifier.type] >= qualifier.value)
      : items
    const values = filtered
      .map((t) => t[stat])
      .filter((value) => value !== null && value !== undefined)

    if (values.length === 0) {
      percentiles[`${prefix}${stat}`] = {
        p25: null,
        p50: null,
        p75: null,
        p90: null,
        p95: null,
        p98: null,
        p99: null,
        min: null,
        max: null
      }
    } else {
      const result = percentile([25, 50, 75, 90, 95, 98, 99, 0, 100], values)
      percentiles[`${prefix}${stat}`] = {
        p25: result[0],
        p50: result[1],
        p75: result[2],
        p90: result[3],
        p95: result[4],
        p98: result[5],
        p99: result[6],
        min: result[7],
        max: result[8]
      }
    }
  }

  return percentiles
}

export default calculatePercentiles
