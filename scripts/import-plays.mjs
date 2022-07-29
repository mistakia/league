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

const log = debug('import:plays:ngs')

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
  seas_type: play.seasonType,
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

const run = async ({
  year = constants.season.year,
  week = currentRegularSeasonWeek,
  type = 'REG'
} = {}) => {
  // get list of games for this week
  const games = await db('nfl_games').where({
    seas: year,
    wk: week,
    type
  })

  for (const game of games) {
    const { esbid } = game
    const timeStr = `${game.date} ${game.time_est}`
    const gameStart = dayjs.tz(
      timeStr,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    if (dayjs().isBefore(gameStart)) continue

    const currentPlays = await db('nfl_plays').where({ esbid })

    const haveEndPlay = currentPlays.find(
      (p) => p.desc === 'END GAME' && p.state === 'APPROVED'
    )

    if (!argv.final && haveEndPlay) continue

    const url = `${config.ngs_api_url}/live/plays/playlist/game?gameId=${esbid}`
    log(url)
    const data = await fetch(url, {
      headers: {
        origin: 'https://nextgenstats.nfl.com',
        referer: 'https://nextgenstats.nfl.com/stats/game-center'
      }
    }).then((res) => res.json())

    if (!data || !data.plays) continue

    // reset playStats
    await db('nfl_play_stats').update({ valid: 0 }).where({ esbid })

    const timestamp = Math.round(Date.now() / 1000)
    for (const play of data.plays) {
      const { playId } = play
      const currentPlay = currentPlays.find((p) => p.playId === play.playId)

      const playData = getPlayData(play)

      if (currentPlay) {
        // TODO only update changes
        await db('nfl_plays')
          .update({
            ...playData,
            updated: timestamp
          })
          .where({ playId, esbid })
      } else {
        await db('nfl_plays').insert({
          playId,
          esbid,
          updated: timestamp,
          ...playData
        })
      }

      await db('nflSnap').where({ playId, esbid }).del()

      // insert snaps
      for (const nflId of play.nflIds) {
        await db('nflSnap')
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
          await upsertPlayStat({ playStat, esbid, playId })
        }
      }
    }

    if (argv.all) await wait(3000)
  }
}

const main = async () => {
  debug.enable('import:games:nfl:ngs')
  let error
  try {
    if (argv.current) {
      await run()
    } else if (argv.all) {
      for (let year = 2002; year < constants.season.year; year++) {
        log(`loading plays for ${year}`)

        for (let week = 0; week <= 4; week++) {
          await run({ year, week, type: 'PRE' })
          await wait(4000)
        }

        for (let week = 1; week <= 18; week++) {
          await run({ year, week, type: 'REG' })
          await wait(4000)
        }

        for (let week = 18; week <= 22; week++) {
          await run({ year, week, type: 'POST' })
          await wait(4000)
        }
      }
    } else if (argv.year) {
      const year = argv.year
      log(`loading plays for ${year}`)

      for (let week = 0; week <= 4; week++) {
        await run({ year, week, type: 'PRE' })
        await wait(4000)
      }

      for (let week = 1; week <= 18; week++) {
        await run({ year, week, type: 'REG' })
        await wait(4000)
      }

      for (let week = 18; week <= 22; week++) {
        await run({ year, week, type: 'POST' })
        await wait(4000)
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
