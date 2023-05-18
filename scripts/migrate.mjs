import debug from 'debug'
import dayjs from 'dayjs'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
// import config from '#config'
import { isMain, batch_insert } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate,generate-league-format-hash,generate-scoring-format-hash')

const migrate = async () => {
  const prop_year_results = await db('props').select('year').distinct()
  const prop_years = prop_year_results.map((i) => i.year)

  for (const year of prop_years) {
    log(`migrating props for year: ${year}`)
    const props = await db('props').where({ year }).orderBy('timestamp', 'asc')

    const player_pids = {}
    props.forEach((p) => (player_pids[p.pid] = true))

    const player_gamelogs_result = await db('player_gamelogs')
      .select(
        'player_gamelogs.pid',
        'player_gamelogs.esbid',
        'nfl_games.week',
        'nfl_games.year',
        'nfl_games.timestamp',
        'nfl_games.seas_type'
      )
      .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
      .whereIn('pid', Object.keys(player_pids))
      .where('nfl_games.year', year)
      .orderBy('nfl_games.timestamp', 'asc')

    const player_gamelogs = player_gamelogs_result.map((g) => ({
      ...g,
      dayjs: dayjs.unix(g.timestamp)
    }))

    const open_index = {}
    const close_index = {}

    for (const prop of props) {
      // find first gamelog after prop timestamp — subtract 5 hours to account for live props
      const gamelog = player_gamelogs.find(
        (g) =>
          g.pid === prop.pid &&
          g.dayjs.isAfter(dayjs.unix(prop.timestamp - 5 * 60 * 60))
      )
      if (!gamelog) {
        log(
          `no gamelog found for prop id: ${prop.id} pid: ${prop.pid} timestamp: ${prop.timestamp}`
        )
        continue
      }

      const prop_row = {
        pid: prop.pid,
        prop_type: prop.prop_type,
        ln: prop.ln,
        o: prop.o,
        u: prop.u,
        o_am: prop.o_am,
        u_am: prop.u_am,
        sourceid: prop.sourceid,
        timestamp: prop.timestamp,
        esbid: gamelog.esbid
      }

      const prop_id = `${prop.sourceid}_${prop.pid}_${prop.esbid}_${prop.prop_type}`
      if (!open_index[prop_id]) {
        open_index[prop_id] = {
          ...prop_row,
          time_type: constants.player_prop_time_type.OPEN
        }
      }

      close_index[prop_id] = {
        ...prop_row,
        time_type: constants.player_prop_time_type.CLOSE
      }
    }

    // insert into index table as opening line
    const open_inserts = Object.values(open_index)
    await batch_insert({
      inserts: open_inserts,
      save: (batch) =>
        db('props_index_new').insert(batch).onConflict().ignore(),
      batch_size: 10000
    })
    log(`inserted ${open_inserts.length} open props for year: ${year}`)

    // insert into index table as closing line
    const close_inserts = Object.values(close_index)
    await batch_insert({
      inserts: close_inserts,
      save: (batch) => db('props_index_new').insert(batch).onConflict().merge(),
      batch_size: 10000
    })
    log(`inserted ${close_inserts.length} close props for year: ${year}`)
  }
}

async function main() {
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
