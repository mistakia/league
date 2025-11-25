import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { is_main, wait, nfl, report_job, clean_string } from '#libs-server'
import player_cache, {
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { enrich_plays } from '#libs-server/play-enrichment/index.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  standardize_score_type,
  normalize_game_clock,
  normalize_yardline
} from '#libs-server/play-enum-utils.mjs'

const log = debug('import-plays-nfl-v1')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

/**
 * Parse clock time string and calculate time-related fields
 * @param {string} clockTime - Clock time in format "MM:SS" or "M:SS"
 * @param {number} quarter - Quarter number (1-4 for regulation, 5+ for OT)
 * @returns {Object} Time-related fields: sec_rem_qtr, sec_rem_half, sec_rem_gm
 */
const parse_clock_time = (clockTime, quarter) => {
  const time_fields = {
    sec_rem_qtr: null,
    sec_rem_half: null,
    sec_rem_gm: null
  }

  if (!clockTime || !quarter) {
    return time_fields
  }

  // Parse MM:SS format
  const parts = clockTime.split(':')
  if (parts.length !== 2) {
    return time_fields
  }

  const minutes = parseInt(parts[0], 10)
  const seconds = parseInt(parts[1], 10)

  if (isNaN(minutes) || isNaN(seconds)) {
    return time_fields
  }

  // Calculate seconds remaining in quarter
  time_fields.sec_rem_qtr = minutes * 60 + seconds

  // Calculate seconds remaining in half and game
  // Quarter 1-2: First half (each quarter is 900 seconds)
  // Quarter 3-4: Second half
  // Quarter 5+: Overtime (10 minutes = 600 seconds per OT period)

  if (quarter === 1) {
    // First quarter: add Q2 time (900) to current quarter time
    time_fields.sec_rem_half = time_fields.sec_rem_qtr + 900
    // First half: add entire second half (1800) + current half time
    time_fields.sec_rem_gm = time_fields.sec_rem_half + 1800
  } else if (quarter === 2) {
    // Second quarter: just current quarter time left in half
    time_fields.sec_rem_half = time_fields.sec_rem_qtr
    // Add entire second half (1800) to current half time
    time_fields.sec_rem_gm = time_fields.sec_rem_half + 1800
  } else if (quarter === 3) {
    // Third quarter: add Q4 time (900) to current quarter time
    time_fields.sec_rem_half = time_fields.sec_rem_qtr + 900
    // Second half: just current half time left
    time_fields.sec_rem_gm = time_fields.sec_rem_half
  } else if (quarter === 4) {
    // Fourth quarter: just current quarter time left
    time_fields.sec_rem_half = time_fields.sec_rem_qtr
    time_fields.sec_rem_gm = time_fields.sec_rem_qtr
  } else {
    // Overtime: just quarter time, half and game same as quarter
    time_fields.sec_rem_half = time_fields.sec_rem_qtr
    time_fields.sec_rem_gm = time_fields.sec_rem_qtr
  }

  return time_fields
}

