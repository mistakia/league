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

const log = debug('import-fantasylife-projections')
debug.enable('import-fantasylife-projections,fantasylife,get-player')

const format_projection = (item) => ({
  passing_attempts: item.pass_att,
  passing_completions: item.pass_comp,
  passing_yards: item.pass_yds,
  passing_interceptions: item.pass_ints,
  passing_touchdowns: item.pass_tds,
  rushing_attempts: item.rush_att,
  rushing_yards: item.rush_yds,
  rushing_touchdowns: item.rush_tds,
  targets: item.targets,
  receptions: item.rec,
  receiving_yards: item.rec_yds,
  receiving_touchdowns: item.rec_tds
})

const import_fantasylife_projections = async ({
  table_id,
  dry_run = false
} = {}) => {
  if (!table_id) {
    throw new Error('table_id is required')
  }

  if (current_season.week > current_season.nflFinalWeek) {
    return
  }

  const year = current_season.year
  const week = current_season.week
  const generated_at = new Date()
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
        season_year: year,
        week,
        season_type: 'REG',
        sourceid: external_data_sources.FANTASYLIFE,
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
      .where({
        season_year: year,
        week,
        sourceid: external_data_sources.FANTASYLIFE,
        season_type: 'REG'
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict([
        'sourceid',
        'pid',
        'userid',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, generated_at })))
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
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

if (is_main(import.meta.url)) {
  main()
}

export default import_fantasylife_projections
