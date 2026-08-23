import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  wait,
  nfl,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-nfl-games-nfl')
enable_debug_namespaces('import-nfl-games-nfl,nfl')

const format = (item) => {
  const datetime = item.time ? dayjs(item.time).tz('America/New_York') : null
  const date = datetime ? datetime.format('YYYY/MM/DD') : null
  const seas_type = item.seasonType
  const week_type = item.weekType
  const time_eastern = datetime ? datetime.format('HH:mm:ss') : null
  const year = item.season
  const score = item.detail || {}

  const esbid = (item.externalIds.find((e) => e.source === 'elias') || {}).id
  const shieldid = (item.externalIds.find((e) => e.source === 'shield') || {})
    .id

  const day = date
    ? getGameDayAbbreviation({ seas_type, date, time_eastern, week_type })
    : null

  return {
    ...(esbid && { esbid }),
    ...(shieldid && { shield_game_id: shieldid }),
    ...(item.id && { detail_v1_game_id: item.id }),

    ...(year && { season_year: year }),
    // `!= null`, not a truthiness test: PRE week 0 is the Hall of Fame game and
    // is falsy, so a truthiness test dropped `week` from the payload entirely
    // and the insert failed the NOT NULL constraint on nfl_games.week.
    ...(item.week != null && { week: item.week }),
    ...(date && { date }),
    ...(time_eastern && { time_eastern }),
    ...(day && { day }),
    ...(datetime && { kickoff_at: datetime.toDate() }),

    ...(item.awayTeam.abbreviation && {
      away_nfl_team: fixTeam(item.awayTeam.abbreviation)
    }),
    ...(item.homeTeam.abbreviation && {
      home_nfl_team: fixTeam(item.homeTeam.abbreviation)
    }),

    ...(seas_type && { season_type: seas_type }),
    ...(week_type && { week_type }),
    ...(score.detail && {
      is_overtime: (score.detail.phase || '').includes('OVERTIME')
    }),

    // Same falsy trap: a shutout is a legitimate score of 0, and a truthiness
    // test silently dropped it, leaving the column at whatever it already held.
    // `!= null` still skips the pre-game nulls.
    ...(score.homePointsTotal != null && { home_score: score.homePointsTotal }),
    ...(score.visitorPointsTotal != null && {
      away_score: score.visitorPointsTotal
    }),

    ...(item.venue && {
      stadium_name: item.venue.name,
      nfl_stadium_id: item.venue.id
    })
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
    season_year: year,
    week,
    season_type: seas_type
  })

  const game_missing_detailid_v1 = games.find((game) => !game.detail_v1_game_id)

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
  const stadiums_by_id = new Map()
  for (const game of data.games) {
    inserts.push(format(game))

    if (game.venue && game.venue.id) {
      stadiums_by_id.set(game.venue.id, {
        nfl_stadium_id: game.venue.id,
        stadium_name: game.venue.name
      })
    }
  }

  result.games_processed = inserts.length

  // The nfl_stadium dimension must be current before the games referencing it
  // land -- nfl_games.nfl_stadium_id carries a foreign key onto it, and the NFL
  // adds venues most seasons (new builds, international games), so a first game
  // at an unseen venue would otherwise fail the whole week's import.
  if (stadiums_by_id.size) {
    await db('nfl_stadium')
      .insert(Array.from(stadiums_by_id.values()))
      .onConflict('nfl_stadium_id')
      .merge()
  }

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
      // Cron entry-point. Oracle: either the API returned at least one game
      // (games_processed > 0) or the early-return path saw existing rows
      // already fully populated (games_skipped > 0). Both zero means the
      // current week has no nfl_games rows AND the API returned nothing —
      // silent failure (e.g., upstream auth shift returning empty payload).
      const result = await run({ ignore_cache })
      throw_if_shortfall(
        (result.games_processed || 0) === 0 && (result.games_skipped || 0) === 0
          ? `import-nfl-games-nfl --current shortfall: 0 games processed AND 0 games skipped — no current-week rows AND API returned no games`
          : null
      )
    } else if (argv.full_season) {
      // Preseason cron entry-point. --current cannot serve PRE: it targets
      // current_season.nfl_seas_week, which is derived by whole-week diff from
      // regular_season_start and runs a week ahead of the games being played --
      // on 2026-08-15 it read 2 while PRE week 1 games were in progress, so
      // --current would refresh an unplayed week and never mark week 1 FINAL.
      // Sweeping every week of the season type is week-agnostic.
      const year = argv.year || current_season.year
      const seas_type = argv.seas_type || current_season.nfl_seas_type

      const weeks = await db('nfl_games')
        .select('week')
        .where({ season_year: year, season_type: seas_type })
        .groupBy('week')
        .orderBy('week', 'asc')

      let games_processed = 0
      let games_skipped = 0
      for (const { week } of weeks) {
        const result = await run({ year, week, seas_type, ignore_cache })
        games_processed += result.games_processed || 0
        games_skipped += result.games_skipped || 0
        await wait(3000)
      }

      throw_if_shortfall(
        games_processed === 0 && games_skipped === 0
          ? `import-nfl-games-nfl --full_season shortfall: 0 games processed AND 0 games skipped across ${weeks.length} ${seas_type} week(s) in ${year}`
          : null
      )
    } else if (argv.year && argv.all) {
      const year = argv.year

      const pre_weeks = await db('nfl_games')
        .select('week')
        .where({ season_year: year, season_type: 'PRE' })
        .groupBy('week')
      for (const { week } of pre_weeks) {
        await run({ year, week, seas_type: 'PRE', ignore_cache })
        await wait(3000)
      }

      const reg_weeks = await db('nfl_games')
        .select('week')
        .where({ season_year: year, season_type: 'REG' })
        .groupBy('week')
      for (const { week } of reg_weeks) {
        await run({ year, week, seas_type: 'REG', ignore_cache })
        await wait(3000)
      }

      const post_weeks = await db('nfl_games')
        .select('week')
        .where({ season_year: year, season_type: 'POST' })
        .groupBy('week')
      for (const { week } of post_weeks) {
        await run({ year, week, seas_type: 'POST', ignore_cache })
        await wait(3000)
      }
    } else if (argv.all) {
      const start = argv.start || 1970
      const end = argv.end || 2002
      for (let year = start; year < end; year++) {
        const token = await nfl.get_session_token_v3()

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
