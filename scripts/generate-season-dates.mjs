import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import utc from 'dayjs/plugin/utc.js'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(utc)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-season-dates')
enable_debug_namespaces('generate-season-dates')

const generateSeasonDates = async ({ year = current_season.year } = {}) => {
  const result = {
    openingDay: null,
    start: null,
    end: null,
    offseason: null,
    finalWeek: null,
    nflFinalWeek: null,
    regularSeasonFinalWeek: null,
    wildcardWeek: null
  }

  const games = await db('nfl_games')
    .whereIn('season_type', ['REG', 'POST'])
    .where({ season_year: year })

  if (!games.length) {
    log(`found no games for ${year} season`)
    return result
  }

  const sorted = games
    .filter((g) => g.kickoff_at)
    .sort((a, b) => a.kickoff_at - b.kickoff_at)
  const first_game = sorted[0]
  const first_game_day = dayjs(first_game.kickoff_at)
    .utc()
    .utcOffset(-4)
    .startOf('day')

  // first game day
  result.openingDay = first_game_day.unix()

  // two tuesdays before first game
  result.start = first_game_day
    .day(2) // set to tuesday
    .subtract(1, 'week')
    .unix()

  // current season super bowl
  const super_bowl = games.find((g) => g.day === 'SB')
  if (!super_bowl || !super_bowl.kickoff_at) {
    result.end = dayjs
      .tz(`${year}/02/01`, 'YYYY/MM/DD', 'America/New_York')
      .utc()
      .utcOffset(-5)
      .startOf('week')
      .unix()
  } else {
    result.end = dayjs(super_bowl.kickoff_at)
      .utc()
      .utcOffset(-5)
      .startOf('day')
      .unix()
  }

  // previous season super bowl
  const previous_super_bowl_query = await db('nfl_games').where({
    day: 'SB',
    season_year: year - 1
  })
  const previous_super_bowl = previous_super_bowl_query[0]
  if (!previous_super_bowl || !previous_super_bowl.kickoff_at) {
    result.offseason = dayjs
      .tz(`${year}/02/01`, 'YYYY/MM/DD', 'America/New_York')
      .utc()
      .utcOffset(-5)
      .startOf('week')
      .unix()
  } else {
    result.offseason = dayjs(previous_super_bowl.kickoff_at)
      .utc()
      .utcOffset(-5)
      .endOf('day')
      .unix()
  }

  result.nflFinalWeek = Math.max(
    ...games.filter((g) => g.season_type === 'REG').map((g) => g.week)
  )
  result.finalWeek = result.nflFinalWeek - 1
  result.regularSeasonFinalWeek = result.finalWeek - 3
  result.wildcardWeek = result.finalWeek - 2

  log(result)

  return result
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await generateSeasonDates({ year: argv.year })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generateSeasonDates
