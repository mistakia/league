import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain } from '#utils'
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
debug.enable('process:play-stats')
const timestamp = Math.round(Date.now() / 1000)
const week =
  argv.week ||
  Math.max(
    dayjs().day() === 2 ? constants.season.week - 1 : constants.season.week,
    1
  )
const year = argv.year || constants.season.year

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

const upsert = async ({ player, stats, opp, pos, tm }) => {
  const cleanedStats = Object.keys(stats)
    .filter((key) => constants.fantasyStats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  await db('gamelogs')
    .insert({
      tm,
      player,
      pos,
      opp,
      week,
      year,
      ...cleanedStats
    })
    .onConflict()
    .merge()
}

const run = async () => {
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

  const playStatsByGsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(playStatsByGsispid)
  const players_gsispid = await db('player').whereIn('gsispid', gsispids)

  // Update players with missing gsispids
  const playerGsispids = players_gsispid.map((p) => p.gsispid)
  const missingGsispids = gsispids.filter((p) => !playerGsispids.includes(p))
  for (const gsispid of missingGsispids) {
    const playStat = playStatsByGsispid[gsispid].find(
      (p) => p.clubCode && p.playerName
    )
    if (!playStat) continue

    const params = {
      pname: playStat.playerName,
      cteam: fixTeam(playStat.clubCode)
    }

    const results = await db('player').where(params)

    if (results.length !== 1) {
      missing.push(params)
      continue
    }

    const player = results[0]

    if (!argv.dry) {
      await db('player_changelog').insert({
        type: constants.changes.PLAYER_EDIT,
        id: player.player,
        prop: 'gsispid',
        prev: player.gsispid,
        new: gsispid,
        timestamp
      })

      await db('player').update({ gsispid }).where({ player: player.player })
    }
    player.gsispid = gsispid
    players_gsispid.push(player)
  }

  // Update players with missing gsisids
  const playStatsByGsisid = groupBy(playStats, 'gsisId')
  const gsisids = Object.keys(playStatsByGsisid)
  const players_gsisid = await db('player').whereIn('gsisid', gsisids)

  const playerGsisids = players_gsisid.map((p) => p.gsisid)
  const missingGsisids = gsisids.filter((p) => !playerGsisids.includes(p))
  for (const gsisid of missingGsisids) {
    const playStat = playStatsByGsisid[gsisid].find(
      (p) => p.clubCode && p.playerName
    )
    if (!playStat) continue

    const params = {
      pname: playStat.playerName,
      cteam: fixTeam(playStat.clubCode)
    }

    const results = await db('player').where(params)

    if (results.length !== 1) {
      missing.push(params)
      continue
    }

    const player = results[0]

    if (!argv.dry) {
      await db('player_changelog').insert({
        type: constants.changes.PLAYER_EDIT,
        id: player.player,
        prop: 'gsisid',
        prev: player.gsisid,
        new: gsisid,
        timestamp
      })

      await db('player').update({ gsisid }).where({ player: player.player })
    }
    player.gsisid = gsisid
    players_gsisid.push(player)
  }

  // generate player gamelogs
  for (const gsispid of Object.keys(playStatsByGsispid)) {
    const player = players_gsispid.find((p) => p.gsispid === gsispid)
    if (!player) continue
    if (!constants.positions.includes(player.pos)) continue

    const playStat = playStatsByGsispid[gsispid].find((p) => p.clubCode)
    if (!playStat) continue
    const opp =
      fixTeam(playStat.clubCode) === fixTeam(playStat.h)
        ? fixTeam(playStat.v)
        : fixTeam(playStat.h)
    const stats = calculateStatsFromPlayStats(playStatsByGsispid[gsispid])
    if (argv.dry) continue

    await upsert({
      player: player.player,
      pos: player.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      stats
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
      player: team,
      pos: 'DST',
      tm: team,
      opp: fixTeam(opp),
      stats
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
  const playRows = []
  for (const [esbid, playStats] of Object.entries(playStatsByEsbid)) {
    const playStatsByPlay = groupBy(playStats, 'playId')
    for (const [playId, playStats] of Object.entries(playStatsByPlay)) {
      // ignore plays with no pos_team, likely a timeout or two minute warning
      const playStat = playStats.find((p) => p.pos_team)
      if (!playStat) continue

      const playRow = getPlayFromPlayStats({ playStats })
      if (Object.keys(playRow).length === 0) continue
      playRows.push(playRow)

      // TODO - succ

      if (playRow.player_fuml_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === playRow.player_fuml_gsis
        )
        if (player) {
          playRow.player_fuml = player.player
        }
      }

      if (playRow.bc_gsis) {
        const player = players_gsisid.find((p) => p.gsisid === playRow.bc_gsis)
        if (player) {
          playRow.bc = player.player
        }
      }

      if (playRow.psr_gsis) {
        const player = players_gsisid.find((p) => p.gsisid === playRow.psr_gsis)
        if (player) {
          playRow.psr = player.player
        }
      }

      if (playRow.trg_gsis) {
        const player = players_gsisid.find((p) => p.gsisid === playRow.trg_gsis)
        if (player) {
          playRow.trg = player.player
        }
      }

      if (playRow.intp_gsis) {
        const player = players_gsisid.find(
          (p) => p.gsisid === playRow.intp_gsis
        )
        if (player) {
          playRow.intp = player.player
        }
      }

      await db('nfl_plays').update(playRow).where({
        esbid,
        playId
      })
    }
  }
  log(`Updated ${playRows.length} plays`)
}

const main = async () => {
  let error
  try {
    await run()
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
