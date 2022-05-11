import fetch from 'node-fetch'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getToken, wait } from '#utils'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nfl-game-ids')
debug.enable('import-nfl-game-ids')

const getUrl = ({ week, year, type = 'REG' }) =>
  `${config.url}/football/v1/games?season=${year}&seasonType=${type}&week=${week}&withExternalIds=true`

const currentRegularSeasonWeek = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)

const run = async ({
  year = constants.season.year,
  week = currentRegularSeasonWeek,
  type = 'REG'
} = {}) => {
  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
    type
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

  if (!startedGameWithMissingDetailId) return

  let token
  if (!token) {
    token = await getToken()
  }

  if (!token) {
    throw new Error('missing access token')
  }
  const url = getUrl({ week, year, type })
  log(url)
  const data = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  }).then((res) => res.json())

  for (const game of data.games) {
    const esb = game.externalIds.find((e) => e.source === 'Elias')
    const gameDetail = game.externalIds.find((e) => e.source === 'GameDetail')
    if (gameDetail) {
      await db('nfl_games')
        .update({
          detailid: gameDetail.id
        })
        .where({
          esbid: esb.id
        })
    }
  }
}

const main = async () => {
  let error
  try {
    if (argv.current) {
      await run()
    } else if (argv.all) {
      const year = argv.year || constants.season.year

      for (let week = 0; week <= 4; week++) {
        await run({ year, week, type: 'PRE' })
        await wait(3000)
      }

      for (let week = 1; week <= 18; week++) {
        await run({ year, week, type: 'REG' })
        await wait(3000)
      }

      for (let week = 18; week <= 22; week++) {
        await run({ year, week, type: 'POST' })
        await wait(3000)
      }
    } else {
      const year = argv.year
      const type = argv.type
      const week = argv.week
      await run({ year, week, type })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.NFL_GAME_IDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain()) {
  main()
}

export default run
