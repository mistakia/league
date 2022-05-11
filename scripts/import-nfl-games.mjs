import dayjs from 'dayjs'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam, getGameDayAbbreviation } from '#common'
import { isMain } from '#utils'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nfl-games')
debug.enable('import-nfl-games')

const format = (item) => {
  const date = item.gameDate ? dayjs(item.gameDate).format('YYYY/MM/DD') : null
  const type = item.seasonType
  const time_est = item.gameTimeEastern
  const wk = item.week
  const seas = item.season
  const score = item.score || {}
  const day = date
    ? getGameDayAbbreviation({ type, date, time_est, wk, seas })
    : null

  return {
    esbid: item.gameId,
    gsisid: item.gameKey,
    shieldid: item.smartId,
    ngsid: item.gameId,

    seas,
    wk,
    date,
    time_est,
    day,

    v: fixTeam(item.visitorTeamAbbr),
    h: fixTeam(item.homeTeamAbbr),

    type,
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
    type: constants.jobs.NFL_GAMES,
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
