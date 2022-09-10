import fetch from 'node-fetch'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import { isMain, wait } from '#utils'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const currentRegularSeasonWeek = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)

const log = debug('import-plays-ngs')

const getPlayData = (play) => ({
  sequence: play.sequence,
  state: play.playState,
  dwn: play.down,
  home_score: play.homeScore,
  special: play.isSTPlay,
  score: play.isScoring,
  desc: play.playDescription,
  type_ngs: play.playType,
  pos_team: play.possessionTeam ? fixTeam(play.possessionTeam) : null,
  pos_team_id: play.possessionTeamId,
  qtr: play.quarter,
  seas: play.season,
  // seas_type: play.seasonType,
  away_score: play.visitorScore,
  wk: play.week,
  ydl_num: play.yardlineNumber,
  ydl_side: play.yardlineSide ? fixTeam(play.yardlineSide) : null,
  ytg: play.yardsToGo,
  off_formation: play.offense ? play.offense.offenseFormation : null,
  off_personnel: play.offense ? play.offense.personnel : null,
  box_ngs: play.defense ? play.defense.defendersInTheBox : null,
  pru_ngs: play.defense ? play.defense.numberOfPassRushers : null,
  def_personnel: play.defense ? play.defense.personnel : null
})

const getPlayStatData = (playStat) => ({
  yards: playStat.yards,
  clubCode: playStat.clubCode ? fixTeam(playStat.clubCode) : null,
  gsisId: playStat.gsisId,
  playerName: playStat.playerName
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

const run = async ({
  year = constants.season.year,
  week = currentRegularSeasonWeek,
  force_update = false,
  seas_type = 'REG'
} = {}) => {
  // use current_week tables when importing live plays from the current week
  const isCurrentWeek =
    !force_update &&
    year === constants.season.year &&
    week === currentRegularSeasonWeek

  // get list of games for this week
  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
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
      skip_count += 1
      continue
    }

    const currentPlays = await db(
      isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays'
    ).where({ esbid })

    const haveEndPlay = currentPlays.find(
      (p) => p.desc === 'END GAME' && p.state === 'APPROVED'
    )

    if (!force_update && haveEndPlay) {
      skip_count += 1
      continue
    }

    log(`loading plays for esbid: ${esbid}`)
    const url = `${config.ngs_api_url}/live/plays/playlist/game?gameId=${esbid}`
    const data = await fetch(url, {
      headers: {
        origin: 'https://nextgenstats.nfl.com',
        referer: 'https://nextgenstats.nfl.com/stats/game-center'
      }
    }).then((res) => res.json())

    if (!data || !data.plays) continue

    if (force_update) {
      // reset playStats
      await db(isCurrentWeek ? 'nfl_play_stats_current_week' : 'nfl_play_stats')
        .update({ valid: 0 })
        .where({ esbid })
    }

    const timestamp = Math.round(Date.now() / 1000)
    for (const play of data.plays) {
      const { playId } = play
      const currentPlay = currentPlays.find((p) => p.playId === play.playId)

      const playData = getPlayData(play)

      if (currentPlay) {
        // TODO only update changes
        await db(isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays')
          .update({
            ...playData,
            seas_type,
            updated: timestamp
          })
          .where({ playId, esbid })
      } else {
        await db(isCurrentWeek ? 'nfl_plays_current_week' : 'nfl_plays').insert(
          {
            playId,
            esbid,
            updated: timestamp,
            seas_type,
            ...playData
          }
        )
      }

      await db(isCurrentWeek ? 'nfl_snaps_current_week' : 'nfl_snaps')
        .where({ playId, esbid })
        .del()

      // insert snaps
      for (const nflId of play.nflIds) {
        await db(isCurrentWeek ? 'nfl_snaps_current_week' : 'nfl_snaps')
          .insert({
            esbid,
            nflId,
            playId
          })
          .onConflict()
          .ignore()
      }

      // insert/update playStats
      if (play.playStats) {
        for (const playStat of play.playStats) {
          await upsertPlayStat({ playStat, esbid, playId, isCurrentWeek })
        }
      }
    }

    if (argv.all) await wait(3000)
  }

  return skip_count === games.length
}

const main = async () => {
  debug.enable('import-plays-ngs')
  let error
  try {
    if (argv.current) {
      await run({ force_update: argv.final })
    } else if (argv.all) {
      for (let year = 2002; year < constants.season.year; year++) {
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
            seas_type: 'PRE',
            force_update: argv.final
          })
        } else {
          const weeks = await db('nfl_games')
            .select('wk')
            .where({ seas: year, seas_type: 'PRE' })
            .groupBy('wk')

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
      let loop_count = 1
      while (!all_games_skipped) {
        loop_count += 1
        log(`running import count: ${loop_count}`)
        all_games_skipped = await run({
          week: argv.week,
          seas_type: argv.seas_type,
          force_update: argv.final
        })
      }
    } else {
      await run({
        week: argv.week,
        seas_type: argv.seas_type,
        force_update: argv.final
      })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.NFL_PLAYS_NGS,
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
