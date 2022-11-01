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
const log = debug('import-plays-ngs')

const getPlayData = (play) => {
  const data = {
    sequence: play.sequence,
    state: play.playState,
    dwn: play.down,
    home_score: play.homeScore,
    special: play.isSTPlay,
    score: play.isScoring,
    desc: play.playDescription,
    type_ngs: play.playType,
    pos_team_id: play.possessionTeamId,
    qtr: play.quarter,
    year: play.season,
    // seas_type: play.seasonType,
    away_score: play.visitorScore,
    week: play.week,
    ydl_num: play.yardlineNumber,
    ytg: play.yardsToGo,
    off_formation: play.offense ? play.offense.offenseFormation : null,
    off_personnel: play.offense ? play.offense.personnel : null,
    box_ngs: play.defense ? play.defense.defendersInTheBox : null,
    pru_ngs: play.defense ? play.defense.numberOfPassRushers : null,
    def_personnel: play.defense ? play.defense.personnel : null
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
  week,
  seas_type = 'REG',
  force_update = false
} = {}) => {
  const current_week = Math.max(
    dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
    1
  )

  week = week || current_week
  const isCurrentWeek =
    !force_update && year === constants.season.year && week === current_week

  log(
    `importing plays for week ${week} ${year} ${seas_type} (force_update: ${force_update}, isCurrentWeek: ${isCurrentWeek}`
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

    log(`loading plays for esbid: ${esbid}`)
    const url = `${config.ngs_api_url}/live/plays/playlist/game?gameId=${esbid}`
    const data = await fetch(url, {
      headers: {
        origin: 'https://nextgenstats.nfl.com',
        referer: 'https://nextgenstats.nfl.com/stats/game-center'
      }
    }).then((res) => res.json())

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
        for (const nflId of play.nflIds) {
          snap_inserts.push({
            esbid,
            nflId,
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

      await db('nfl_snaps').where({ esbid }).del()
      await db('nfl_snaps').insert(snap_inserts).onConflict().merge()

      await db('nfl_play_stats').insert(play_stat_inserts).onConflict().merge()
      await db('nfl_plays').insert(play_inserts).onConflict().merge()
    }

    await db('nfl_snaps_current_week').where({ esbid }).del()
    await db('nfl_snaps_current_week').insert(snap_inserts).onConflict().merge()

    // save in current tables
    await db('nfl_play_stats_current_week')
      .insert(play_stat_inserts)
      .onConflict()
      .merge()
    await db('nfl_plays_current_week').insert(play_inserts).onConflict().merge()
  }

  return skip_count === games.length
}

const importPlaysForYear = async ({
  year = constants.season.year,
  seas_type = 'REG',
  force_update = false
} = {}) => {
  const weeks = await db('nfl_games')
    .select('week')
    .where({ year, seas_type })
    .groupBy('week')
    .orderBy('week', 'asc')

  log(`processing plays for ${weeks.length} weeks in ${year} (${seas_type})`)
  for (const { week } of weeks) {
    log(`loading plays for week: ${week} (REG)`)
    await importPlaysForWeek({
      year,
      week,
      seas_type,
      force_update
    })
    await wait(4000)
  }
}

const importAllPlays = async ({ start, end, seas_type, force_update } = {}) => {
  const nfl_games_result = await db('nfl_games')
    .select('year')
    .groupBy('year')
    .orderBy('year', 'asc')

  let years = nfl_games_result.map((i) => i.year)
  if (start) {
    years = years.filter((year) => year >= start)
  }

  for (const year of years) {
    log(`loading plays for year: ${year}, seas_type: ${seas_type || 'all'}`)

    if (seas_type || seas_type.toLowerCase() === 'pre') {
      await importPlaysForYear({ year, seas_type: 'PRE', force_update })
      await wait(3000)
    }

    if (seas_type || seas_type.toLowerCase() === 'reg') {
      await importPlaysForYear({ year, seas_type: 'REG', force_update })
      await wait(3000)
    }

    if (seas_type || seas_type.toLowerCase() === 'post') {
      await importPlaysForYear({ year, seas_type: 'POST', force_update })
      await wait(3000)
    }
  }
}

const main = async () => {
  debug.enable('import-plays-ngs')
  let error
  try {
    if (argv.all) {
      await importAllPlays({
        start: argv.start,
        end: argv.end,
        seas_type: argv.seas_type,
        force_update: argv.final
      })
    } else if (argv.year) {
      if (argv.week) {
        await importPlaysForWeek({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type,
          force_update: argv.final
        })
      } else {
        await importPlaysForYear({
          year: argv.year,
          seas_type: argv.seas_type,
          force_update: argv.final
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
          bypass_cache: true,
          force_update: argv.final
        })
      }
    } else {
      log('start')
      await importPlaysForWeek({
        week: argv.week,
        seas_type: argv.seas_type,
        bypass_cache: true,
        force_update: argv.final
      })
      log('end')
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

export default importPlaysForWeek
