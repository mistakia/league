import dayjs from 'dayjs'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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

const run = async ({ year = current_season.year, collector = null } = {}) => {
  log(`Importing games for ${year}`)

  const result = {
    games_processed: 0,
    games_updated: 0
  }

  const url = `${config.ngs_api_url}/league/schedule?season=${year}`

  let data
  try {
    data = await fetch(url, {
      headers: {
        referer: 'https://nextgenstats.nfl.com/'
      }
    }).then((res) => res.json())
  } catch (error) {
    if (collector) {
      collector.add_error(error, { year, context: 'fetch_schedule' })
    }
    throw error
  }

  const inserts = []
  for (const item of data) {
    inserts.push(format(item))
  }

  result.games_processed = inserts.length

  if (inserts.length) {
    await db('nfl_games')
      .insert(inserts)
      .onConflict(['v', 'h', 'week', 'year', 'seas_type'])
      .merge()
    log(`saved data for ${inserts.length} games`)
    result.games_updated = inserts.length
  }

  if (collector) {
    collector.set_stats({
      games_processed: result.games_processed,
      games_updated: result.games_updated
    })
  }

  return result
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const year = argv.year
    await run({ year })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_GAMES_NGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
