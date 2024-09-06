import fetchCheerioObject from 'fetch-cheerio-object'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, getPlayer, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const week = Math.max(constants.season.week, 1)
  const year = constants.season.year

  const $ = await fetchCheerioObject(
    'https://www.numberfire.com/nfl/fantasy/fantasy-football-projections'
  )

  const items = {}
  const re = /\(([A-z]*),\s([A-z]*)\)/i
  $('table.projection-table.projection-table--fixed tbody tr').each((i, el) => {
    const name = $(el, 'td.player').eq(0).find('a .full').text().trim()
    const text = $(el, 'td.player').text().trim()
    const result = text.match(re)
    const pos = result[1]
    const team = result[2]

    items[i] = { name, team, pos }
  })

  $('table.projection-table.no-fix tbody tr').each((i, el) => {
    const data = {}
    data.py = $(el).find('td.pass_yd').text().trim()
    data.tdp = $(el).find('td.pass_td').text().trim()
    data.ints = $(el).find('td.pass_int').text().trim()

    data.ra = $(el).find('td.rush_att').text().trim()
    data.ry = $(el).find('td.rush_yd').text().trim()
    data.tdr = $(el).find('td.rush_td').text().trim()

    data.rec = $(el).find('td.rec').text().trim()
    data.recy = $(el).find('td.rec_yd').text().trim()
    data.tdrec = $(el).find('td.rec_td').text().trim()

    items[i].data = data
  })

  const inserts = []
  const missing = []
  for (const { name, team, pos, data } of Object.values(items)) {
    let player_row

    const params = { name, team, pos }
    try {
      player_row = await getPlayer(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    inserts.push({
      pid: player_row.pid,
      year,
      week,
      sourceid: constants.sources.NUMBERFIRE,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.NUMBERFIRE })
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
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_NUMBERFIRE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
