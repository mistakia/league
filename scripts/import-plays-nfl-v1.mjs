import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { isMain, wait, nfl } from '#libs-server'

const log = debug('import-plays-nfl-v1')
debug.enable('import-plays-nfl-v1')

const argv = yargs(hideBin(process.argv)).argv

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
    year,
    seas_type,
    week,
    next_play_type: play.nextPlayType,
    sequence: play.orderSequence,
    penalty: play.penaltyOnPlay,
    play_clock: play.playClock,
    deleted: play.playDeleted,
    review: play.playReviewStatus,
    score: play.scoringPlay,
    score_type: play.scoringPlayType,
    special_play_type: play.stPlayType,
    timestamp: play.timeOfDay ? dayjs(play.timeOfDay).format('HH:mm:ss') : null,
    ytg: play.yardsToGo,
    qtr: play.quarter,
    play_type_nfl: play.playType
  }

  if (play.possessionTeam) {
    data.pos_team = play.possessionTeam.abbreviation
      ? fixTeam(play.possessionTeam.abbreviation)
      : null
  }

  if (play.scoringTeam) {
    data.score_team = fixTeam(play.scoringTeam.abbreviation)
  }

  if (play.yardLine && data.pos_team) {
    if (play.yardLine === '50') {
      data.ydl_num = 50
      data.ydl_100 = 50
    } else {
      const ydl_parts = play.yardLine.split(' ')
      data.ydl_num = parseInt(ydl_parts[1], 10)
      data.ydl_side = fixTeam(ydl_parts[0])
      data.ydl_100 =
        data.ydl_side === data.pos_team ? 100 - data.ydl_num : data.ydl_num
    }
  }

  return data
}

const to_ascii = (hexString) => {
  let ascii = ''
  for (let i = 0; i < hexString.length; i += 2) {
    ascii += String.fromCharCode(parseInt(hexString.substring(i, i + 2), 16))
  }
  return ascii
}

const decode_id = (smart_id) => {
  const size = smart_id.length
  if (size === 36) {
    return to_ascii(smart_id.replace(/-/g, '').substring(4, 24))
  } else if (size >= 5) {
    return smart_id
  } else {
    return null
  }
}

const extract_elias = (smart_id) => {
  const decoded_id = decode_id(smart_id)
  if (!decoded_id) return null
  const name_abbr = decoded_id.substring(0, 3)
  const id_no = smart_id.replace(/-/g, '').substring(10, 16)
  const elias_id = name_abbr + id_no
  return elias_id
}

const getPlayStatData = (playStat) => ({
  yards: playStat.yards,
  teamid: playStat.team.id,
  playerName: playStat.playerName,
  clubCode: playStat.team ? fixTeam(playStat.team.abbreviation) : null,
  esbid: playStat.gsisPlayer ? extract_elias(playStat.gsisPlayer.id) : null
})

