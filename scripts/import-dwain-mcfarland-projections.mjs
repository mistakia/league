import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import { is_main, fantasylife, find_player_row } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-dwain-mcfarland-projections')
debug.enable('import-dwain-mcfarland-projections,fantasylife,get-player')

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

const import_dwain_mcfarland_projections = async ({
  table_id,
  dry_run = false
} = {}) => {
  if (!table_id) {
    throw new Error('table_id is required')
  }

  const timestamp = new Date()
  const inserts = []
  const missing = []
  const position_ids = [
    344, // QB
    368 // FLEX
  ]

  for (const position_id of position_ids) {
    const query_params = {
      data_filter_data: `{"92":1115,"98":${position_id},"225":1460}`,
      scoring_system_data: '{"id":185}'
    }
    const data = await fantasylife.get_projections({ table_id, query_params })
    log(data[0])

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
        player_row = await find_player_row(params)
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
        year: current_season.year,
        week: 0,
        sourceid: external_data_sources.FANTASYLIFE_DWAIN_MCFARLAND,
        seas_type: 'REG',
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
    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year', 'seas_type'])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_dwain_mcfarland_projections({
      table_id: argv.table_id,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_dwain_mcfarland_projections
