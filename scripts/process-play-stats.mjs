import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain, update_play, batch_insert, report_job } from '#libs-server'
import db from '#db'
import {
  constants,
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays,
  getPlayFromPlayStats
} from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-play-stats')
debug.enable('process-play-stats,update-play')
const current_week = Math.max(
  dayjs().day() === 2
    ? constants.season.nfl_seas_week - 1
    : constants.season.nfl_seas_week,
  1
)

const is_successful_play = ({ yds_gained, yards_to_go, dwn }) => {
  if (!dwn || !yards_to_go || !yds_gained) return null

  if (dwn === 1) {
    return yds_gained >= 0.4 * yards_to_go
  } else if (dwn === 2) {
    return yds_gained >= 0.6 * yards_to_go
  } else if (dwn === 3 || dwn === 4) {
    return yds_gained >= yards_to_go
  }

  return null
}

// TODO - add KNEE, SPKE
const get_play_type_ngs = (play_type_ngs) => {
  switch (play_type_ngs) {
    case 'play_type_field_goal':
    case 'play_type_xp':
      return 'FGXP'

    case 'play_type_kickoff':
      return 'KOFF'

    case 'play_type_pass':
    case 'play_type_sack':
      return 'PASS'

    case 'play_type_punt':
      return 'PUNT'

    case 'play_type_rush':
      return 'RUSH'

    case 'play_type_two_point_conversion':
      return 'CONV'

    // penalty or timeout
    case 'play_type_unknown':
      return 'NOPL'

    default:
      return null
  }
}

const get_play_type_nfl = (play_type_nfl) => {
  switch (play_type_nfl) {
    case 'FIELD_GOAL':
    case 'XP_KICK':
      return 'FGXP'

    case 'KICK_OFF':
      return 'KOFF'

    case 'PASS':
    case 'SACK':
    case 'INTERCEPTION':
      return 'PASS'

    case 'PUNT':
      return 'PUNT'

    case 'RUSH':
      return 'RUSH'

    case 'PAT2':
      return 'CONV'

    case 'FREE_KICK':
      return 'FREE'

    case 'TIMEOUT':
    case 'UNSPECFIED':
    case 'PENALTY':
    case 'COMMENT':
    case 'GAME_START':
    case 'END_GAME':
    case 'END_QUARTER':
      return 'NOPL'

    default:
      return null
  }
}

