import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain, getPlayer, updatePlayer } from '#utils'
import db from '#db'
import {
  constants,
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays,
  getPlayFromPlayStats
} from '#common'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process:play-stats')
debug.enable('process:play-stats,update-player,get-player')
const current_week = Math.max(
  dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
  1
)

// TODO - add KNEE, SPKE
const getPlayType = (type_ngs) => {
  switch (type_ngs) {
    case 'play_type_field_goal':
      return 'FGXP'

    case 'play_type_kickoff':
      return 'KOFF'

    case 'play_type_pass':
      return 'PASS'

    case 'play_type_punt':
      return 'PUNT'

    case 'play_type_rush':
      return 'RUSH'

    case 'play_type_sack':
      return 'PASS'

    case 'play_type_two_point_conversion':
      return 'CONV'

    // penalty or timeout
    case 'play_type_unknown':
      return 'NOPL'

    case 'play_type_xp':
      return 'FGXP'

    default:
      return null
  }
}

const upsert = async ({ pid, stats, opp, pos, tm, week, year }) => {
  const cleanedStats = Object.keys(stats)
    .filter((key) => constants.fantasyStats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  await db('gamelogs')
    .insert({
      tm,
      pid,
      pos,
      opp,
      week,
      year,
      ...cleanedStats
    })
    .onConflict()
    .merge()
}

const run = async ({
  week = current_week,
  year = constants.season.year
} = {}) => {
  if (week > constants.season.nflFinalWeek) {
    return
  }

  const playStats = await db('nfl_play_stats')
    .select(
      'nfl_play_stats.*',
      'nfl_plays.drive_play_count',
      'nfl_plays.type_ngs',
      'nfl_plays.type_nfl',
      'nfl_plays.pos_team',
      'nfl_games.h',
      'nfl_games.v'
    )
    .join('nfl_games', 'nfl_play_stats.esbid', '=', 'nfl_games.esbid')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_play_stats.esbid')
      this.andOn('nfl_plays.playId', '=', 'nfl_play_stats.playId')
    })
    .where('nfl_plays.seas', year)
    .where('nfl_plays.wk', week)
    .where('nfl_play_stats.valid', 1)

  const missing = []

  const play_stats_by_gsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(play_stats_by_gsispid)
  const player_gsispid_rows = await db('player').whereIn('gsispid', gsispids)

  // Update players with missing gsispids
  const existing_gsispids = player_gsispid_rows.map((p) => p.gsispid)
  const missing_gsispids = gsispids.filter(
    (p) => !existing_gsispids.includes(p)
  )
  for (const gsispid of missing_gsispids) {
    const playStat = play_stats_by_gsispid[gsispid].find(
      (p) => p.clubCode && p.playerName
    )
    if (!playStat) continue

    const params = {
      pname: playStat.playerName,
      team: playStat.clubCode,
      gsisid: playStat.gsisId
    }

    let player_row
    try {
      player_row = await getPlayer(params)
    } catch (e) {
      // ignore
    }

    if (!player_row) {
      missing.push(params)
      continue
    }

    if (!argv.dry) {
      await updatePlayer({ player_row, update: { gsispid } })
    }
    player_row.gsispid = gsispid
    player_gsispid_rows.push(player_row)
  }

  const play_stats_by_gsisid = groupBy(playStats, 'gsisId')
  const gsisids = Object.keys(play_stats_by_gsisid)
  const players_gsisid = await db('player').whereIn('gsisid', gsisids)

  const existing_gsisids = players_gsisid.map((p) => p.gsisid)
  const missing_gsisids = gsisids.filter((p) => !existing_gsisids.includes(p))
  for (const gsisid of missing_gsisids) {
    const playStat = play_stats_by_gsisid[gsisid].find(
      (p) => p.clubCode && p.playerName
    )
    if (!playStat) continue

    // TODO - include gsispid?
    const params = {
      pname: playStat.playerName,
      team: playStat.clubCode
    }

    let player_row
    try {
      player_row = await getPlayer(params)
    } catch (e) {
      // ignore
    }

    if (!player_row) {
      missing.push(params)
      continue
    }

    if (!argv.dry) {
      await updatePlayer({ player_row, update: { gsisid } })
    }
    player_row.gsisid = gsisid
    players_gsisid.push(player_row)
  }

  // generate player gamelogs
  for (const gsispid of Object.keys(play_stats_by_gsispid)) {
    const player_row = player_gsispid_rows.find((p) => p.gsispid === gsispid)
    if (!player_row) continue
    if (!constants.positions.includes(player_row.pos)) continue

    const playStat = play_stats_by_gsispid[gsispid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)
    const stats = calculateStatsFromPlayStats(play_stats_by_gsispid[gsispid])
    if (argv.dry) continue

    await upsert({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      stats,
      year,
      week
    })
  }

  // generate defense gamelogs
  for (const team of constants.nflTeams) {
    const opponentPlays = playStats.filter((p) => {
      if (fixTeam(p.h) !== team && fixTeam(p.v) !== team) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== team) ||
        p.type_nfl === 'PUNT' ||
        p.type_nfl === 'KICK_OFF' ||
        p.type_nfl === 'XP_KICK'
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
        type_nfl: p.type_nfl,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    if (argv.dry) continue
    await upsert({
      pid: team,
      pos: 'DST',
      tm: team,
      opp: fixTeam(opp),
      stats,
      year,
      week
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.pname} / ${m.cteam}`))

  // update play row data - off, def
  const plays = await db('nfl_plays')
    .select(
      'nfl_games.h',
      'nfl_games.v',
      'nfl_plays.esbid',
      'nfl_plays.playId',
      'nfl_plays.type_ngs',
      'nfl_plays.pos_team'
    )
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')
    .where('nfl_plays.seas', year)
    .where('nfl_plays.wk', week)
  for (const play of plays) {
    const off = play.pos_team
    if (!off) continue
    const def = off === play.h ? play.v : play.h
    const type = getPlayType(play.type_ngs)

    const { esbid, playId } = play
    await db('nfl_plays')
      .update({
        off,
        def,
        type
      })
      .where({
        esbid,
        playId
      })
  }

  // update play row data
  const playStatsByEsbid = groupBy(playStats, 'esbid')
  const play_rows = []
  for (const [esbid, playStats] of Object.entries(playStatsByEsbid)) {
    const playStatsByPlay = groupBy(playStats, 'playId')
    for (const [playId, playStats] of Object.entries(playStatsByPlay)) {
      // ignore plays with no pos_team, likely a timeout or two minute warning
      const playStat = playStats.find((p) => p.pos_team)
      if (!playStat) continue

      const play_row = getPlayFromPlayStats({ playStats })
      if (Object.keys(play_row).length === 0) continue
      play_rows.push(play_row)

      // TODO - succ

      if (play_row.player_fuml_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === play_row.player_fuml_gsis
        )
        if (player) {
          play_row.player_fuml = player.pid
        }
      }

      if (play_row.bc_gsis) {
        const player = players_gsisid.find((p) => p.gsisid === play_row.bc_gsis)
        if (player) {
          play_row.bc = player.pid
        }
      }

      if (play_row.psr_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === play_row.psr_gsis
        )
        if (player) {
          play_row.psr = player.pid
        }
      }

      if (play_row.trg_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === play_row.trg_gsis
        )
        if (player) {
          play_row.trg = player.pid
        }
      }

      if (play_row.intp_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === play_row.intp_gsis
        )
        if (player) {
          play_row.intp = player.pid
        }
      }

      await db('nfl_plays').update(play_row).where({
        esbid,
        playId
      })
    }
  }
  log(`Updated ${play_rows.length} plays`)
}

const main = async () => {
  let error
  try {
    await run({ year: argv.year, week: argv.week })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_PLAY_STATS,
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
