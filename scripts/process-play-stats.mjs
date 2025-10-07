import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, update_play, report_job } from '#libs-server'
import db from '#db'
import { constants, groupBy, getPlayFromPlayStats } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  get_play_stats,
  get_play_type_ngs,
  get_play_type_nfl,
  is_successful_play,
  get_completed_games
} from '#libs-server/play-stats-utils.mjs'
import populate_nfl_year_week_timestamp from './populate-nfl-year-week-timestamp.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-play-stats')
debug.enable('process-play-stats,update-play')

const process_play_stats = async ({
  week = constants.season.last_week_with_stats,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  ignore_conflicts = false,
  dry_run = false
} = {}) => {
  let play_update_count = 0
  let play_field_update_count = 0

  // Get completed games first
  const completed_game_esbids = await get_completed_games({
    year,
    week,
    seas_type
  })
  log(
    `Found ${completed_game_esbids.length} completed games for ${year} week ${week}`
  )

  if (completed_game_esbids.length === 0) {
    log('No completed games found, skipping processing')
    return
  }

  const playStats = await get_play_stats({ year, week, seas_type })

  log('Updating play row columns: off, def')

  const plays = await db('nfl_plays')
    .select(
      'nfl_games.h',
      'nfl_games.v',
      'nfl_plays.off',
      'nfl_plays.def',
      'nfl_plays.play_type',
      'nfl_plays.esbid',
      'nfl_plays.playId',
      'nfl_plays.play_type_ngs',
      'nfl_plays.play_type_nfl',
      'nfl_plays.pos_team',
      'nfl_plays.yds_gained',
      'nfl_plays.yards_to_go',
      'nfl_plays.dwn',
      'nfl_plays.successful_play'
    )
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_plays.seas_type', seas_type)
    .whereIn('nfl_plays.esbid', completed_game_esbids)

  for (const play of plays) {
    const off = play.pos_team
    if (!off) continue
    const def = off === play.h ? play.v : play.h
    let play_type
    if (play.play_type_ngs) {
      play_type = get_play_type_ngs(play.play_type_ngs)
    } else if (play.play_type_nfl) {
      play_type = get_play_type_nfl(play.play_type_nfl)
    } else {
      continue
    }

    const successful_play = is_successful_play(play)

    if (dry_run) continue

    await update_play({
      play_row: {
        off: play.off,
        def: play.def,
        play_type: play.play_type,
        esbid: play.esbid,
        playId: play.playId,
        successful_play: play.successful_play
      },
      update: {
        off,
        def,
        play_type,
        successful_play
      },
      ignore_conflicts
    })
  }

  // Filter play stats to only include completed games
  const filtered_play_stats = playStats.filter((stat) =>
    completed_game_esbids.includes(stat.esbid)
  )

  const play_stats_by_gsisid = groupBy(filtered_play_stats, 'gsisId')
  const gsisids = Object.keys(play_stats_by_gsisid)
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)

  log('Updating play row pid columns')
  const playStatsByEsbid = groupBy(filtered_play_stats, 'esbid')
  for (const [esbid, playStats] of Object.entries(playStatsByEsbid)) {
    const playStatsByPlay = groupBy(playStats, 'playId')
    for (const [playId, playStats] of Object.entries(playStatsByPlay)) {
      // ignore plays with no pos_team, likely a timeout or two minute warning
      const playStat = playStats.find((p) => p.pos_team)
      if (!playStat) continue

      const play_row = getPlayFromPlayStats({ playStats })
      if (Object.keys(play_row).length === 0) continue

      if (play_row.player_fuml_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.player_fuml_gsis
        )
        if (player) {
          play_row.player_fuml_pid = player.pid
        }
      }

      if (play_row.bc_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.bc_gsis
        )
        if (player) {
          play_row.bc_pid = player.pid
        }
      }

      if (play_row.psr_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.psr_gsis
        )
        if (player) {
          play_row.psr_pid = player.pid
        }
      }

      if (play_row.trg_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.trg_gsis
        )
        if (player) {
          play_row.trg_pid = player.pid
        }
      }

      if (play_row.intp_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.intp_gsis
        )
        if (player) {
          play_row.intp_pid = player.pid
        }
      }

      // TODO should be ordered based on order of events in the play (use play description)

      for (let i = 0; i < 3; i++) {
        const gsis_id = play_row.tacklers_solo[i]
        if (gsis_id) {
          play_row[`solo_tackle_${i + 1}_gsis`] = gsis_id
          const player = player_gsisid_rows.find((p) => p.gsisid === gsis_id)
          if (player) {
            play_row[`solo_tackle_${i + 1}_pid`] = player.pid
          }
        }
      }

      for (let i = 0; i < 2; i++) {
        const gsis_id = play_row.tacklers_with_assisters[i]
        if (gsis_id) {
          play_row[`assisted_tackle_${i + 1}_gsis`] = gsis_id
          const player = player_gsisid_rows.find((p) => p.gsisid === gsis_id)
          if (player) {
            play_row[`assisted_tackle_${i + 1}_pid`] = player.pid
          }
        }
      }

      for (let i = 0; i < 4; i++) {
        const gsis_id = play_row.tackle_assisters[i]
        if (gsis_id) {
          play_row[`tackle_assist_${i + 1}_gsis`] = gsis_id
          const player = player_gsisid_rows.find((p) => p.gsisid === gsis_id)
          if (player) {
            play_row[`tackle_assist_${i + 1}_pid`] = player.pid
          }
        }
      }

      if (dry_run) continue

      play_update_count += 1

      // TODO pull all plays in a single select instead of making a call for each play
      const changes = await update_play({
        esbid,
        playId,
        update: play_row,
        ignore_conflicts
      })
      play_field_update_count += changes
    }
  }
  log(
    `Updated ${play_field_update_count} play fields on ${play_update_count} plays from ${completed_game_esbids.length} completed games`
  )
}

