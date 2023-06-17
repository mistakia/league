import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#libs-shared'
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-player-snaps')
debug.enable('generate-player-snaps')

const generate_player_snaps_for_week = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type
}) => {
  const player_snap_inserts = []

  const nfl_game_rows = await db('nfl_games')
    .select('esbid')
    .where({ week, year, seas_type })
  const esbids = nfl_game_rows.map((i) => i.esbid)

  const gamelogs = await db('player_gamelogs')
    .select(
      'player.gsisItId as gsis_it_id',
      'player_gamelogs.tm',
      'player_gamelogs.opp'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where({ week, year, seas_type })

  const nfl_snap_rows = await db('nfl_snaps')
    .select(
      'nfl_snaps.esbid',
      'nfl_snaps.playId',
      'nfl_snaps.nflId as gsis_it_id',
      'nfl_plays.off',
      'nfl_plays.def',
      'nfl_plays.type'
    )
    .leftJoin('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_snaps.esbid').andOn(
        'nfl_plays.playId',
        '=',
        'nfl_snaps.playId'
      )
    })
    .whereIn('nfl_snaps.esbid', esbids)

  log(`found ${nfl_snap_rows.length} nfl snaps`)

  const nfl_snap_rows_by_gsis_it_id = groupBy(nfl_snap_rows, 'gsis_it_id')
  log(`found ${Object.keys(nfl_snap_rows_by_gsis_it_id).length} players`)
  const gsis_it_ids = Object.keys(nfl_snap_rows_by_gsis_it_id)

  const player_rows = await db('player')
    .select('pid', 'gsisItId as gsis_it_id')
    .whereIn('gsisItId', gsis_it_ids)

  for (const gsis_it_id_key in nfl_snap_rows_by_gsis_it_id) {
    const gsis_it_id = Number(gsis_it_id_key)
    const player_row = player_rows.find((p) => p.gsis_it_id === gsis_it_id)
    if (!player_row) {
      log(`player not found for gsis_it_id: ${gsis_it_id}`)
      continue
    }

    const player_gamelog = gamelogs.find((p) => p.gsis_it_id === gsis_it_id)
    if (!player_gamelog) {
      log(`player_gamelog not found for pid: ${player_row.pid}`)
      continue
    }

    const player_snap_rows = nfl_snap_rows_by_gsis_it_id[gsis_it_id]
    const { esbid } = player_snap_rows[0]

    player_snap_inserts.push({
      esbid,
      pid: player_row.pid,

      snaps_off: player_snap_rows.filter((i) => i.off === player_gamelog.tm)
        .length,
      snaps_def: player_snap_rows.filter((i) => i.def === player_gamelog.tm)
        .length,
      snaps_st: player_snap_rows.filter(
        (i) =>
          i.type === 'PUNT' ||
          i.type === 'FGXP' ||
          i.type === 'KOFF' ||
          i.type === 'ONSD'
      ).length
    })
  }

  if (player_snap_inserts.length) {
    log(player_snap_inserts[0])
    log(`inserting ${player_snap_inserts.length} player snaps`)
    await db('player_snaps_game')
      .insert(player_snap_inserts)
      .onConflict(['esbid', 'pid'])
      .merge()
  }
}

const generate_player_snaps_for_year = async ({
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  const weeks = await db('nfl_games')
    .select('week')
    .where({ year, seas_type })
    .groupBy('week')
    .orderBy('week', 'asc')

  log(`processing plays for ${weeks.length} weeks in ${year} (${seas_type})`)
  for (const { week } of weeks) {
    log(`loading plays for week: ${week} (${seas_type})`)
    await generate_player_snaps_for_week({
      year,
      week,
      seas_type
    })
  }
}

const generate_all_player_snaps = async ({
  start,
  end,
  seas_type = 'ALL'
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
    const is_seas_type_all = seas_type.toLowerCase() === 'all'
    log(`loading plays for year: ${year}, seas_type: ${seas_type}`)

    if (is_seas_type_all || seas_type.toLowerCase() === 'pre') {
      await generate_player_snaps_for_year({
        year,
        seas_type: 'PRE'
      })
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'reg') {
      await generate_player_snaps_for_year({
        year,
        seas_type: 'REG'
      })
    }

    if (is_seas_type_all || seas_type.toLowerCase() === 'post') {
      await generate_player_snaps_for_year({
        year,
        seas_type: 'POST'
      })
    }
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      await generate_all_player_snaps({
        start: argv.start,
        end: argv.end,
        seas_type: argv.seas_type
      })
    } else if (argv.year) {
      if (argv.week) {
        await generate_player_snaps_for_week({
          year: argv.year,
          week: argv.week,
          seas_type: argv.seas_type
        })
      } else {
        await generate_player_snaps_for_year({
          year: argv.year,
          seas_type: argv.seas_type
        })
      }
    } else {
      log('start')
      await generate_player_snaps_for_week({
        year: argv.year,
        week: argv.week,
        seas_type: argv.seas_type
      })
      log('end')
    }
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_player_snaps_for_week
