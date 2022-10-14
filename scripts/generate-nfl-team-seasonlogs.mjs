import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  constants,
  groupBy,
  uniqBy,
  calculatePercentiles,
  calculatePoints
} from '#common'
import { isMain, getLeague } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-nfl-team-seasonlogs')
debug.enable('generate-nfl-team-seasonlogs')

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

const rollup = (group) => {
  const stats = {
    total: [],
    avg: []
  }

  for (const gamelogs of Object.values(group)) {
    const t = sum(gamelogs, constants.fantasyStats)
    stats.total.push(t)

    const weeks = uniqBy(gamelogs, 'week').length
    const a = avg(t, constants.fantasyStats, weeks)
    stats.avg.push(a)
  }

  return stats
}

const format_percentile_inserts = (percentiles, percentile_key) => {
  const inserts = []
  for (const [field, value] of Object.entries(percentiles)) {
    inserts.push({
      percentile_key,
      field,
      ...value
    })
  }

  return inserts
}

const generate_seasonlogs = async ({ year = constants.season.year } = {}) => {
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week', 'nfl_games.year')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')

  const weeks = [...new Set(gamelogs.map((g) => g.week))]
  log(`loaded ${gamelogs.length} gamelogs for ${year} REG weeks: ${weeks}`)

  const positions = groupBy(gamelogs, 'pos')

  const defense = {}
  const offense = {}
  const individual = {}

  const team_seasonlog_inserts = []
  let percentile_inserts = []

  for (const position in positions) {
    const position_gamelogs = positions[position]

    individual[position] = {}

    const gamelogs_by_opponent = groupBy(position_gamelogs, 'opp')
    defense[position] = rollup(gamelogs_by_opponent)

    const gamelogs_by_team = groupBy(position_gamelogs, 'tm')
    offense[position] = rollup(gamelogs_by_team)

    const adjusted = []
    for (const team of constants.nflTeams) {
      // get defense gamelogs
      const gs = gamelogs_by_opponent[team] || []
      // group by week
      const weekGroups = groupBy(gs, 'week')
      const weeks = []
      for (const logs of Object.values(weekGroups)) {
        // sum gamelogs for positon for a given week
        const gamelog = sum(logs, constants.fantasyStats)
        // get team position average
        const offenseAverage = offense[position].avg.find(
          (g) => g.tm === gamelog.tm
        )
        // calculate difference between team average and given week
        const adjusted_stats = adj(
          gamelog,
          offenseAverage,
          constants.fantasyStats
        )
        weeks.push(adjusted_stats)
      }
      const total = sum(weeks, constants.fantasyStats, weeks.length)
      const avg_stats = avg(total, constants.fantasyStats, weeks.length)
      adjusted.push(avg_stats)
    }

    defense[position].adj = adjusted

    const individual_position_percentiles = calculatePercentiles({
      items: position_gamelogs,
      stats: constants.fantasyStats
    })
    percentile_inserts = percentile_inserts.concat(
      format_percentile_inserts(
        individual_position_percentiles,
        `individual_gamelog_${position}`.toUpperCase()
      )
    )
  }

  // iterate defense
  for (const position of Object.keys(defense)) {
    for (const stat_type of Object.keys(defense[position])) {
      const stat_key = `${position}_against_${stat_type}`.toUpperCase()
      const teams = defense[position][stat_type]
      for (const { opp, tm, ...stats } of teams) {
        team_seasonlog_inserts.push({
          stat_key,
          tm: opp,
          year,
          ...stats
        })
      }

      const percentiles = calculatePercentiles({
        items: teams,
        stats: constants.fantasyStats
      })
      percentile_inserts = percentile_inserts.concat(
        format_percentile_inserts(percentiles, stat_key)
      )
    }
  }

  // iterate offense
  for (const position of Object.keys(offense)) {
    for (const stat_type of Object.keys(offense[position])) {
      const stat_key = `${position}_${stat_type}`.toUpperCase()
      const teams = offense[position][stat_type]
      for (const { opp, tm, ...stats } of teams) {
        team_seasonlog_inserts.push({
          stat_key,
          tm,
          year,
          ...stats
        })
      }

      const percentiles = calculatePercentiles({
        items: teams,
        stats: constants.fantasyStats
      })
      percentile_inserts = percentile_inserts.concat(
        format_percentile_inserts(percentiles, stat_key)
      )
    }
  }

  if (team_seasonlog_inserts.length) {
    log(`inserting ${team_seasonlog_inserts.length} team stats`)
    await db('nfl_team_seasonlogs')
      .insert(team_seasonlog_inserts)
      .onConflict()
      .merge()
  }

  // calculate league specific team stats
  const leagueIds = [1]
  const league_team_seasonlog_inserts = []

  for (const leagueId of leagueIds) {
    const league = await getLeague(leagueId)

    for (const position of Object.keys(defense)) {
      const stat_types = ['adj', 'total', 'avg']
      for (const stat_type of stat_types) {
        const stat_key = `${position}_against_${stat_type}`.toUpperCase()
        const teams = defense[position][stat_type]

        const items = []

        // calculate points
        for (const { opp, tm, ...stats } of teams) {
          const points = calculatePoints({
            stats,
            position,
            league
          })

          items.push({
            tm: opp,
            stat_key,
            pts: points.total
          })
        }

        // calculate rank
        const sorted = items.sort((a, b) => a.pts - b.pts)
        sorted.forEach((item, index) => {
          const rnk = index + 1
          league_team_seasonlog_inserts.push({
            lid: leagueId,
            year,
            rnk,
            ...item
          })
        })

        const percentiles = calculatePercentiles({
          items: league_team_seasonlog_inserts,
          stats: ['pts']
        })
        percentile_inserts = percentile_inserts.concat(
          format_percentile_inserts(percentiles, stat_key)
        )
      }
    }
  }

  if (league_team_seasonlog_inserts.length) {
    log(
      `inserting ${league_team_seasonlog_inserts.length} league nfl team seasonlogs`
    )
    await db('league_nfl_team_seasonlogs')
      .insert(league_team_seasonlog_inserts)
      .onConflict()
      .merge()
  }

  if (percentile_inserts.length) {
    log(`inserting ${percentile_inserts.length} percentiles`)
    await db('percentiles').insert(percentile_inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    await generate_seasonlogs()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_seasonlogs
