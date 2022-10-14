import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain } from '#utils'
import db from '#db'
import { constants, groupBy, getPlayFromPlayStats } from '#common'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-play-stats')
debug.enable('process-play-stats,update-player,get-player')
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

const run = async ({
  week = current_week,
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  const playStats = await db('nfl_play_stats')
    .select(
      'nfl_play_stats.*',
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
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_play_stats.valid', 1)
    .where('nfl_plays.seas_type', seas_type)

  const play_stats_by_gsisid = groupBy(playStats, 'gsisId')
  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsisid).length} players`
  )

  const missing = []
  const gsisids = Object.keys(play_stats_by_gsisid)
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)
  const existing_gsisids = player_gsisid_rows.map((p) => p.gsisid)

  for (const gsisid of Object.keys(play_stats_by_gsisid)) {
    const gsisid_exists = existing_gsisids.includes(gsisid)
    if (!gsisid_exists) {
      const play_stats = play_stats_by_gsisid[gsisid]
      const play_stat = play_stats[0]
      missing.push({
        gsisid,
        name: play_stat.playerName,
        team: play_stat.clubCode
      })
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.team} / ${m.gsisid}`)
  )

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
  const play_rows = []
  const play_laterals = []

  const playStatsByEsbid = groupBy(playStats, 'esbid')

  for (const [esbid, single_game_play_stats] of Object.entries(
    playStatsByEsbid
  )) {
    const play_stats_by_play = groupBy(single_game_play_stats, 'playId')

    for (const [playId, playStats] of Object.entries(play_stats_by_play)) {
      // ignore plays with no pos_team, likely a timeout or two minute warning
      const playStat = playStats.find((p) => p.pos_team)
      if (!playStat) continue

      const { play_row, laterals } = getPlayFromPlayStats({
        playStats,
        esbid,
        playId
      })
      if (Object.keys(play_row).length === 0) continue

      // TODO - play succ field

      for (const play_lateral of laterals) {
        const player = player_gsisid_rows.find(
          (p) => p.gsisid === play_lateral.gsis
        )
        if (player) {
          play_lateral.player = player.pid
        }

        play_laterals.push(play_lateral)
      }

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

      play_rows.push(play_row)
    }
  }

  if (argv.dry) {
    log(`Generated ${play_rows.length} plays`)
    if (play_rows.length) log(play_rows[0])

    log(`Generated ${play_laterals.length} play laterals`)
    if (play_laterals.length) log(play_laterals[0])
    return
  }

  if (play_rows.length) {
    log(`Updated ${play_rows.length} plays`)
    await db('nfl_plays').insert(play_rows).onConflict().merge()
  }

  if (play_laterals.length) {
    log(`Updated ${play_rows.length} play laterals`)
    await db('nfl_play_laterals').insert(play_laterals).onConflict().merge()
  }
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
