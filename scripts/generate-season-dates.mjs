import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import utc from 'dayjs/plugin/utc.js'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

dayjs.extend(utc)
const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-season-dates')
debug.enable('generate-season-dates')

const generateSeasonDates = async ({ year = constants.season.year } = {}) => {
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
    .whereIn('seas_type', ['REG', 'POST'])
    .where({ year })

  if (!games.length) {
    log(`found no games for ${year} season`)
    return result
  }

  const sorted = games
    .filter((g) => g.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)
  const first_game = sorted[0]
  const first_game_day = dayjs
    .unix(first_game.timestamp)
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
  if (!super_bowl || !super_bowl.timestamp) {
    result.end = dayjs
      .tz(`${year}/02/01`, 'YYYY/MM/DD', 'America/New_York')
      .utc()
      .utcOffset(-5)
      .startOf('week')
      .unix()
  } else {
    result.end = dayjs
      .unix(super_bowl.timestamp)
      .utc()
      .utcOffset(-5)
      .startOf('day')
      .unix()
  }

  // previous season super bowl
  const previous_super_bowl_query = await db('nfl_games').where({
    day: 'SB',
    year: year - 1
  })
  const previous_super_bowl = previous_super_bowl_query[0]
  if (!previous_super_bowl || !previous_super_bowl.timestamp) {
    result.offseason = dayjs
      .tz(`${year}/02/01`, 'YYYY/MM/DD', 'America/New_York')
      .utc()
      .utcOffset(-5)
      .startOf('week')
      .unix()
  } else {
    result.offseason = dayjs
      .unix(previous_super_bowl.timestamp)
      .utc()
      .utcOffset(-5)
      .endOf('day')
      .unix()
  }

  result.nflFinalWeek = Math.max(
    ...games.filter((g) => g.seas_type === 'REG').map((g) => g.week)
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
    await generateSeasonDates({ year: argv.year })
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

export default generateSeasonDates
