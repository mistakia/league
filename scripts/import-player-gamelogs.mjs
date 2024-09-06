import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam, formatPosition } from '#libs-shared'
import { is_main, nfl, wait, getPlayer } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import_player_gamelogs')
debug.enable('import_player_gamelogs,nfl,get-player')

const import_player_gamelogs_for_week = async ({
  year = constants.season.year,
  week,
  seas_type = 'REG',
  ignore_cache = false,
  token
}) => {
  // get list of games for this week
  const games = await db('nfl_games').where({
    year,
    week,
    seas_type
  })

  const player_gamelog_inserts = []

  for (const game of games) {
    if (!game.detailid_v3) {
      log(`skipping esbid: ${game.esbid}, missing detailid_v3`)
      continue
    }

    if (!token) {
      token = await nfl.getToken()
    }

    if (!token) {
      throw new Error('missing access token')
    }

    log(`loading plays for esbid: ${game.esbid}`)
    const data = await nfl.get_plays_v3({
      id: game.detailid_v3,
      token,
      ignore_cache
    })
    if (!data.data) continue

    const { homeLiveGameRoster, visitorLiveGameRoster } =
      data.data.viewer.gameDetail
    const home_team = fixTeam(data.data.viewer.gameDetail.homeTeam.abbreviation)
    const visitor_team = fixTeam(
      data.data.viewer.gameDetail.visitorTeam.abbreviation
    )

    const player_gsisp_ids = []
    homeLiveGameRoster
      .filter((i) => i.gsisPlayer)
      .forEach((i) => player_gsisp_ids.push(i.gsisPlayer.id))
    visitorLiveGameRoster
      .filter((i) => i.gsisPlayer)
      .forEach((i) => player_gsisp_ids.push(i.gsisPlayer.id))
    const players = await db('player')
      .select('pid', 'gsispid')
      .whereIn('gsispid', player_gsisp_ids)

    for (const item of homeLiveGameRoster) {
      let player = players.find(
        (i) => item.gsisPlayer && i.gsispid === item.gsisPlayer.id
      )

      if (!player) {
        try {
          const params = {
            name: `${item.firstName} ${item.lastName}`,
            pos: formatPosition(item.position)
          }
          player = await getPlayer(params)
        } catch (err) {
          log(err)
        }
      }

      if (!player) {
        log(
          `missing player for gsispid: ${
            item.gsisPlayer && item.gsisPlayer.id
          } (${item.firstName} ${item.lastName}))`
        )
        continue
      }

      const { position, jerseyNumber, status } = item
      const player_gamelog = {
        esbid: game.esbid,
        pid: player.pid,
        tm: home_team,
        opp: visitor_team,
        pos: formatPosition(position),
        jnum: Number(jerseyNumber) || null,
        active: status !== 'NOT_ACTIVE',
        started: status === 'STARTED',
        year
      }
      player_gamelog_inserts.push(player_gamelog)
    }

    for (const item of visitorLiveGameRoster) {
      let player = players.find(
        (i) => item.gsisPlayer && i.gsispid === item.gsisPlayer.id
      )

      if (!player) {
        try {
          const params = {
            name: `${item.firstName} ${item.lastName}`,
            pos: formatPosition(item.position)
          }
          player = await getPlayer(params)
        } catch (err) {
          log(err)
        }
      }

      if (!player) {
        log(
          `missing player for gsispid: ${
            item.gsisPlayer && item.gsisPlayer.id
          } (${item.firstName} ${item.lastName}))`
        )
        continue
      }

      const { position, jerseyNumber, status } = item
      const player_gamelog = {
        esbid: game.esbid,
        pid: player.pid,
        tm: visitor_team,
        opp: home_team,
        pos: formatPosition(position),
        jnum: Number(jerseyNumber) || null,
        active: status !== 'NOT_ACTIVE',
        started: status === 'STARTED',
        year
      }
      player_gamelog_inserts.push(player_gamelog)
    }
  }

  if (player_gamelog_inserts.length) {
    try {
      await db('player_gamelogs')
        .insert(player_gamelog_inserts)
        .onConflict(['esbid', 'pid', 'year'])
        .merge()

      log(`inserted ${player_gamelog_inserts.length} player gamelogs`)
    } catch (err) {
      log(err)
    }
  }
}

const import_player_gamelogs_for_year = async ({
  year = constants.season.year,
  seas_type = 'REG',
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
    log(`loading plays for week: ${week} (${seas_type})`)
    await import_player_gamelogs_for_week({
      year,
      week,
      seas_type,
      ignore_cache,
      token
    })
    await wait(4000)
  }
}

const import_all_player_gamelogs = async ({
  start,
  end,
  seas_type = 'ALL',
  ignore_cache
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

    const is_seas_type_all = seas_type.toLowerCase() === 'all'
    log(`loading plays for year: ${year}, seas_type: ${seas_type}`)

    if (is_seas_type_all || seas_type.toLowerCase() === 'pre') {
      await import_player_gamelogs_for_year({
        year,
        seas_type: 'PRE',
        ignore_cache,
        token
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'reg') {
      await import_player_gamelogs_for_year({
        year,
        seas_type: 'REG',
        ignore_cache,
        token
      })
      await wait(3000)
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'post') {
      await import_player_gamelogs_for_year({
        year,
        seas_type: 'POST',
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
      await import_all_player_gamelogs({
        start: argv.start,
        end: argv.end,
        seas_type: argv.seas_type,
        ignore_cache: argv.ignore_cache
      })
    } else if (argv.year) {
      if (argv.week) {
        await import_player_gamelogs_for_week({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache
        })
      } else {
        await import_player_gamelogs_for_year({
          year: argv.year,
          seas_type: argv.seas_type,
          ignore_cache: argv.ignore_cache
        })
      }
    } else {
      log('start')
      await import_player_gamelogs_for_week({
        week: argv.week,
        seas_type: argv.seas_type,
        ignore_cache: argv.ignore_cache
      })
      log('end')
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_player_gamelogs_for_week
