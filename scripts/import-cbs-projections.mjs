import fetchCheerioObject from 'fetch-cheerio-object'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, find_player_row, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
debug.enable('import:projections,get-player')

const year = new Date().getFullYear()
const timestamp = Math.round(Date.now() / 1000)
const getUrl = (pos, type) =>
  `https://www.cbssports.com/fantasy/football/stats/${pos}/${year}/${type}/projections/ppr/`

const positions = ['QB', 'RB', 'WR', 'TE']

const run = async ({ season = false, dry = false } = {}) => {
  const week = season ? 0 : Math.max(constants.season.week, 1)
  const type = season ? 'season' : week
  // do not pull in any projections after the season has ended
  if (
    type !== 'season' &&
    constants.season.week > constants.season.nflFinalWeek
  ) {
    return
  }

  if (type === 'season' && constants.season.week > 0) {
    return
  }

  const missing = []
  const items = []
  for (const position of positions) {
    const url = getUrl(position, type)
    log(url)
    const $ = await fetchCheerioObject(url)
    $('main table tbody tr').each((i, el) => {
      const name = $(el, 'td')
        .eq(0)
        .find('.CellPlayerName--long a')
        .text()
        .trim()
      const team = $(el, 'td')
        .eq(0)
        .find('.CellPlayerName--long .CellPlayerName-team')
        .text()
        .trim()
      const pos = $(el, 'td')
        .eq(0)
        .find('.CellPlayerName--long .CellPlayerName-position')
        .text()
        .trim()

      const params = {
        name,
        teams: [team],
        pos,
        ignore_retired: year === constants.season.year
      }
      const data = {}

      if (position === 'QB') {
        data.pa = $(el).find('td').eq(2).text().trim()
        data.pc = $(el).find('td').eq(3).text().trim()
        data.py = $(el).find('td').eq(4).text().trim()
        data.tdp = $(el).find('td').eq(6).text().trim()
        data.ints = $(el).find('td').eq(7).text().trim()

        data.ra = $(el).find('td').eq(9).text().trim()
        data.ry = $(el).find('td').eq(10).text().trim()
        data.tdr = $(el).find('td').eq(12).text().trim()
        data.fuml = $(el).find('td').eq(13).text().trim()
      } else if (position === 'TE') {
        data.trg = $(el).find('td').eq(2).text().trim()
        data.rec = $(el).find('td').eq(3).text().trim()
        data.recy = $(el).find('td').eq(4).text().trim()
        data.tdrec = $(el).find('td').eq(7).text().trim()
        data.fuml = $(el).find('td').eq(8).text().trim()
      } else if (position === 'WR') {
        data.trg = $(el).find('td').eq(2).text().trim()
        data.rec = $(el).find('td').eq(3).text().trim()
        data.recy = $(el).find('td').eq(4).text().trim()
        data.tdrec = $(el).find('td').eq(7).text().trim()

        data.ra = $(el).find('td').eq(8).text().trim()
        data.ry = $(el).find('td').eq(9).text().trim()
        data.tdr = $(el).find('td').eq(11).text().trim()
        data.fuml = $(el).find('td').eq(12).text().trim()
      } else if (position === 'RB') {
        data.ra = $(el).find('td').eq(2).text().trim()
        data.ry = $(el).find('td').eq(3).text().trim()
        data.tdr = $(el).find('td').eq(5).text().trim()

        data.trg = $(el).find('td').eq(6).text().trim()
        data.rec = $(el).find('td').eq(7).text().trim()
        data.recy = $(el).find('td').eq(8).text().trim()
        data.tdrec = $(el).find('td').eq(11).text().trim()
        data.fuml = $(el).find('td').eq(12).text().trim()
      }

      items.push({ params, data })
    })
  }

  const inserts = []
  for (const { params, data } of items) {
    let player_row

    // TODO cleanup
    try {
      player_row = await find_player_row(params)
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
      week,
      year,
      seas_type: 'REG',
      sourceid: constants.sources.CBS,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.teams.join(', ')}`)
  )

  if (dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.CBS, seas_type: 'REG' })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

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
    await run({
      season: argv.season,
      dry: argv.dry
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_CBS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
