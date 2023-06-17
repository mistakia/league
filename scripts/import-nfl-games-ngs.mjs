import dayjs from 'dayjs'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { constants, fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { isMain } from '#libs-server'
import config from '#config'

dayjs.extend(timezone)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-games-ngs')
debug.enable('import-games-ngs')

const getWeek = (week, week_type) => {
  switch (week_type) {
    case 'PRE':
    case 'REG':
    case 'HOF':
      return week

    case 'WC':
      return 1

    case 'DIV':
      return 2

    case 'CON':
    case 'CONF':
      return 3

    case 'SB':
      return 4

    default:
      throw new Error(`invalid week_type: ${week_type}`)
  }
}

const format = (item) => {
  const date = item.gameDate ? dayjs(item.gameDate).format('YYYY/MM/DD') : null
  const seas_type = item.seasonType
  const week_type = ['REG', 'PRE'].includes(seas_type)
    ? seas_type
    : item.weekNameAbbr
  const time_est = item.gameTimeEastern
  const week = getWeek(item.week, week_type)
  const year = item.season
  const score = item.score || {}
  const day = date
    ? getGameDayAbbreviation({ seas_type, date, time_est, week_type })
    : null

  const datetime = dayjs(
    `${item.gameDate} ${item.gameTimeEastern}`,
    'DD/MM/YYYY HH:mm:ss'
  ).tz(item.time, 'America/New_York')

  return {
    esbid: item.gameId,
    gsisid: item.gameKey,
    shieldid: item.smartId,
    ngsid: item.gameId,

    year,
    week,
    date,
    time_est,
    day,
    timestamp: datetime.unix() || null,

    v: fixTeam(item.visitorTeamAbbr),
    h: fixTeam(item.homeTeamAbbr),

    seas_type,
    week_type,
    ot: (score.phase || '').includes('OVERTIME'),

    home_score: (score.homeTeamScore || {}).pointTotal,
    away_score: (score.visitorTeamScore || {}).pointTotal,

    stad: item.site.siteFullName,
    site_ngsid: item.site.siteId,

    clock: score.time,
    status: score.phase
  }
}

const run = async ({ year = constants.season.year }) => {
  log(`Importing games for ${year}`)
  const url = `${config.ngs_api_url}/league/schedule?season=${year}`
  const data = await fetch(url, {
    headers: {
      referer: 'https://nextgenstats.nfl.com/'
    }
  }).then((res) => res.json())

  const inserts = []
  for (const item of data) {
    inserts.push(format(item))
  }

  if (inserts.length) {
    await db('nfl_games').insert(inserts).onConflict().merge()
    log(`saved data for ${inserts.length} games`)
  }
}

const main = async () => {
  let error
  try {
    const year = argv.year
    await run({ year })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.IMPORT_NFL_GAMES_NGS,
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
