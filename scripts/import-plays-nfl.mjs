import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import { isMain, getToken, wait, nfl } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const currentRegularSeasonWeek = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)
const getPlayData = ({ play, year, week, seas_type }) => {
  const data = {
    desc: play.playDescription,
    dwn: play.down,
    drive_play_count: play.drivePlayCount,
    game_clock_start: play.clockTime,
    drive_seq: play.driveSequenceNumber,
    drive_yds: play.driveNetYards,
    ydl_end: play.endYardLine,
    ydl_start: play.yardLine,
    fd: play.firstDown,
    gtg: play.goalToGo,
    seas: year,
    seas_type,
    wk: week,
    next_play_type: play.nextPlayType,
    sequence: play.orderSequence,
    penalty: play.penaltyOnPlay,
    play_clock: play.playClock,
    deleted: play.playDeleted,
    review: play.playReviewStatus,
    score: play.scoringPlay,
    score_type: play.scoringPlayType,
    special_type: play.stPlayType,
    timestamp: play.timeOfDay,
    ytg: play.yardsToGo,
    qtr: play.quarter,
    type_nfl: play.playType
  }

  if (play.possessionTeam) {
    data.pos_team = play.possessionTeam.abbreviation
      ? fixTeam(play.possessionTeam.abbreviation)
      : null
  }

  if (play.scoringTeam) {
    data.score_team = fixTeam(play.scoringTeam.abbreviation)
  }

  return data
}

const getPlayStatData = (playStat) => ({
  yards: playStat.yards,
  teamid: playStat.team.id,
  playerName: playStat.playerName,
  clubCode: playStat.team ? fixTeam(playStat.team.abbreviation) : null,
  gsispid: playStat.gsisPlayer ? playStat.gsisPlayer.id : null
})

const upsertPlayStat = async ({ playStat, esbid, playId, isCurrentWeek }) => {
  const playStatData = getPlayStatData(playStat)
  await db(isCurrentWeek ? 'nfl_play_stats_current_week' : 'nfl_play_stats')
    .insert({
      playId,
      esbid,
      valid: 1,
      statId: playStat.statId,
      ...playStatData
    })
    .onConflict()
    .merge()
}

const log = debug('import:plays:nfl')
debug.enable('import:plays:nfl')

const run = async ({
  year = constants.season.year,
  week = currentRegularSeasonWeek,
  seas_type = 'REG',
  bypass_cache = false,
  force_update = false,
  token
} = {}) => {
  // use current_week tables when importing live plays from the current week
  const isCurrentWeek =
    !force_update &&
    year === constants.season.year &&
    week === currentRegularSeasonWeek

  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
    seas_type
  })

  let skip_count = 0

  for (const game of games) {
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

    if (!game.detailid) {
      log(`skipping esbid: ${game.esbid}, missing detailid`)
      skip_count += 1
      continue
    }

    const currentPlays = await db(
      isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays'
    ).where({ esbid: game.esbid })
    const haveEndPlay = currentPlays.find((p) => p.type_nfl === 'END_GAME')
    if (!force_update && haveEndPlay) {
      log(`skipping esbid: ${game.esbid}, already have final play`)
      skip_count += 1
      continue
    }

    if (!token) {
      token = await getToken()
    }

    if (!token) {
      throw new Error('missing access token')
    }

    log(`loading plays for esbid: ${game.esbid}`)

    const data = await nfl.getPlays({ id: game.detailid, token, bypass_cache })

    if (!data.data) continue

    // reset playStats
    if (force_update) {
      await db(isCurrentWeek ? 'nfl_play_stats_current_week' : 'nfl_play_stats')
        .update({ valid: 0 })
        .where({ esbid: game.esbid })
    }

    const timestamp = Math.round(new Date() / 1000)
    for (const play of data.data.viewer.gameDetail.plays) {
      const { playId } = play
      const currentPlay = currentPlays.find((p) => p.playId === play.playId)
      const playData = getPlayData({ play, year, week, seas_type })
      if (currentPlay) {
        // TODO - only update changes
        await db(isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays')
          .update({
            updated: timestamp,
            ...playData
          })
          .where({
            esbid: game.esbid,
            playId
          })
      } else {
        await db(isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays').insert(
          {
            playId,
            esbid: game.esbid,
            updated: timestamp,
            ...playData
          }
        )
      }

      for (const playStat of play.playStats) {
        await upsertPlayStat({
          playStat,
          esbid: game.esbid,
          playId,
          isCurrentWeek
        })
      }
    }

    if (argv.all) await wait(3000)
  }

  return skip_count === games.length
}