const getPlayData = ({ play, year, week, seas_type, game }) => {
  const play_type_nfl = clean_string(play.playType)

  // Parse clock time and calculate time-related fields
  let time_fields = parse_clock_time(play.clockTime, play.quarter)

  // Special handling for game state events that may have null/invalid clock times
  // GAME_START should have full quarter time (900 seconds)
  // END_QUARTER should have 0 seconds remaining
  // END_GAME should have 0 seconds remaining in regulation (Q4) but preserve actual time in overtime
  if (play_type_nfl === 'GAME_START' && play.quarter === 1) {
    time_fields = {
      sec_rem_qtr: 900,
      sec_rem_half: 1800, // 900 + 900 (Q1 + Q2)
      sec_rem_gm: 3600 // Full game time
    }
  } else if (play_type_nfl === 'END_QUARTER') {
    time_fields = {
      sec_rem_qtr: 0,
      sec_rem_half: play.quarter === 2 ? 0 : time_fields.sec_rem_half,
      sec_rem_gm: time_fields.sec_rem_gm
    }
  } else if (play_type_nfl === 'END_GAME') {
    // In regulation (Q1-4), END_GAME is at 00:00
    // In overtime (Q5+), END_GAME occurs at the actual time the game ended
    // Preserve the parsed time for overtime, use 0 for regulation
    const is_overtime = play.quarter >= 5
    time_fields = {
      sec_rem_qtr: is_overtime ? time_fields.sec_rem_qtr : 0,
      sec_rem_half:
        play.quarter === 2 || play.quarter === 4 ? 0 : time_fields.sec_rem_half,
      sec_rem_gm: 0 // Always 0 for END_GAME
    }
  }

  const data = {
    desc: clean_string(play.playDescription),
    // Normalize down to null for special teams plays (0 should be null)
    dwn: play.down === 0 ? null : play.down,
    // NOTE: drive_play_count is calculated by the play enrichment pipeline, not imported from NFL API
    // The NFL API's drivePlayCount is unreliable (live-updating, often inaccurate)
    game_clock_start: normalize_game_clock(play.clockTime),
    // Clock-based time fields calculated from game_clock_start
    // These are the source of truth for time matching across data sources
    sec_rem_qtr: time_fields.sec_rem_qtr,
    sec_rem_half: time_fields.sec_rem_half,
    sec_rem_gm: time_fields.sec_rem_gm,
    // TODO this might not match the drive sequence number in nflfastr
    drive_seq: play.driveSequenceNumber,
    drive_yds: play.driveNetYards,
    ydl_end: normalize_yardline(clean_string(play.endYardLine)),
    ydl_start: clean_string(play.yardLine),
    first_down: play.firstDown,
    goal_to_go: play.goalToGo,
    year,
    seas_type,
    week,
    next_play_type: clean_string(play.nextPlayType),
    sequence: play.orderSequence,
    penalty: play.penaltyOnPlay,
    play_clock: play.playClock,
    deleted: play.playDeleted,
    review: clean_string(play.playReviewStatus),
    score: play.scoringPlay,
    score_type: standardize_score_type(play.scoringPlayType),
    special_play_type: clean_string(play.stPlayType),
    timestamp: play.timeOfDay ? dayjs(play.timeOfDay).format('HH:mm:ss') : null,
    // Normalize yards_to_go to null for special teams plays (0 should be null)
    yards_to_go: play.yardsToGo === 0 ? null : play.yardsToGo,
    qtr: play.quarter,
    play_type_nfl
  }

  if (play.possessionTeam) {
    const abbr = clean_string(play.possessionTeam.abbreviation)
    let pos_team = abbr ? fixTeam(abbr) : null

    // NFL v1 API uses receiving team for kickoffs, but database convention
    // uses kicking team. Swap to kicking team by using opposite team.
    if (play_type_nfl === 'KICK_OFF' && pos_team && game) {
      pos_team = pos_team === game.h ? game.v : game.h
    }

    data.pos_team = pos_team
  }

  if (play.scoringTeam) {
    const abbr = clean_string(play.scoringTeam.abbreviation)
    data.score_team = fixTeam(abbr)
  }

  if (play.yardLine && data.pos_team) {
    const cleaned_yard_line = clean_string(play.yardLine)
    if (cleaned_yard_line === '50') {
      data.ydl_num = 50
      data.ydl_100 = 50
      data.ydl_side = null
      data.ydl_start = '50'
    } else {
      const ydl_parts = cleaned_yard_line.split(' ')
      data.ydl_num = parseInt(ydl_parts[1], 10)
      data.ydl_side = fixTeam(clean_string(ydl_parts[0]))
      data.ydl_100 =
        data.ydl_side === data.pos_team ? 100 - data.ydl_num : data.ydl_num
      // Normalize yardline format (handles team abbreviation normalization)
      data.ydl_start = normalize_yardline(`${data.ydl_side} ${data.ydl_num}`)
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
  playerName: clean_string(playStat.playerName), // Clean the player name here to remove null bytes
  clubCode: playStat.team
    ? fixTeam(clean_string(playStat.team.abbreviation))
    : null,
  esbid: playStat.gsisPlayer ? extract_elias(playStat.gsisPlayer.id) : null
})

const importPlaysForWeek = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type,
  ignore_cache = false,
  force_update = false,
  token,
  dry_run = false
} = {}) => {
  week = week || constants.season.last_week_with_stats
  const is_current_week =
    !force_update &&
    year === constants.season.year &&
    week === constants.season.last_week_with_stats

  log(
    `importing plays for week ${week} ${year} ${seas_type} (force_update: ${force_update}, ignore_cache: ${ignore_cache}, is_current_week: ${is_current_week}, dry_run: ${dry_run})`
  )

  // Preload player cache once per week import
  await preload_active_players()

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

  const missing_esbids = new Set()

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
      token = await nfl.get_session_token_v3()
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
    let play_stat_inserts = []

    for (const play of data.data.viewer.gameDetail.plays) {
      const { playId } = play
      const playData = getPlayData({ play, year, week, seas_type, game })

      // Extract timeout team from playStats for TIMEOUT plays
      // Team timeouts have a playStat entry with statId 68 and team attribution
      // Official/TV timeouts have empty playStats array
      if (
        play.playType === 'TIMEOUT' &&
        play.playStats &&
        play.playStats.length > 0
      ) {
        const timeoutStat = play.playStats.find((stat) => stat.statId === 68)
        if (timeoutStat && timeoutStat.team) {
          playData.to_team = fixTeam(
            clean_string(timeoutStat.team.abbreviation)
          )
        }
      }

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
        if (esbid && !gsisId) {
          missing_esbids.add(JSON.stringify({ esbid, playerName, clubCode }))
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

    // Check for duplicate items in play_stat_inserts
    const play_stat_inserts_map = new Map()

    for (const play_stat of play_stat_inserts) {
      const key = `${play_stat.esbid}-${play_stat.playId}-${play_stat.statId}-${play_stat.playerName}`
      play_stat_inserts_map.set(key, play_stat)
    }
    // Remove duplicates from play_stat_inserts
    play_stat_inserts = Array.from(play_stat_inserts_map.values())

    // Enrich plays before database insertion
    try {
      const games_map = { [game.esbid]: game }
      const enriched_plays = await enrich_plays({
        plays: play_inserts,
        play_stats: play_stat_inserts,
        games_map,
        player_cache
      })
      // Replace play_inserts with enriched plays
      play_inserts.length = 0
      play_inserts.push(...enriched_plays)
      log(`enriched ${enriched_plays.length} plays for esbid: ${game.esbid}`)
    } catch (error) {
      log(`error enriching plays for esbid: ${game.esbid} - ${error.message}`)
      // Continue with unenriched plays on error
    }

    if (dry_run) {
      // Helper to format play sample data
      const format_play_sample = (play) => ({
        playId: play.playId,
        desc: play.desc ? play.desc.substring(0, 60) + '...' : null,
        dwn: play.dwn,
        ytg: play.yards_to_go,
        pos_team: play.pos_team,
        play_type_nfl: play.play_type_nfl,
        off: play.off,
        def: play.def,
        play_type: play.play_type,
        qb_kneel: play.qb_kneel,
        qb_spike: play.qb_spike,
        bc_pid: play.bc_pid,
        psr_pid: play.psr_pid,
        trg_pid: play.trg_pid
      })

      // Helper to format play stat sample data
      const format_play_stat_sample = (stat) => ({
        playId: stat.playId,
        statId: stat.statId,
        playerName: stat.playerName,
        clubCode: stat.clubCode,
        gsisId: stat.gsisId,
        yards: stat.yards
      })

      // In dry mode, sample some plays and play_stats for verification
      const sample_plays = play_inserts.slice(0, 3).map(format_play_sample)
      const sample_play_stats = play_stat_inserts
        .slice(0, 5)
        .map(format_play_stat_sample)

      log(`\n=== DRY RUN - Sample data for esbid ${game.esbid} ===`)
      log(`Total plays: ${play_inserts.length}`)
      log(`Total play stats: ${play_stat_inserts.length}`)

      log('\n--- Sample Plays ---')
      sample_plays.forEach((play) => log(JSON.stringify(play, null, 2)))

      log('\n--- Sample Play Stats ---')
      sample_play_stats.forEach((stat) => log(JSON.stringify(stat, null, 2)))

      log(`=== END DRY RUN SAMPLE ===\n`)

      const end_play_exists = data.data.viewer.gameDetail.plays.find(
        (p) => p.playType === 'END_GAME'
      )
      log(`Game ${game.esbid} complete: ${!!end_play_exists}`)
      log(
        `Would insert/update ${play_inserts.length} plays and ${play_stat_inserts.length} play stats`
      )
    } else {
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
            .onConflict(['esbid', 'playId', 'statId', 'playerName'])
            .merge()
        }

        if (play_inserts.length) {
          await db('nfl_plays')
            .insert(play_inserts)
            .onConflict(['esbid', 'playId', 'year'])
            .merge()
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
            .onConflict(['esbid', 'playId', 'statId', 'playerName'])
            .merge()
        }

        if (play_inserts.length) {
          await db('nfl_plays_current_week')
            .insert(play_inserts)
            .onConflict(['esbid', 'playId'])
            .merge()
        }
      } catch (err) {
        log('Error on inserting plays and play stats ignored')
        log(err)
      }
    }
  }

  // Log unique missing ESBIDs
  for (const missing_esbid of missing_esbids) {
    const { esbid, playerName, clubCode } = JSON.parse(missing_esbid)
    log(
      `missing gsisId for esbid: ${esbid}, playerName: ${playerName}, clubCode: ${clubCode}`
    )
  }

  log(`missing_esbids: ${missing_esbids.size}`)

  return skip_count === games.length
}

