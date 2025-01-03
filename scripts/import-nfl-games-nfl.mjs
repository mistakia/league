import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { is_main, wait, nfl, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(timezone)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nfl-games-nfl')
debug.enable('import-nfl-games-nfl,nfl')

const format = (item) => {
  const datetime = item.time ? dayjs(item.time).tz('America/New_York') : null
  const date = datetime ? datetime.format('YYYY/MM/DD') : null
  const seas_type = item.seasonType
  const week_type = item.weekType
  const time_est = datetime ? datetime.format('HH:mm:ss') : null
  const year = item.season
  const score = item.detail || {}

  const esbid = (item.externalIds.find((e) => e.source === 'elias') || {}).id
  const shieldid = (item.externalIds.find((e) => e.source === 'shield') || {})
    .id
  const detailid_v3 = (
    item.externalIds.find((e) => e.source === 'gamedetail') || {}
  ).id

  const day = date
    ? getGameDayAbbreviation({ seas_type, date, time_est, week_type })
    : null

  return {
    ...(esbid && { esbid }),
    ...(shieldid && { shieldid }),
    ...(detailid_v3 && { detailid_v3 }),
    ...(item.id && { detailid_v1: item.id }),

    ...(year && { year }),
    ...(item.week && { week: item.week }),
    ...(date && { date }),
    ...(time_est && { time_est }),
    ...(day && { day }),
    ...(datetime && { timestamp: datetime.unix() }),

    ...(item.awayTeam.abbreviation && {
      v: fixTeam(item.awayTeam.abbreviation)
    }),
    ...(item.homeTeam.abbreviation && {
      h: fixTeam(item.homeTeam.abbreviation)
    }),

    ...(seas_type && { seas_type }),
    ...(week_type && { week_type }),
    ...(score.detail && {
      ot: (score.detail.phase || '').includes('OVERTIME')
    }),

    ...(score.homePointsTotal && { home_score: score.homePointsTotal }),
    ...(score.visitorPointsTotal && { away_score: score.visitorPointsTotal }),

    ...(item.venue && { stad: item.venue.name, stad_nfl_id: item.venue.id })
  }
}

const run = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type,
  token,
  force_import = false
} = {}) => {
  log(`processing ${seas_type} season games for week ${week} in ${year}`)
  const games = await db('nfl_games').where({
    year,
    week,
    seas_type
  })

  const game_missing_detailid_v3 = games.find((game) => !game.detailid_v3)
  const game_missing_detailid_v1 = games.find((game) => !game.detailid_v1)

  if (
    !force_import &&
    games.length &&
    !game_missing_detailid_v1 &&
    !game_missing_detailid_v3
  ) {
    log('found no games with missing ids')
    return
  }

  if (!token) {
    token = await nfl.get_session_token_v3()
  }

  if (!token) {
    throw new Error('missing access token')
  }

  const data = await nfl.getGames({
    year,
    week,
    seas_type,
    token,
    ignore_cache: force_import
  })

  const inserts = []
  for (const game of data.games) {
    inserts.push(format(game))
  }

  if (inserts.length) {
    // TODO not sure which unique key should be used here
    await db('nfl_games').insert(inserts).onConflict('esbid').merge()
    log(`saved data for ${inserts.length} games`)
  }
}

const main = async () => {
  let error
  try {
    const force_import = argv.force

    if (argv.current) {
      await run({ force_import })
    } else if (argv.year && argv.all) {
      const year = argv.year

      const pre_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'PRE' })
        .groupBy('week')
      for (const { week } of pre_weeks) {
        await run({ year, week, seas_type: 'PRE', force_import })
        await wait(3000)
      }

      const reg_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'REG' })
        .groupBy('week')
      for (const { week } of reg_weeks) {
        await run({ year, week, seas_type: 'REG', force_import })
        await wait(3000)
      }

      const post_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'POST' })
        .groupBy('week')
      for (const { week } of post_weeks) {
        await run({ year, week, seas_type: 'POST', force_import })
        await wait(3000)
      }
    } else if (argv.all) {
      const start = argv.start || 1970
      const end = argv.end || 2002
      for (let year = start; year < end; year++) {
        const token = await nfl.getToken()

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'PRE', token, force_import })
          await wait(3000)
        }

        for (let week = 0; week < 18; week++) {
          await run({ year, week, seas_type: 'REG', token, force_import })
          await wait(3000)
        }

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'POST', token, force_import })
          await wait(3000)
        }
      }
    } else {
      const year = argv.year
      const week = argv.week
      const seas_type = argv.seas_type
      await run({ year, week, seas_type, force_import })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_GAMES_NFL,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
