const fetchCheerioObject = require('fetch-cheerio-object')
const debug = require('debug')

log = debug('import:projections')
debug.enable('league:player:get,import:projections')

const { getPlayerId } = require('../utils')
const db = require('../db')

const year = new Date().getFullYear()
const timestamp = new Date()
const getUrl = (pos) => `https://www.cbssports.com/fantasy/football/stats/${pos}/${year}/season/projections/ppr/`

const positions = ['QB', 'RB', 'WR', 'TE']

const run = async () => {
  const missing = []
  const items = []
  for (const position of positions) {
    const url = getUrl(position)
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
      year,
      sourceid: 2, // cbs sourceid
      timestamp,
      ...data
    })
  }


  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  log(`Inserting ${inserts.length} projections into database`)
  const res = await db('projections').insert(inserts)

  process.exit()
}

try {
  run()
} catch (err) {
  console.log(err)
}