const importPlaysForYear = async ({
  year = constants.season.year,
  seas_type = 'REG',
  force_update = false,
  ignore_cache = false,
  token,
  dry_run = false
} = {}) => {
  const weeks = await db('nfl_games')
    .select('week')
    .where({ year, seas_type })
    .groupBy('week')
    .orderBy('week', 'asc')

  if (!token) {
    token = await nfl.get_session_token_v3()
  }

  log(`processing plays for ${weeks.length} weeks in ${year} (${seas_type})`)
  for (const { week } of weeks) {
    log(`loading plays for week: ${week} (${seas_type})`)
    await importPlaysForWeek({
      year,
      week,
      seas_type,
      force_update,
      ignore_cache,
      token,
      dry_run
    })
    await wait(4000)
  }
}

const importAllPlays = async ({
  start,
  end,
  seas_type = 'ALL',
  force_update,
  ignore_cache = false,
  dry_run = false
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
    const token = await nfl.get_session_token_v3()
    log(`loading plays for year: ${year}, seas_type: ${seas_type}`)
    const is_seas_type_all = seas_type.toLowerCase() === 'all'

    if (is_seas_type_all || seas_type.toLowerCase() === 'pre') {
      await importPlaysForYear({
        year,
        seas_type: 'PRE',
        force_update,
        ignore_cache,
        token,
        dry_run
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'reg') {
      await importPlaysForYear({
        year,
        seas_type: 'REG',
        force_update,
        ignore_cache,
        token,
        dry_run
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'post') {
      await importPlaysForYear({
        year,
        seas_type: 'POST',
        force_update,
        ignore_cache,
        token,
        dry_run
      })
      await wait(3000)
    }
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    debug.enable('import-plays-nfl-v1,nfl,play-enum-utils')
    const dry_run = argv.dry

    if (argv.all) {
      await importAllPlays({
        start: argv.start,
        end: argv.end,
        seas_type: argv.seas_type,
        ignore_cache: argv.ignore_cache,
        force_update: argv.final,
        dry_run
      })
    } else if (argv.year) {
      if (argv.week) {
        await importPlaysForWeek({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache,
          force_update: argv.final,
          dry_run
        })
      } else {
        await importPlaysForYear({
          year: argv.year,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache,
          force_update: argv.final,
          dry_run
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
          force_update: argv.final,
          dry_run
        })
      }
    } else {
      log('start')
      await importPlaysForWeek({
        week: argv.week,
        seas_type: argv.seas_type,
        ignore_cache: true,
        force_update: argv.final,
        dry_run
      })
      log('end')
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NFL_PLAYS_NFL,
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
