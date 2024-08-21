import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, fantasylife, getPlayer } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fantasylife-projections')
debug.enable('import-fantasylife-projections,fantasylife,get-player')

const format_projection = (item) => ({
  pa: item.pass_att,
  pc: item.pass_comp,
  py: item.pass_yds,
  ints: item.pass_ints,
  tdp: item.pass_tds,
  ra: item.rush_att,
  ry: item.rush_yds,
  tdr: item.rush_tds,
  trg: item.targets,
  rec: item.rec,
  recy: item.rec_yds,
  tdrec: item.rec_tds
})

const import_fantasylife_projections = async ({
  table_id,
  dry_run = false
} = {}) => {
  if (!table_id) {
    throw new Error('table_id is required')
  }

  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  const year = constants.season.year
  const week = constants.season.week
  const timestamp = new Date()
  const inserts = []
  const missing = []
  const position_ids = [
    196, // QB
    208 // FLEX
    // TODO 211  // DST
  ]

  for (const position_id of position_ids) {
    const query_params = {
      data_filter_data: `{"58":190,"61":${position_id}}`,
      scoring_system_data: '{"id":185}'
    }
    const data = await fantasylife.get_projections({ table_id, query_params })

    if (!data) {
      continue
    }

    for (const item of data) {
      let player_row
      const params = {
        name: item.name,
        pos: item.position,
        team: item.nfl_team
      }

      try {
        player_row = await getPlayer(params)
        if (!player_row) {
          missing.push(params)
          continue
        }
      } catch (err) {
        log(err)
        missing.push(params)
        continue
      }

      const data = format_projection(item)
      inserts.push({
        pid: player_row.pid,
        year,
        week,
        sourceid: constants.sources.FANTASYLIFE,
        ...data
      })
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.FANTASYLIFE })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
}

const main = async () => {
  let error
  try {
    await import_fantasylife_projections({
      table_id: argv.table_id,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_fantasylife_projections
