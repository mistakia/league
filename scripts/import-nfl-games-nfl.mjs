import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, wait, nfl, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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

  const day = date
    ? getGameDayAbbreviation({ seas_type, date, time_est, week_type })
    : null

  return {
    ...(esbid && { esbid }),
    ...(shieldid && { shieldid }),
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
  year = current_season.year,
  week = current_season.nfl_seas_week,
  seas_type = current_season.nfl_seas_type,
  token,
  ignore_cache = false,
  collector = null
} = {}) => {
  log(`processing ${seas_type} season games for week ${week} in ${year}`)

  const result = {
    games_processed: 0,
    games_updated: 0,
    games_skipped: 0
  }

  const games = await db('nfl_games').where({
    year,
    week,
    seas_type
  })

  const game_missing_detailid_v1 = games.find((game) => !game.detailid_v1)

  if (!ignore_cache && games.length && !game_missing_detailid_v1) {
    log('found no games with missing ids')
    result.games_skipped = games.length
    return result
  }

  if (!token) {
    try {
      token = await nfl.get_session_token_v3()
    } catch (error) {
      if (collector) {
        collector.add_error(error, {
          year,
          week,
          seas_type,
          context: 'get_session_token'
        })
      }
      throw error
    }
  }

  if (!token) {
    const error = new Error('missing access token')
    if (collector) {
      collector.add_error(error, { year, week, seas_type })
    }
    throw error
  }

  let data
  try {
    data = await nfl.getGames({
      year,
      week,
      seas_type,
      token,
      ignore_cache
    })
  } catch (error) {
    if (collector) {
      collector.add_error(error, { year, week, seas_type, context: 'getGames' })
    }
    throw error
  }

  const inserts = []
  for (const game of data.games) {
    inserts.push(format(game))
  }

  result.games_processed = inserts.length

  if (inserts.length) {
    // TODO not sure which unique key should be used here
    await db('nfl_games').insert(inserts).onConflict('esbid').merge()
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
  const argv = initialize_cli()
  let error
  try {
    const ignore_cache = argv.ignore_cache

    if (argv.current) {
      await run({ ignore_cache })
    } else if (argv.year && argv.all) {
      const year = argv.year

      const pre_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'PRE' })
        .groupBy('week')
      for (const { week } of pre_weeks) {
        await run({ year, week, seas_type: 'PRE', ignore_cache })
        await wait(3000)
      }

      const reg_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'REG' })
        .groupBy('week')
      for (const { week } of reg_weeks) {
        await run({ year, week, seas_type: 'REG', ignore_cache })
        await wait(3000)
      }

      const post_weeks = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'POST' })
        .groupBy('week')
      for (const { week } of post_weeks) {
        await run({ year, week, seas_type: 'POST', ignore_cache })
        await wait(3000)
      }
    } else if (argv.all) {
      const start = argv.start || 1970
      const end = argv.end || 2002
      for (let year = start; year < end; year++) {
        const token = await nfl.getToken()

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'PRE', token, ignore_cache })
          await wait(3000)
        }

        for (let week = 0; week < 18; week++) {
          await run({ year, week, seas_type: 'REG', token, ignore_cache })
          await wait(3000)
        }

        for (let week = 0; week < 5; week++) {
          await run({ year, week, seas_type: 'POST', token, ignore_cache })
          await wait(3000)
        }
      }
    } else {
      const year = argv.year
      const week = argv.week
      const seas_type = argv.seas_type
      await run({ year, week, seas_type, ignore_cache })
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
