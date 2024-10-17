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
import { is_main, getLeague, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-nfl-team-seasonlogs')
debug.enable('generate-nfl-team-seasonlogs')

const passing_stats = [
  'pass_rating',
  'pass_yards_per_attempt',
  'pass_comp_pct',
  'sacks',
  'expected_pass_comp',
  'cpoe',
  'dropbacks',
  'pass_epa',
  'pass_epa_per_db',
  'avg_time_to_throw',
  'avg_time_to_pressure',
  'avg_time_to_sack',
  'pressures_against',
  'pressure_rate_against',
  'blitz_rate',
  'pass_drops',
  'drop_rate',
  'pass_completed_air_yards',
  'pass_yards_after_catch',
  'expected_pass_yards_after_catch',
  'pass_yards_after_catch_pct',
  'air_yards_per_pass_att',
  'avg_target_separation',
  'deep_pass_att_pct',
  'tight_window_pct',
  'play_action_pct'
]

const rushing_stats = [
  'rush_epa',
  'rush_epa_per_attempt',
  'expected_rush_yards',
  'expected_rush_yards_per_attempt',
  'rush_yards_over_expected',
  'rush_yards_over_expected_per_attempt',
  'rush_yards_after_contact',
  'rush_yards_after_contact_per_attempt',
  'rush_yards_before_contact',
  'rush_yards_before_contact_per_attempt',
  'rush_success_rate',
  'rush_attempts_yards_10_plus',
  'rush_attempts_speed_15_plus_mph',
  'rush_attempts_speed_20_plus_mph',
  'rush_avg_time_to_line_of_scrimmage',
  'rush_attempts_inside_tackles_pct',
  'rush_attempts_stacked_box_pct',
  'rush_attempts_under_center_pct',
  'longest_rush',
  'rush_yards_per_attempt',
  'rush_yards_10_plus_rate'
]

const receiving_stats = [
  'routes',
  'receiving_passer_rating',
  'catch_rate',
  'expected_catch_rate',
  'catch_rate_over_expected',
  'recv_yards_per_reception',
  'recv_yards_per_route',
  'recv_epa',
  'recv_epa_per_target',
  'recv_epa_per_route',
  'recv_drops',
  'recv_drop_rate',
  'recv_yards_after_catch',
  'expected_recv_yards_after_catch',
  'recv_yards_after_catch_over_expected',
  'recv_yards_after_catch_per_reception',
  'recv_avg_target_separation',
  'recv_air_yards',
  'recv_air_yards_per_target',
  'target_rate',
  'avg_route_depth',
  'endzone_targets',
  'endzone_recs',
  'team_target_share',
  'team_air_yard_share',
  'recv_deep_target_pct',
  'recv_tight_window_pct',
  'longest_reception',
  'recv_yards_15_plus_rate'
]

const rate_stats = [
  'pass_rating',
  'pass_yards_per_attempt',
  'pass_comp_pct',
  'pass_epa_per_db',
  'pressure_rate_against',
  'blitz_rate',
  'drop_rate',
  'pass_yards_after_catch_pct',
  'air_yards_per_pass_att',
  'deep_pass_att_pct',
  'tight_window_pct',
  'play_action_pct',
  'rush_epa_per_attempt',
  'expected_rush_yards_per_attempt',
  'rush_yards_over_expected_per_attempt',
  'rush_yards_after_contact_per_attempt',
  'rush_yards_before_contact_per_attempt',
  'rush_success_rate',
  'rush_yards_per_attempt',
  'rush_yards_10_plus_rate',
  'receiving_passer_rating',
  'catch_rate',
  'expected_catch_rate',
  'catch_rate_over_expected',
  'recv_yards_per_reception',
  'recv_yards_per_route',
  'recv_epa_per_target',
  'recv_epa_per_route',
  'recv_drop_rate',
  'recv_yards_after_catch_per_reception',
  'recv_air_yards_per_target',
  'target_rate',
  'recv_deep_target_pct',
  'recv_tight_window_pct',
  'recv_yards_15_plus_rate'
]

const copy = ({ opp, tm }) => ({ opp, tm })
const sum = (items = [], keys = []) => {
  const r = copy(items[0])
  const counts = {}

  for (const key of keys) {
    if (rate_stats.includes(key)) {
      r[key] = 0
      counts[key] = 0
    } else {
      r[key] = 0
    }
  }

  for (const item of items) {
    for (const key of keys) {
      if (rate_stats.includes(key)) {
        let weight = 1
        if (passing_stats.includes(key)) {
          weight = item.dropbacks || 1
        } else if (receiving_stats.includes(key)) {
          weight = item.routes || 1
        } else if (rushing_stats.includes(key)) {
          weight = item.ra || 1
        }

        if (item[key] !== null && item[key] !== undefined) {
          r[key] += item[key] * weight
          counts[key] += weight
        }
      } else {
        r[key] += item[key] || 0
      }
    }
  }

  // Calculate weighted average for rate stats
  for (const key of rate_stats) {
    if (counts[key] > 0) {
      r[key] = r[key] / counts[key]
    }
  }

  return r
}

const avg = (item, props, num) => {
  const obj = copy(item)
  for (const prop of props) {
    if (!rate_stats.includes(prop)) {
      obj[prop] = item[prop] / num
    }
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

const all_stats = [
  ...constants.fantasyStats,
  ...passing_stats,
  ...rushing_stats,
  ...receiving_stats
]

const rollup = (group) => {
  const stats = {
    total: [],
    avg: []
  }

  for (const gamelogs of Object.values(group)) {
    const t = sum(gamelogs, all_stats)
    stats.total.push(t)

    const weeks = uniqBy(gamelogs, 'week').length
    const a = avg(t, all_stats, weeks)
    stats.avg.push(a)
  }

  return stats
}

const format_percentile_inserts = (percentiles, percentile_key) => {
  const inserts = []
  for (const [field, value] of Object.entries(percentiles)) {
    if (
      value &&
      Object.values(value).every((v) => v !== null && v !== undefined)
    ) {
      inserts.push({
        percentile_key,
        field,
        ...value
      })
    }
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

  const esbids = [...new Set(gamelogs.map((g) => g.esbid))]
  const passing_gamelogs = await db('player_passing_gamelogs').whereIn(
    'esbid',
    esbids
  )
  const rushing_gamelogs = await db('player_rushing_gamelogs').whereIn(
    'esbid',
    esbids
  )
  const receiving_gamelogs = await db('player_receiving_gamelogs').whereIn(
    'esbid',
    esbids
  )
  const merged_gamelogs = gamelogs.map((gamelog) => {
    const passing = passing_gamelogs.find(
      (pg) => pg.esbid === gamelog.esbid && pg.pid === gamelog.pid
    )
    const rushing = rushing_gamelogs.find(
      (rg) => rg.esbid === gamelog.esbid && rg.pid === gamelog.pid
    )
    const receiving = receiving_gamelogs.find(
      (rg) => rg.esbid === gamelog.esbid && rg.pid === gamelog.pid
    )
    return {
      ...passing,
      ...rushing,
      ...receiving,
      ...gamelog
    }
  })

  const weeks = [...new Set(merged_gamelogs.map((g) => g.week))]
  log(
    `loaded ${merged_gamelogs.length} gamelogs for ${year} REG weeks: ${weeks}`
  )

  const positions = groupBy(merged_gamelogs, 'pos')

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
        const sum_gamelog_for_game = sum(game_gamelogs, all_stats)

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
          all_stats
        )
        const offense_average_outside_this_opponent = avg(
          team_gamelogs_sum_outside_this_opponent,
          all_stats,
          total_weeks
        )

        // calculate difference between team average and given game
        const adjusted_stats = adj(
          sum_gamelog_for_game,
          offense_average_outside_this_opponent,
          all_stats
        )
        weeks.push(adjusted_stats)
      }

      if (weeks.length > 0) {
        const total = sum(weeks, all_stats, weeks.length)
        const avg_stats = avg(total, all_stats, weeks.length)
        adjusted.push(avg_stats)
      }
    }
    defense[position].adj = adjusted

    const individual_position_percentiles = calculatePercentiles({
      items: position_gamelogs,
      stats: all_stats
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

      if (!teams.length) {
        log(`no teams for ${stat_key}`)
        continue
      }

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
        stats: all_stats
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

      if (!teams.length) {
        log(`no teams for ${stat_key}`)
        continue
      }

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
        stats: all_stats
      })
      percentile_inserts = percentile_inserts.concat(
        format_percentile_inserts(percentiles, stat_key)
      )
    }
  }

  if (team_seasonlog_inserts.length) {
    log(`inserting ${team_seasonlog_inserts.length} team stats`)
    await batch_insert({
      items: team_seasonlog_inserts,
      save: async (batch) => {
        await db('nfl_team_seasonlogs')
          .insert(batch)
          .onConflict(['stat_key', 'year', 'tm'])
          .merge()
      },
      batch_size: 500
    })
  }

  // calculate league specific team stats
  // TODO add a lid column to the percentiles table
  const leagueIds = [1]
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

        if (!teams.length) {
          log(`no teams for ${stat_key}`)
          continue
        }

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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_seasonlogs
