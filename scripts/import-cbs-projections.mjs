import fetchCheerioObject from 'fetch-cheerio-object'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')

const week = argv.season ? 0 : Math.max(constants.season.week, 1)
const type = argv.season ? 'season' : week
const year = new Date().getFullYear()
const timestamp = Math.round(Date.now() / 1000)
const getUrl = (pos) =>
  `https://www.cbssports.com/fantasy/football/stats/${pos}/${year}/${type}/projections/ppr/`

const positions = ['QB', 'RB', 'WR', 'TE']

const run = async () => {
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
    const url = getUrl(position)
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
      week,
      year,
      sourceid: constants.sources.CBS,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.teams.join(', ')}`)
  )

  if (argv.dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.CBS })
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

  await db('jobs').insert({
    type: constants.jobs.PROJECTIONS_CBS,
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