const main = async () => {
  let error
  try {
    if (argv.current) {
      await run({ bypass_cache: true, force_update: argv.final })
    } else if (argv.all) {
      const nfl_games_result = await db('nfl_games')
        .select('seas')
        .groupBy('seas')
        .orderBy('seas', 'asc')

      let years = nfl_games_result.map((i) => i.seas)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      for (const year of years) {
        log(
          `loading plays for year: ${year}, seas_type: ${
            argv.seas_type || 'all'
          }`
        )

        if (!argv.seas_type || argv.seas_type.toLowerCase() === 'pre') {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'PRE' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (PRE)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (PRE)`)
            await run({
              year,
              week: wk,
              seas_type: 'PRE',
              force_update: argv.final
            })
            await wait(4000)
          }
        }

        if (!argv.seas_type || argv.seas_type.toLowerCase() === 'reg') {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'REG' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (REG)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (REG)`)
            await run({
              year,
              week: wk,
              seas_type: 'REG',
              force_update: argv.final
            })
            await wait(4000)
          }
        }

        if (!argv.seas_type || argv.seas_type.toLowerCase() === 'post') {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'POST' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (POST)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (POST)`)
            await run({
              year,
              week: wk,
              seas_type: 'POST',
              force_update: argv.final
            })
            await wait(4000)
          }
        }
      }
    } else if (argv.year) {
      const year = argv.year
      log(
        `loading plays for year: ${year}, week: ${
          argv.week || 'all'
        }, seas_type: ${argv.seas_type || 'all'}`
      )

      if (!argv.seas_type || argv.seas_type.toLowerCase() === 'pre') {
        if (argv.week) {
          await run({
            year,
            week: argv.week,
            seas_type: 'REG',
            force_update: argv.final
          })
        } else {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'PRE' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (PRE)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (PRE)`)
            await run({
              year,
              week: wk,
              seas_type: 'PRE',
              force_update: argv.final
            })
            await wait(4000)
          }
        }
      }

      if (!argv.seas_type || argv.seas_type.toLowerCase() === 'reg') {
        if (argv.week) {
          await run({
            year,
            week: argv.week,
            seas_type: 'REG',
            force_update: argv.final
          })
        } else {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'REG' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (REG)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (REG)`)
            await run({ year, week: wk, type: 'REG', force_update: argv.final })
            await wait(4000)
          }
        }
      }

      if (!argv.seas_type || argv.seas_type.toLowerCase() === 'post') {
        if (argv.week) {
          await run({
            year,
            week: argv.week,
            seas_type: 'POST',
            force_update: argv.final
          })
        } else {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'POST' })
            .groupBy('wk')
            .orderBy('wk', 'asc')

          log(`processing plays for ${weeks.length} weeks in ${year} (POST)`)
          for (const { wk } of weeks) {
            log(`loading plays for week: ${wk} (POST)`)
            await run({
              year,
              week: wk,
              seas_type: 'POST',
              force_update: argv.final
            })
            await wait(4000)
          }
        }
      }
    } else if (argv.loop) {
      let all_games_skipped = false
      let loop_count = 0
      while (!all_games_skipped) {
        loop_count += 1
        log(`running import count: ${loop_count}`)
        all_games_skipped = await run({
          week: argv.week,
          seas_type: argv.seas_type,
          bypass_cache: true,
          force_update: argv.final
        })
      }
    } else {
      await run({
        week: argv.week,
        seas_type: argv.seas_type,
        bypass_cache: true,
        force_update: argv.final
      })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.NFL_PLAYS_NFL,
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