const importPlaysForWeek = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type,
  ignore_cache = false,
  force_update = false,
  token
} = {}) => {
  const current_week = Math.max(
    dayjs().day() === 2
      ? constants.season.nfl_seas_week - 1
      : constants.season.nfl_seas_week,
    1
  )

  week = week || current_week
  const isCurrentWeek =
    !force_update && year === constants.season.year && week === current_week

  log(
    `importing plays for week ${week} ${year} ${seas_type} (force_update: ${force_update}, ignore_cache: ${ignore_cache}, isCurrentWeek: ${isCurrentWeek})`
  )

  const players = await db('player')
    .select('esbid', 'gsisid')
    .whereNotNull('esbid')
    .whereNotNull('gsisid')

  log(`loaded ${players.length} players`)

  const esbid_to_gsis_id_index = {}
  for (const player of players) {
    if (player.esbid && player.gsisid) {
      esbid_to_gsis_id_index[player.esbid] = player.gsisid
    }
  }

  log(
    `built esbid_to_gsis_id_index with ${
      Object.keys(esbid_to_gsis_id_index).length
    } entries`
  )

  const games = await db('nfl_games').where({
    year,
    week,
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

    if (!game.detailid_v1) {
      log(`skipping esbid: ${game.esbid}, missing detailid_v1`)
      skip_count += 1
      continue
    }

    const currentPlays = await db('nfl_plays').where({ esbid: game.esbid })

    const haveEndPlay = currentPlays.find((p) => p.play_type_nfl === 'END_GAME')

    if (!force_update && haveEndPlay) {
      log(`skipping esbid: ${game.esbid}, already have final play`)
      skip_count += 1
      continue
    }

    if (!token) {
      token = await nfl.getToken()
    }

    if (!token) {
      throw new Error('missing access token')
    }

    log(`loading plays for esbid: ${game.esbid}`)

    const data = await nfl.get_plays_v1({
      id: game.detailid_v1,
      token,
      ignore_cache
    })

    if (!data.data) continue

    const timestamp = Math.round(new Date() / 1000)

    const play_inserts = []
    const play_stat_inserts = []

    for (const play of data.data.viewer.gameDetail.plays) {
      const { playId } = play
      const playData = getPlayData({ play, year, week, seas_type })
      play_inserts.push({
        playId,
        esbid: game.esbid,
        updated: timestamp,
        ...playData
      })

      // TODO re-enable and add `esbid` column to play_stats table
      for (const playStat of play.playStats) {
        const { esbid, playerName, clubCode, teamid, yards } =
          getPlayStatData(playStat)
        const gsisId = esbid_to_gsis_id_index[esbid] || null
        if (!gsisId) {
          log(
            `missing gsisId for esbid: ${esbid}, playerName: ${playerName}, clubCode: ${clubCode}`
          )
        }

        play_stat_inserts.push({
          playId,
          esbid: game.esbid,
          valid: 1,
          statId: playStat.statId,
          gsisId,
          playerName,
          clubCode,
          teamid,
          yards
        })
      }
    }

    const end_play_exists = data.data.viewer.gameDetail.plays.find(
      (p) => p.playType === 'END_GAME'
    )
    if (end_play_exists) {
      if (play_stat_inserts.length) {
        // reset final table playStats
        await db('nfl_play_stats')
          .update({ valid: 0 })
          .where({ esbid: game.esbid })

        // delete any excess plays
        // TODO

        // save in final tables
        await db('nfl_play_stats')
          .insert(play_stat_inserts)
          .onConflict()
          .merge()
      }

      if (play_inserts.length) {
        await db('nfl_plays').insert(play_inserts).onConflict().merge()
      }
    }

    // save in current tables
    try {
      if (play_stat_inserts.length) {
        await db('nfl_play_stats_current_week')
          .where({ esbid: game.esbid })
          .del()

        await db('nfl_play_stats_current_week')
          .insert(play_stat_inserts)
          .onConflict()
          .merge()
      }

      if (play_inserts.length) {
        await db('nfl_plays_current_week')
          .insert(play_inserts)
          .onConflict()
          .merge()
      }
    } catch (err) {
      log('Error on inserting plays and play stats ignored')
      log(err)
    }
  }

  return skip_count === games.length
}

const importPlaysForYear = async ({
  year = constants.season.year,
  seas_type = 'REG',
  force_update = false,
  ignore_cache = false,
  token
} = {}) => {
  const weeks = await db('nfl_games')
    .select('week')
    .where({ year, seas_type })
    .groupBy('week')
    .orderBy('week', 'asc')

  if (!token) {
    token = await nfl.getToken()
  }

  log(`processing plays for ${weeks.length} weeks in ${year} (${seas_type})`)
  for (const { week } of weeks) {
    log(`loading plays for week: ${week} (REG)`)
    await importPlaysForWeek({
      year,
      week,
      seas_type,
      force_update,
      ignore_cache,
      token
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
    const token = await nfl.getToken()
    log(`loading plays for year: ${year}, seas_type: ${seas_type}`)
    const is_seas_type_all = seas_type.toLowerCase() === 'all'

    if (is_seas_type_all || seas_type.toLowerCase() === 'pre') {
      await importPlaysForYear({
        year,
        seas_type: 'PRE',
        force_update,
        ignore_cache,
        token
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'reg') {
      await importPlaysForYear({
        year,
        seas_type: 'REG',
        force_update,
        ignore_cache,
        token
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'post') {
      await importPlaysForYear({
        year,
        seas_type: 'POST',
        force_update,
        ignore_cache,
        token
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
        ignore_cache: argv.ignore_cache,
        force_update: argv.final
      })
    } else if (argv.year) {
      if (argv.week) {
        await importPlaysForWeek({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache,
          force_update: argv.final
        })
      } else {
        await importPlaysForYear({
          year: argv.year,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache,
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
          ignore_cache: true,
          force_update: argv.final
        })
      }
    } else {
      log('start')
      await importPlaysForWeek({
        week: argv.week,
        seas_type: argv.seas_type,
        ignore_cache: true,
        force_update: argv.final
      })
      log('end')
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

  await db.destroy()

  // process.exit() is not working
  process.kill(process.pid)
}

if (isMain(import.meta.url)) {
  main()
}

export default importPlaysForWeek
