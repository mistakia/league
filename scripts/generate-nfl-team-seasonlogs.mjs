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
} from '#libs-shared'
import { isMain, getLeague } from '#libs-server'

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

const get_stat_key = (base, { seasonlogs_type } = {}) =>
  (seasonlogs_type ? `${base}_${seasonlogs_type}` : base).toUpperCase()

const generate_seasonlogs = async ({
  year = constants.season.year,
  seasonlogs_type
} = {}) => {
  const gamelogs_query = db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week', 'nfl_games.year')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')

  const query_weeks = []

  if (seasonlogs_type === 'LAST_THREE') {
    for (let i = 1; i <= 3; i++) {
      const week = constants.season.week - i
      if (week > 0) query_weeks.push(week)
    }
  } else if (seasonlogs_type === 'LAST_FOUR') {
    for (let i = 1; i <= 4; i++) {
      const week = constants.season.week - i
      if (week > 0) query_weeks.push(week)
    }
  } else if (seasonlogs_type === 'LAST_EIGHT') {
    for (let i = 1; i <= 8; i++) {
      const week = constants.season.week - i
      if (week > 0) query_weeks.push(week)
    }
  }

  if (query_weeks.length) {
    gamelogs_query.whereIn('nfl_games.week', query_weeks)
  }

  const gamelogs = await gamelogs_query

  const weeks = [...new Set(gamelogs.map((g) => g.week))]
  log(`loaded ${gamelogs.length} gamelogs for ${year} REG weeks: ${weeks}`)

  const positions = groupBy(gamelogs, 'pos')

  // remove non fantasy relevant position gamelogs
  for (const position in positions) {
    if (!constants.positions.includes(position)) {
      delete positions[position]
    }
  }

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
    // calculate defenase allowed over average
    for (const nfl_team of constants.nflTeams) {
      // get gamelogs for players facing this team
      const opponent_gamelogs = gamelogs_by_opponent[nfl_team] || []

      // group player gamelogs by game
      const opponent_gamelogs_by_week = groupBy(opponent_gamelogs, 'week')
      const weeks = []

      // calculated allowed over average for each game
      for (const game_gamelogs of Object.values(opponent_gamelogs_by_week)) {
        // sum gamelogs for positon for this game
        const sum_gamelog_for_game = sum(game_gamelogs, constants.fantasyStats)

        // get all team gamelogs except against this opponent
        const opponent = game_gamelogs[0].tm
        const team_gamelogs_except_opponent = (
          gamelogs_by_team[opponent] || []
        ).filter((g) => g.opp !== nfl_team)

        if (!team_gamelogs_except_opponent.length) {
          continue
        }

        // calculate the offense average in all games except against this opponent
        const total_weeks = uniqBy(team_gamelogs_except_opponent, 'week').length
        const team_gamelogs_sum_outside_this_opponent = sum(
          team_gamelogs_except_opponent,
          constants.fantasyStats
        )
        const offense_average_outside_this_opponent = avg(
          team_gamelogs_sum_outside_this_opponent,
          constants.fantasyStats,
          total_weeks
        )

        // calculate difference between team average and given game
        const adjusted_stats = adj(
          sum_gamelog_for_game,
          offense_average_outside_this_opponent,
          constants.fantasyStats
        )
        weeks.push(adjusted_stats)
      }

      if (weeks.length > 0) {
        const total = sum(weeks, constants.fantasyStats, weeks.length)
        const avg_stats = avg(total, constants.fantasyStats, weeks.length)
        adjusted.push(avg_stats)
      }
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
      const stat_key = get_stat_key(`${position}_against_${stat_type}`, {
        seasonlogs_type
      })
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
      const stat_key = get_stat_key(`${position}_${stat_type}`, {
        seasonlogs_type
      })
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
      .onConflict(['stat_key', 'year', 'tm'])
      .merge()
  }

  // calculate league specific team stats
  const leagueIds = [0, 1]
  const league_team_seasonlog_inserts = []

  for (const leagueId of leagueIds) {
    const league = await getLeague({ lid: leagueId })

    for (const position of Object.keys(defense)) {
      const stat_types = ['adj', 'total', 'avg']
      for (const stat_type of stat_types) {
        const stat_key = get_stat_key(`${position}_against_${stat_type}`, {
          seasonlogs_type
        })
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
          items,
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
      .onConflict(['lid', 'stat_key', 'year', 'tm'])
      .merge()
  }

  if (percentile_inserts.length) {
    log(`inserting ${percentile_inserts.length} percentiles`)
    await db('percentiles')
      .insert(percentile_inserts)
      .onConflict(['percentile_key', 'field'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    await generate_seasonlogs()

    if (constants.season.week > 3) {
      await generate_seasonlogs({ seasonlogs_type: 'LAST_THREE' })
    }

    if (constants.season.week > 4) {
      await generate_seasonlogs({ seasonlogs_type: 'LAST_FOUR' })
    }

    if (constants.season.week > 8) {
      await generate_seasonlogs({ seasonlogs_type: 'LAST_EIGHT' })
    }
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
