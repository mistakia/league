import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, report_job, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  constants,
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays
} from '#libs-shared'
import db from '#db'
import { get_play_stats } from '#libs-server/play-stats-utils.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-gamelogs')
debug.enable('generate-player-gamelogs')

const format_gamelog = ({ esbid, pid, stats, opp, pos, tm, year }) => {
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
    year,
    ...cleanedStats
  }
}

const generate_player_gamelogs = async ({
  week = constants.season.last_week_with_stats,
  year = constants.season.year,
  seas_type = constants.season.nfl_seas_type,
  dry_run = false
}) => {
  log(`loading plays for ${year} week ${week}`)

  const playStats = await get_play_stats({ year, week, seas_type })

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

    gamelog_gsispids.push(gsispid)
    const player_gamelog = format_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      year: playStat.year,
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

    const player_gamelog = format_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(playStat.clubCode),
      opp,
      esbid: playStat.esbid,
      year: playStat.year,
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
    const player_gamelog = format_gamelog({
      pid: team,
      pos: 'DST',
      tm: team,
      esbid: play.esbid,
      year: play.year,
      opp: fixTeam(opp),
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.pname} / ${m.current_nfl_team}`)
  )

  if (dry_run) {
    log(player_gamelog_inserts[0])
    log(
      `Generated ${player_gamelog_inserts.length} gamelogs for ${year} week ${week}`
    )
    return
  }

  if (player_gamelog_inserts.length) {
    await batch_insert({
      items: player_gamelog_inserts,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_gamelog_inserts.length} gamelogs`)
  }
}

const main = async () => {
  let error
  try {
    await generate_player_gamelogs({
      week: argv.week,
      year: argv.year,
      seas_type: argv.seas_type,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_PLAYER_GAMELOGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_gamelogs
