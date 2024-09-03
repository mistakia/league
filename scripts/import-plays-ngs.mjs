import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { isMain, wait, ngs, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-plays-ngs')
debug.enable('import-plays-ngs,ngs')

const getPlayData = (play) => {
  const data = {
    sequence: play.sequence,
    state: play.playState,
    dwn: play.down,
    home_score: play.homeScore,
    special: play.isSTPlay,
    score: play.isScoring,
    desc: play.playDescription,
    play_type_ngs: play.playType,
    pos_team_id: play.possessionTeamId,
    qtr: play.quarter,
    year: play.season,
    // seas_type: play.seasonType,
    away_score: play.visitorScore,
    week: play.week,
    ydl_num: play.yardlineNumber,
    yards_to_go: play.yardsToGo,
    off_formation: play.offense ? play.offense.offenseFormation : null,
    off_personnel: play.offense ? play.offense.personnel : null,
    box_ngs: play.defense ? play.defense.defendersInTheBox : null,
    pru_ngs: play.defense ? play.defense.numberOfPassRushers : null,
    def_personnel: play.defense ? play.defense.personnel : null,
    game_clock_start: play.gameClockStart,
    game_clock_end: play.gameClockEnd,
    qb_pressure_ngs: play.passInfo ? play.passInfo.wasPressure : null,
    air_yards_ngs: play.passInfo ? play.passInfo.airYards : null,
    time_to_throw_ngs: play.passInfo ? play.passInfo.timeToThrow : null,
    route_ngs: play.recInfo ? play.recInfo.route : null,
    man_zone_ngs: play.defense ? play.defense.manZoneType : null,
    cov_type_ngs: play.defense ? play.defense.coverageType : null
  }

  if (play.possessionTeam) {
    data.pos_team = fixTeam(play.possessionTeam)
  }

  if (play.yardlineSide) {
    data.ydl_side = fixTeam(play.yardlineSide)
  }

  if (play.ydl_num) {
    if (play.ydl_num === 50) {
      data.ydl_100 = 50
    } else if (data.pos_team && data.ydl_side) {
      data.ydl_100 =
        data.ydl_side === data.pos_team ? 100 - data.ydl_num : data.ydl_num
    }
  }

  return data
}

const getPlayStatData = (playStat) => ({
  yards: playStat.yards,
  clubCode: playStat.clubCode ? fixTeam(playStat.clubCode) : null,
  gsisId: playStat.gsisId,
  playerName: playStat.playerName
})

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

    const timestamp = Math.round(Date.now() / 1000)

    const play_inserts = []
    const play_stat_inserts = []
    const snap_inserts = []

    for (const play of data.plays) {
      const { playId } = play
      if (!play.playType) {
        log(`skipping playId: ${playId} missing playType (esbid: ${esbid})`)
        continue
      }

      const playData = getPlayData(play)
      play_inserts.push({
        playId,
        esbid,
        updated: timestamp,
        seas_type,
        ...playData
      })

      if (play.playStats && Array.isArray(play.playStats)) {
        for (const playStat of play.playStats) {
          const playStatData = getPlayStatData(playStat)
          play_stat_inserts.push({
            playId,
            esbid,
            valid: 1,
            statId: playStat.statId,
            ...playStatData
          })
        }
      }

      if (play.nflIds && Array.isArray(play.nflIds)) {
        for (const gsis_it_id of play.nflIds) {
          snap_inserts.push({
            esbid,
            gsis_it_id,
            playId
          })
        }
      }
    }

    const end_play_exists = data.plays.find(
      (p) => p.playDescription === 'END GAME' && p.playState === 'APPROVED'
    )

    if (end_play_exists) {
      // reset final table playStats
      await db('nfl_play_stats')
        .update({ valid: 0 })
        .where({ esbid: game.esbid })

      if (snap_inserts.length) {
        try {
          await db('nfl_snaps').where({ esbid }).del()
          await db('nfl_snaps')
            .insert(snap_inserts)
            .onConflict(['esbid', 'playId', 'gsis_it_id'])
            .merge()
        } catch (err) {
          log(`Error on inserting snaps for esbid: ${game.esbid}`)
          log(err)
        }
      }

      if (play_inserts.length) {
        try {
          await db('nfl_play_stats')
            .insert(play_stat_inserts)
            .onConflict(['esbid', 'playId', 'statId', 'playerName'])
            .merge()
          await db('nfl_plays')
            .insert(play_inserts)
            .onConflict(['esbid', 'playId', 'year'])
            .merge()
          log(
            `inserted ${play_inserts.length} play stats for esbid: ${game.esbid}`
          )
        } catch (err) {
          log(
            `Error on inserting plays and play stats for esbid: ${game.esbid}`
          )
          log(err)
        }
      }
    }

    if (isCurrentWeek) {
      if (snap_inserts.length) {
        try {
          await db('nfl_snaps_current_week').where({ esbid }).del()
          await db('nfl_snaps_current_week')
            .insert(snap_inserts)
            .onConflict(['esbid', 'playId', 'gsis_it_id'])
            .merge()
        } catch (err) {
          log(`Error on inserting snaps for esbid: ${game.esbid}`)
          log(err)
        }
      }

      if (play_inserts.length) {
        try {
          if (play_stat_inserts.length) {
            await db('nfl_play_stats_current_week').where({ esbid }).del()

            await db('nfl_play_stats_current_week').insert(play_stat_inserts)
          }

          await db('nfl_plays_current_week')
            .insert(play_inserts)
            .onConflict(['esbid', 'playId'])
            .merge()
        } catch (err) {
          log(
            `Error on inserting plays and play stats for esbid: ${game.esbid}`
          )
          log(err)
        }
      }
    }

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

if (isMain(import.meta.url)) {
  main()
}

export default importPlaysForWeek
