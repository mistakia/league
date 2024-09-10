import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, wait, ngs, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-plays-ngs')
debug.enable('import-plays-ngs,ngs')

const importPlaysForWeek = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type,
  force_update = false,
  ignore_cache = false,
  throttle = 0
} = {}) => {
  const current_week = Math.max(
    dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
    1
  )

  if (week === null || week === undefined) {
    week = current_week
  }
  const isCurrentWeek =
    year === constants.season.year && week === constants.season.nfl_seas_week

  log(
    `importing plays for week ${week} ${year} ${seas_type} (force_update: ${force_update}, isCurrentWeek: ${isCurrentWeek})`
  )

  // get list of games for this week
  const games = await db('nfl_games').where({
    year,
    week,
    seas_type
  })

  let skip_count = 0

  for (const game of games) {
    const { esbid } = game
    const timeStr = `${game.date} ${game.time_est}`
    const gameStart = dayjs.tz(
      timeStr,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    if (dayjs().isBefore(gameStart)) {
      log(`skipping esbid: ${game.esbid}, game hasn't started`)
      skip_count += 1
      continue
    }

    const currentPlays = await db('nfl_plays').where({ esbid })

    const haveEndPlay = currentPlays.find(
      (p) => p.desc === 'END GAME' && p.state === 'APPROVED'
    )

    if (!force_update && haveEndPlay) {
      log(`skipping esbid: ${game.esbid}, already have final play`)
      skip_count += 1
      continue
    }

    const data = await ngs.getPlays({
      esbid,
      ignore_cache: isCurrentWeek || ignore_cache
    })

    if (!data || !data.plays) {
      log(`skipping esbid: ${game.esbid}, missing play data`)
      continue
    }

    await ngs.save_play_data({ esbid, data })

    if (throttle) {
      await wait(throttle)
    }
  }

  return skip_count === games.length
}

const importPlaysForYear = async ({
  year = constants.season.year,
  seas_type = 'REG',
  force_update = false,
  ignore_cache = false
} = {}) => {
  const weeks = await db('nfl_games')
    .select('week')
    .where({ year, seas_type })
    .groupBy('week')
    .orderBy('week', 'asc')

  log(`processing plays for ${weeks.length} weeks in ${year} (${seas_type})`)
  for (const { week } of weeks) {
    log(`loading plays for week: ${week} (${seas_type})`)
    await importPlaysForWeek({
      year,
      week,
      seas_type,
      force_update,
      ignore_cache,
      throttle: 3000
    })
    await wait(4000)
  }
}

const importAllPlays = async ({
  start,
  end,
  seas_type = 'ALL',
  force_update,
  ignore_cache = false
} = {}) => {
  const nfl_games_result = await db('nfl_games')
    .select('year')
    .groupBy('year')
    .orderBy('year', 'asc')

  let years = nfl_games_result.map((i) => i.year)
  if (start) {
    years = years.filter((year) => year >= start)
  }
  if (end) {
    years = years.filter((year) => year <= end)
  }

  for (const year of years) {
    log(`loading plays for year: ${year}, seas_type: ${seas_type}`)
    const is_seas_type_all = seas_type.toLowerCase() === 'all'

    if (is_seas_type_all || seas_type.toLowerCase() === 'pre') {
      await importPlaysForYear({
        year,
        seas_type: 'PRE',
        force_update,
        ignore_cache
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'reg') {
      await importPlaysForYear({
        year,
        seas_type: 'REG',
        force_update,
        ignore_cache
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'post') {
      await importPlaysForYear({
        year,
        seas_type: 'POST',
        force_update,
        ignore_cache
      })
      await wait(3000)
    }
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      await importAllPlays({
        start: argv.start,
        end: argv.end,
        seas_type: argv.seas_type,
        force_update: argv.final,
        ignore_cache: argv.ignore_cache
      })
    } else if (argv.year) {
      if (argv.week) {
        await importPlaysForWeek({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type,
          force_update: argv.final,
          ignore_cache: argv.ignore_cache
        })
      } else {
        await importPlaysForYear({
          year: argv.year,
          seas_type: argv.seas_type,
          force_update: argv.final,
          ignore_cache: argv.ignore_cache
        })
      }
    } else if (argv.live) {
      let all_games_skipped = false
      let loop_count = 0
      while (!all_games_skipped) {
        loop_count += 1
        log(`running import count: ${loop_count}`)
        all_games_skipped = await importPlaysForWeek({
          week: argv.week,
          seas_type: argv.seas_type,
          force_update: argv.final,
          ignore_cache: argv.ignore_cache
        })
      }
    } else {
      log('start')
      await importPlaysForWeek({
        week: argv.week,
        seas_type: argv.seas_type,
        force_update: argv.final,
        ignore_cache: argv.ignore_cache
      })
      log('end')
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NFL_PLAYS_NGS,
    error
  })

  await db.destroy()

  // process.exit() is not working
  process.kill(process.pid)
}

if (is_main(import.meta.url)) {
  main()
}

export default importPlaysForWeek