const format_gamelog = ({ esbid, pid, stats, opp, pos, tm }) => {
  const cleanedStats = Object.keys(stats)
    .filter((key) => constants.fantasyStats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  return {
    esbid,
    tm,
    pid,
    pos,
    opp,
    active: true,
    ...cleanedStats
  }
}

const run = async ({
  week = current_week,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  ignore_conflicts = false
} = {}) => {
  let play_update_count = 0
  let play_field_update_count = 0

  const playStats = await db('nfl_play_stats')
    .select(
      'nfl_play_stats.*',
      'nfl_plays.drive_play_count',
      'nfl_plays.play_type_ngs',
      'nfl_plays.play_type_nfl',
      'nfl_plays.pos_team',
      'nfl_games.h',
      'nfl_games.v',
      'nfl_games.esbid'
    )
    .join('nfl_games', 'nfl_play_stats.esbid', '=', 'nfl_games.esbid')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_play_stats.esbid')
      this.andOn('nfl_plays.playId', '=', 'nfl_play_stats.playId')
    })
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_play_stats.valid', true)
    .where('nfl_plays.seas_type', seas_type)

  const unique_esbids = [...new Set(playStats.map((p) => p.esbid))]
  log(`loaded play stats for ${unique_esbids.length} games`)
  log(unique_esbids.join(', '))

  const player_gamelog_inserts = []
  const missing = []

  const play_stats_by_gsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(play_stats_by_gsispid)
  const player_gsispid_rows = await db('player').whereIn('gsispid', gsispids)

  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsispid).length} gsispid players`
  )

  const play_stats_by_gsisid = groupBy(playStats, 'gsisId')
  const gsisids = Object.keys(play_stats_by_gsisid)
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)

  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsisid).length} gsisid players`
  )

  // track generated gamelogs by gsispids
  const gamelog_gsispids = []

  // generate player gamelogs
  for (const gsispid of Object.keys(play_stats_by_gsispid)) {
    if (gsispid === 'null') continue

    const player_row = player_gsispid_rows.find((p) => p.gsispid === gsispid)
    if (!player_row) {
      log(`missing player for gsispid: ${gsispid}`)
      continue
    }

    const playStat = play_stats_by_gsispid[gsispid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)
    const stats = calculateStatsFromPlayStats(play_stats_by_gsispid[gsispid])
    if (argv.dry) continue

    gamelog_gsispids.push(gsispid)
    const player_gamelog = format_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }

  for (const gsisid of Object.keys(play_stats_by_gsisid)) {
    if (gsisid === 'null') continue

    const player_row = player_gsisid_rows.find((p) => p.gsisid === gsisid)
    if (!player_row) {
      log(`missing player for gsisid: ${gsisid}`)
      continue
    }

    // check to see if gamelog was already generated using gsispid
    if (player_row.gsispid && gamelog_gsispids.includes(player_row.gsispid))
      continue

    const playStat = play_stats_by_gsisid[gsisid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)

    const stats = calculateStatsFromPlayStats(play_stats_by_gsisid[gsisid])
    if (argv.dry) continue

    const player_gamelog = format_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }

  // generate defense gamelogs
  for (const team of constants.nflTeams) {
    const opponentPlays = playStats.filter((p) => {
      if (fixTeam(p.h) !== team && fixTeam(p.v) !== team) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== team) ||
        p.play_type_nfl === 'PUNT' ||
        p.play_type_nfl === 'KICK_OFF' ||
        p.play_type_nfl === 'XP_KICK'
      )
    })
    if (!opponentPlays.length) continue
    const play = opponentPlays[0]
    const opp = fixTeam(play.h) === team ? play.v : play.h
    const groupedPlays = groupBy(opponentPlays, 'playId')
    const formattedPlays = []
    for (const playId in groupedPlays) {
      const playStats = groupedPlays[playId]
      const p = playStats[0]
      formattedPlays.push({
        pos_team: p.pos_team,
        drive_play_count: p.drive_play_count,
        play_type_nfl: p.play_type_nfl,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    if (argv.dry) continue
    const player_gamelog = format_gamelog({
      pid: team,
      pos: 'DST',
      tm: team,
      esbid: play.esbid,
      opp: fixTeam(opp),
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.pname} / ${m.current_nfl_team}`)
  )

  if (player_gamelog_inserts.length) {
    await batch_insert({
      items: player_gamelog_inserts,
      save: (items) =>
        db('player_gamelogs')
          .insert(items)
          .onConflict(['esbid', 'pid'])
          .merge(),
      batch_size: 500
    })
    log(`Updated ${player_gamelog_inserts.length} gamelogs`)
  }

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
      'nfl_plays.succ'
    )
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_plays.seas_type', seas_type)
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

    const succ = is_successful_play(play)

    await update_play({
      play_row: {
        off: play.off,
        def: play.def,
        play_type: play.play_type,
        esbid: play.esbid,
        playId: play.playId,
        succ: play.succ
      },
      update: {
        off,
        def,
        play_type,
        succ
      },
      ignore_conflicts
    })
  }

  log('Updating play row pid columns')
  const playStatsByEsbid = groupBy(playStats, 'esbid')
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

      if (argv.dry) continue

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
    `Updated ${play_field_update_count} play fields on ${play_update_count} plays`
  )
}

const main = async () => {
  let error
  try {
    const year = argv.year
    const week = argv.week
    const seas_type = argv.seas_type || constants.season.nfl_seas_type

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
            await run({ year, week, seas_type })
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
        await run({ year, week, seas_type })
      }
    } else {
      await run({ year: argv.year, week: argv.week, seas_type: argv.seas_type })
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

if (isMain(import.meta.url)) {
  main()
}

export default run
