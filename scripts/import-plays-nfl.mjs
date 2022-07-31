import fetch from 'node-fetch'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import { isMain, getToken, getGameDetailUrl, wait } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const currentRegularSeasonWeek = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)
const getPlayData = (play, week, type) => {
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
    seas: constants.season.year,
    seas_type: type,
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

const upsertPlayStat = async ({ playStat, esbid, playId }) => {
  const playStatData = getPlayStatData(playStat)
  await db('nfl_play_stats')
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
  type = 'REG'
} = {}) => {
  let token
  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
    type
  })

  for (const game of games) {
    const timeStr = `${game.date} ${game.time_est}`
    const gameStart = dayjs.tz(
      timeStr,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    if (dayjs().isBefore(gameStart)) continue

    if (!game.detailid) continue

    const currentPlays = await db('nfl_plays').where({ esbid: game.esbid })
    const haveEndPlay = currentPlays.find((p) => p.type_nfl === 'END_GAME')
    if (!argv.final && haveEndPlay) continue

    if (!token) {
      token = await getToken()
    }

    if (!token) {
      throw new Error('missing access token')
    }

    const url = getGameDetailUrl(game.detailid)
    log(url)

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!data.data) continue

    // reset playStats
    await db('nfl_play_stats').update({ valid: 0 }).where({ esbid: game.esbid })

    const timestamp = Math.round(new Date() / 1000)
    for (const play of data.data.viewer.gameDetail.plays) {
      const { playId } = play
      const currentPlay = currentPlays.find((p) => p.playId === play.playId)
      const playData = getPlayData(play, week, type)
      if (currentPlay) {
        // TODO - only update changes
        await db('nfl_plays')
          .update({
            updated: timestamp,
            ...playData
          })
          .where({
            esbid: game.esbid,
            playId
          })
      } else {
        await db('nfl_plays').insert({
          playId,
          esbid: game.esbid,
          updated: timestamp,
          ...playData
        })
      }

      for (const playStat of play.playStats) {
        await upsertPlayStat({ playStat, esbid: game.esbid, playId })
      }
    }

    if (argv.all) await wait(3000)
  }
}

const main = async () => {
  let error
  try {
    if (argv.current) {
      await run()
    } else if (argv.all) {
      for (let year = 2002; year < constants.season.year; year++) {
        log(`loading plays for year: ${year}, type: ${argv.type || 'all'}`)

        if (!argv.type || argv.type.toLowerCase() === 'pre') {
          for (let week = 0; week <= 4; week++) {
            await run({ year, week, type: 'PRE' })
            await wait(3000)
          }
        }

        if (!argv.type || argv.type.toLowerCase() === 'reg') {
          for (let week = 1; week <= 18; week++) {
            await run({ year, week, type: 'REG' })
            await wait(3000)
          }
        }

        if (!argv.type || argv.type.toLowerCase() === 'post') {
          for (let week = 18; week <= 22; week++) {
            await run({ year, week, type: 'POST' })
            await wait(3000)
          }
        }
      }
    } else if (argv.year) {
      const year = argv.year
      log(
        `loading plays for year: ${year}, week: ${argv.week || 'all'}, type: ${
          argv.type || 'all'
        }`
      )

      if (!argv.type || argv.type.toLowerCase() === 'pre') {
        if (argv.week) {
          await run({ year, week: argv.week, type: 'PRE' })
        } else {
          for (let week = 0; week <= 4; week++) {
            await run({ year, week, type: 'PRE' })
            await wait(3000)
          }
        }
      }

      if (!argv.type || argv.type.toLowerCase() === 'reg') {
        if (argv.week) {
          await run({ year, week: argv.week, type: 'REG' })
        } else {
          for (let week = 1; week <= 18; week++) {
            await run({ year, week, type: 'REG' })
            await wait(3000)
          }
        }
      }

      if (!argv.type || argv.type.toLowerCase() === 'post') {
        if (argv.week) {
          await run({ year, week: argv.week, type: 'POST' })
        } else {
          for (let week = 18; week <= 22; week++) {
            await run({ year, week, type: 'POST' })
            await wait(3000)
          }
        }
      }
    } else {
      const week = argv.week
      const type = argv.type
      await run({ week, type })
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
