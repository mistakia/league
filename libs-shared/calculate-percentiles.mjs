import percentile from 'percentile'

const calculatePercentiles = ({
  items,
  stats,
  qualifiers = {},
  prefix = '',
  reverse_percentile_stats = {}
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
      const reverse_percentiles = reverse_percentile_stats[stat] || false
      const percentile_points = reverse_percentiles
        ? [75, 50, 25, 10, 5, 2, 1, 100, 0]
        : [25, 50, 75, 90, 95, 98, 99, 0, 100]

      const result = percentile(percentile_points, values)

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
