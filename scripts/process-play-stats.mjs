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
import processGamelogs from './process-gamelogs.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-play-stats')
debug.enable('process-play-stats,update-player,get-player,process-gamelogs')
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
    ...cleanedStats
  }
}

const run = async ({
  week = current_week,
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  let play_update_count = 0

  const playStats = await db('nfl_play_stats')
    .select(
      'nfl_play_stats.*',
      'nfl_plays.drive_play_count',
      'nfl_plays.type_ngs',
      'nfl_plays.type_nfl',
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
    .where('nfl_play_stats.valid', 1)
    .where('nfl_plays.seas_type', seas_type)

  const player_gamelog_inserts = []
  const missing = []

  const play_stats_by_gsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(play_stats_by_gsispid)
  const player_gsispid_rows = await db('player').whereIn('gsispid', gsispids)

  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsispid).length} players`
  )

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
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)

  const existing_gsisids = player_gsisid_rows.map((p) => p.gsisid)
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
    player_gsisid_rows.push(player_row)
  }

  // track generated gamelogs by gsispids
  const gamelog_gsispids = []

  // generate player gamelogs
  for (const gsispid of Object.keys(play_stats_by_gsispid)) {
    if (gsispid === 'null') continue

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
    if (!player_row) continue
    if (!constants.positions.includes(player_row.pos)) continue

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
  missing.forEach((m) => log(`could not find player: ${m.pname} / ${m.cteam}`))

  if (player_gamelog_inserts.length) {
    const pids = player_gamelog_inserts.map((p) => p.pid)
    const deleted_count = await db('player_gamelogs')
      .leftJoin('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', seas_type)
      .whereNotIn('player_gamelogs.pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess gamelogs`)

    log(`Updated ${player_gamelog_inserts.length} gamelogs`)
    await db('player_gamelogs')
      .insert(player_gamelog_inserts)
      .onConflict()
      .merge()
  }

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
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
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
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.player_fuml_gsis
        )
        if (player) {
          play_row.player_fuml = player.pid
        }
      }

      if (play_row.bc_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.bc_gsis
        )
        if (player) {
          play_row.bc = player.pid
        }
      }

      if (play_row.psr_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.psr_gsis
        )
        if (player) {
          play_row.psr = player.pid
        }
      }

      if (play_row.trg_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.trg_gsis
        )
        if (player) {
          play_row.trg = player.pid
        }
      }

      if (play_row.intp_gsis) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_row.intp_gsis
        )
        if (player) {
          play_row.intp = player.pid
        }
      }

      if (argv.dry) continue

      play_update_count += 1
      await db('nfl_plays').update(play_row).where({
        esbid,
        playId
      })
    }
  }
  log(`Updated ${play_update_count} plays`)

  // TODO — process for all leagues
  await processGamelogs({ year, week, lid: 1 })
}

const main = async () => {
  let error
  try {
    const year = argv.year
    const week = argv.week
    const seas_type = argv.seas_type || 'REG'

    if (argv.all) {
      log('processing all plays')
      const results = await db('nfl_plays')
        .select('year')
        .groupBy('year')
        .orderBy('year', 'asc')

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
