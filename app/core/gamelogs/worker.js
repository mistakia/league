import { calculatePercentiles, constants, groupBy, uniqBy } from '@common'

const copy = ({ opp, tm }) => ({ opp, tm })

const sum = (items = [], keys = []) => {
  const r = copy(items[0])
  for (const key of keys) {
    r[key] = items.reduce((acc, item) => acc + item[key], 0)
  }
  return r
}

const avg = (item, props, num) => {
  const obj = copy(item)
  for (const prop of props) {
    obj[prop] = item[prop] / num
  }
  return obj
}

const adj = (actual, average, props) => {
  const obj = copy(actual)
  for (const prop of props) {
    obj[prop] = actual[prop] - average[prop]
  }
  return obj
}

function rollup(group) {
  const stats = {
    total: [],
    avg: []
  }

  for (const gamelogs of Object.values(group)) {
    const t = sum(gamelogs, constants.fantasyStats)
    const weeks = uniqBy(gamelogs, 'week').length
    stats.avg.push(avg(t, constants.fantasyStats, weeks))
    stats.total.push(t)
  }

  const percentiles = {}
  for (const type in stats) {
    percentiles[type] = calculatePercentiles({
      items: stats[type],
      stats: constants.fantasyStats
    })
  }

  return {
    stats,
    percentiles
  }
}

export function processPlayerGamelogs(gamelogs) {
  const positions = groupBy(gamelogs, 'pos')

  const defense = {}
  const offense = {}
  const individual = {}

  for (const position in positions) {
    const glogs = positions[position]

    const defenseGroups = groupBy(glogs, 'opp')
    defense[position] = rollup(defenseGroups)

    const offenseGroups = groupBy(glogs, 'tm')
    offense[position] = rollup(offenseGroups)

    const adjusted = []
    for (const team of constants.nflTeams) {
      // get defense gamelogs
      const gs = defenseGroups[team]
      // group by week
      const weekGroups = groupBy(gs, 'week')
      const weeks = []
      for (const logs of Object.values(weekGroups)) {
        // sum week
        const gamelog = sum(logs, constants.fantasyStats)
        // get offense (opponent) average
        const offenseAverage = offense[position].stats.avg.find(
          (g) => g.tm === gamelog.tm
        )
        // calculate difference (adjusted)
        const adjusted = adj(gamelog, offenseAverage, constants.fantasyStats)
        weeks.push(adjusted)
      }
      const total = sum(weeks, constants.fantasyStats, weeks.length)
      adjusted.push(avg(total, constants.fantasyStats, weeks.length))
    }

    defense[position].stats.adj = adjusted
    defense[position].percentiles.adj = calculatePercentiles({
      items: adjusted,
      stats: constants.fantasyStats
    })

    individual[position] = calculatePercentiles({
      items: glogs,
      stats: constants.fantasyStats
    })
  }

  return {
    offense,
    defense,
    individual
  }
}

export function processTeamGamelogs(gamelogs) {
  return calculatePercentiles({
    items: gamelogs,
    stats: constants.teamStats
  })
}
