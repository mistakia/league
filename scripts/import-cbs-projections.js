// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetchCheerioObject = require('fetch-cheerio-object')
const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('import:projections')

const { getPlayerId } = require('../utils')
const { constants } = require('../common')
const db = require('../db')

const type = argv.season ? 'season' : constants.season.week
const week = argv.season ? 0 : constants.season.week
const year = new Date().getFullYear()
const timestamp = new Date()
const getUrl = (pos) => `https://www.cbssports.com/fantasy/football/stats/${pos}/${year}/${type}/projections/ppr/`

const positions = ['QB', 'RB', 'WR', 'TE']

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  const missing = []
  const items = []
  for (const position of positions) {
    const url = getUrl(position)
    log(url)
    const $ = await fetchCheerioObject(url)
    $('main table tbody tr').map((i, el) => {
      const name = $(el, 'td').eq(0).find('.CellPlayerName--long a').text().trim()
      const team = $(el, 'td').eq(0).find('.CellPlayerName--long .CellPlayerName-team').text().trim()
      const pos = $(el, 'td').eq(0).find('.CellPlayerName--long .CellPlayerName-position').text().trim()

      const params = { name, team, pos }
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
    let playerId

    // TODO cleanup
    try {
      playerId = await getPlayerId(params)
      if (!playerId) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    inserts.push({
      player: playerId,
      week,
      year,
      sourceid: 2, // cbs sourceid
      timestamp,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections').insert(inserts)
}

module.exports = run

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

if (!module.parent) {
  main()
}
