import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate')

const migrate = async () => {
  const props_years = await db('props')
    .select('year')
    .whereNull('esbid')
    .groupBy('year')
  for (const { year } of props_years) {
    const nfl_games = await db('nfl_games').where({ year })

    const updates = []

    const weeks = await db('props')
      .select('week')
      .where({ year })
      .whereNull('esbid')
      .groupBy('week')
    for (const { week } of weeks) {
      const props = await db('props').where({ week, year }).whereNull('esbid')
      const pids = [...new Set(props.map((p) => p.pid))]
      const player_rows = await db('player').whereIn('pid', pids)
      const gamelogs = await db('player_gamelogs')
        .select('player_gamelogs.esbid', 'player_gamelogs.pid')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .where({ week, year, seas_type: 'REG' })

      for (const prop of props) {
        const player_row = player_rows.find((p) => p.pid === prop.pid)
        let nfl_game = gamelogs.find((g) => g.pid === prop.pid)

        if (!nfl_game) {
          nfl_game = nfl_games.find(
            (game) =>
              game.week === week &&
              game.year === year &&
              game.seas_type === 'REG' &&
              (game.h === player_row.cteam || game.v === player_row.cteam)
          )
        }

        if (!nfl_game) {
          log(
            `nfl game not found for ${year} week ${week} team ${player_row.cteam}`
          )
          continue
        }

        updates.push({
          esbid: nfl_game.esbid,
          sourceid: prop.sourceid,
          id: prop.id,
          pid: prop.pid,
          week: prop.week,
          year: prop.year,
          prop_type: prop.prop_type,
          ln: prop.ln,
          timestamp: prop.timestamp
        })
      }

      log(`migrating ${updates.length} props for ${year} week ${week}`)
      const chunk_size = 50000
      for (let i = 0; i < updates.length; i += chunk_size) {
        const chunk = updates.slice(i, i + chunk_size)
        await db('props').insert(chunk).onConflict().merge()
      }
    }
  }

  const props_index_years = await db('props_index')
    .select('year')
    .whereNull('esbid')
    .groupBy('year')
  for (const { year } of props_index_years) {
    const nfl_games = await db('nfl_games').where({ year })

    const updates = []

    const weeks = await db('props_index')
      .select('week')
      .where({ year })
      .whereNull('esbid')
      .groupBy('week')
    for (const { week } of weeks) {
      log(`migrating props for ${year} week ${week}`)

      const props = await db('props_index')
        .where({ week, year })
        .whereNull('esbid')
      const pids = [...new Set(props.map((p) => p.pid))]
      const player_rows = await db('player').whereIn('pid', pids)
      const gamelogs = await db('player_gamelogs')
        .select('player_gamelogs.esbid', 'player_gamelogs.pid')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .where({ week, year, seas_type: 'REG' })

      for (const prop of props) {
        const player_row = player_rows.find((p) => p.pid === prop.pid)
        let nfl_game = gamelogs.find((g) => g.pid === prop.pid)

        if (!nfl_game) {
          nfl_game = nfl_games.find(
            (game) =>
              game.week === week &&
              game.year === year &&
              game.seas_type === 'REG' &&
              (game.h === player_row.cteam || game.v === player_row.cteam)
          )
        }

        if (!nfl_game) {
          log(
            `nfl game not found for ${year} week ${week} team ${player_row.cteam}`
          )
          continue
        }

        updates.push({
          esbid: nfl_game.esbid,
          prop_id: prop.prop_id,
          sourceid: prop.sourceid,
          pid: prop.pid,
          week: prop.week,
          year: prop.year,
          prop_type: prop.prop_type,
          ln: prop.ln,
          time_type: prop.time_type,
          timestamp: prop.timestamp
        })
      }

      log(`migrating ${updates.length} props for ${year} week ${week}`)
      const chunk_size = 50000
      for (let i = 0; i < updates.length; i += chunk_size) {
        const chunk = updates.slice(i, i + chunk_size)
        await db('props_index').insert(chunk).onConflict().merge()
      }
    }
  }

  log('all tables migrated')
}

const main = async () => {
  let error
  try {
    await migrate()
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

export default migrate