const main = async () => {
  let error
  try {
    const year = argv.year
    const week = argv.week
    const seas_type = argv.seas_type || constants.season.nfl_seas_type
    const dry_run = argv.dry
    const ignore_conflicts = argv.ignore_conflicts || argv.force

    if (argv.all) {
      log('processing all plays')
      const results = await db('nfl_plays')
        .select('year')
        .groupBy('year')
        .orderBy('year', 'desc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      log(`processing plays for ${years.length} years`)

      for (const year of years) {
        for (const seas_type of constants.seas_types) {
          const weeks = await db('nfl_plays')
            .select('week')
            .where({ year, seas_type })
            .groupBy('week')
            .orderBy('week', 'asc')
          log(
            `processing plays for ${weeks.length} weeks in ${year} (${seas_type})`
          )
          for (const { week } of weeks) {
            log(`processing plays for week ${week} in ${year} (${seas_type})`)
            await process_play_stats({
              year,
              week,
              seas_type,
              dry_run,
              ignore_conflicts
            })
          }
        }
      }
    } else if (year && !week) {
      const weeks = await db('nfl_plays')
        .select('week')
        .where({ year, seas_type })
        .groupBy('week')
      log(`processing plays for ${year} ${seas_type}: ${weeks.length} weeks`)
      for (const { week } of weeks) {
        log(`processing plays for week ${week} in ${year}`)
        await process_play_stats({
          year,
          week,
          seas_type,
          dry_run,
          ignore_conflicts
        })
      }
    } else {
      await process_play_stats({
        year: argv.year,
        week: argv.week,
        seas_type: argv.seas_type,
        dry_run,
        ignore_conflicts
      })
    }

    // Refresh nfl_year_week_timestamp materialized view after processing plays
    if (!dry_run) {
      log('Refreshing nfl_year_week_timestamp materialized view...')
      try {
        const refresh_year = year || constants.season.year
        await populate_nfl_year_week_timestamp({ year: refresh_year })
        log('Successfully refreshed nfl_year_week_timestamp')
      } catch (refresh_error) {
        log(
          'Warning: Failed to refresh nfl_year_week_timestamp:',
          refresh_error.message
        )
        // Don't fail the entire job if materialized view refresh fails
      }
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_PLAY_STATS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_play_stats
