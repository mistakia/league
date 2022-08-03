import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam, getGameDayAbbreviation } from '#common'
import { isMain, getToken, wait, nfl } from '#utils'

dayjs.extend(timezone)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nfl-games-nfl')
debug.enable('import-nfl-games-nfl,nfl')

const currentRegularSeasonWeek = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)

const format = (item) => {
  const datetime = item.time ? dayjs.tz(item.time, 'America/New_York') : null
  const date = datetime ? datetime.format('YYYY/MM/DD') : null
  const seas_type = item.seasonType
  const week_type = item.weekType
  const time_est = datetime
    ? datetime.tz('America/New_York').format('HH:mm:ss')
    : null
  const seas = item.season
  const score = item.detail || {}

  const esbid = (item.externalIds.find((e) => e.source === 'elias') || {}).id
  const shieldid = (item.externalIds.find((e) => e.source === 'shield') || {})
    .id
  const detailid = (
    item.externalIds.find((e) => e.source === 'gamedetail') || {}
  ).id

  const day = date
    ? getGameDayAbbreviation({ seas_type, date, time_est, week_type, seas })
    : null

  return {
    esbid,
    shieldid,
    detailid,

    seas,
    wk: item.week,
    date,
    time_est,
    day,

    v: fixTeam(item.awayTeam.abbreviation),
    h: fixTeam(item.homeTeam.abbreviation),

    seas_type,
    week_type,
    ot: (score.detail ? score.detail.phase || '' : '').includes('OVERTIME'),

    home_score: score.homePointsTotal,
    away_score: score.visitorPointsTotal,

    stad: item.venue ? item.venue.name : null,
    stad_nflid: item.venue ? item.venue.id : null

    // clock: score.time,
    // status: score.phase
  }
}

const run = async ({
  year = constants.season.year,
  week = currentRegularSeasonWeek,
  seas_type = 'REG',
  token
} = {}) => {
  log(`processing ${seas_type} season games for week ${week} in ${year}`)
  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
    seas_type
  })

  const startedGameWithMissingDetailId = games.find((game) => {
    const timeStr = `${game.date} ${game.time_est}`
    const gameStart = dayjs.tz(
      timeStr,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    if (dayjs().isBefore(gameStart)) return false

    return !game.detailid
  })

  if (games.length && !startedGameWithMissingDetailId) {
    log('found no started games with missing ids')
    return
  }

  if (!token) {
    token = await getToken()
  }

  if (!token) {
    throw new Error('missing access token')
  }

  const data = await nfl.getGames({ year, week, seas_type, token })

  const inserts = []
  for (const game of data.games) {
    inserts.push(format(game))
  }

  if (inserts.length) {
    await db('nfl_games').insert(inserts).onConflict().merge()
    log(`saved data for ${inserts.length} games`)
  }
}

const main = async () => {
  let error
  try {
    if (argv.current) {
      await run()
    } else if (argv.year && argv.all) {
      const year = argv.year

      const pre_weeks = await db('nfl_games')
        .select('wk')
        .where({ seas: year, seas_type: 'PRE' })
        .groupBy('wk')
      for (const { wk } of pre_weeks) {
        await run({ year, week: wk, seas_type: 'PRE' })
        await wait(3000)
      }

      const reg_weeks = await db('nfl_games')
        .select('wk')
        .where({ seas: year, seas_type: 'REG' })
        .groupBy('wk')
      for (const { wk } of reg_weeks) {
        await run({ year, week: wk, seas_type: 'REG' })
        await wait(3000)
      }

      const post_weeks = await db('nfl_games')
        .select('wk')
        .where({ seas: year, seas_type: 'POST' })
        .groupBy('wk')
      for (const { wk } of post_weeks) {
        await run({ year, week: wk, seas_type: 'POST' })
        await wait(3000)
      }
    } else if (argv.all) {
      const start = argv.start || 1970
      const end = argv.end || 2002
      for (let year = start; year < end; year++) {
        const token = await getToken()

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'PRE', token })
          await wait(3000)
        }

        for (let week = 0; week < 18; week++) {
          await run({ year, week, seas_type: 'REG', token })
          await wait(3000)
        }

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'POST', token })
          await wait(3000)
        }
      }
    } else {
      const year = argv.year
      const seas_type = argv.seas_type
      const week = argv.week
      await run({ year, week, seas_type })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.IMPORT_NFL_GAMES_NFL,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
