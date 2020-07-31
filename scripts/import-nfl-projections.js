// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const fetchCheerioObject = require('fetch-cheerio-object')
const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('league:player:get,import:projections')

const { getPlayerId } = require('../utils')
const db = require('../db')

const timestamp = new Date()
const { constants } = require('../common')
const { year } = constants
const getURL = (offset) => `https://fantasy.nfl.com/research/projections?position=O&sort=projectedPts&statCategory=projectedStats&statSeason=${year}&statType=seasonProjectedStats&offset=${offset + 1}`

const run = async () => {
  const missing = []
  const items = []

  let lastProjection = 1
  while (lastProjection > 0) {
    const $ = await fetchCheerioObject(getURL(items.length))
    $('table.tableType-player tbody tr').map((i, el) => {
      const name = $(el, 'td').eq(0).find('a').text().trim()
      const meta = $(el, 'td').eq(0).find('em').text().split('-')
      const pos = meta.shift().trim()
      const team = meta.pop()

      const params = { name, team: team && team.trim(), pos }
      const data = {}

      // passing
      data.py = Math.round($(el).find('td').eq(3).text().trim()) || 0
      data.tdp = Math.round($(el).find('td').eq(4).text().trim()) || 0
      data.ints = Math.round($(el).find('td').eq(5).text().trim()) || 0

      // rushing
      data.ry = Math.round($(el).find('td').eq(6).text().trim()) || 0
      data.tdr = Math.round($(el).find('td').eq(7).text().trim()) || 0
      data.fuml = Math.round($(el).find('td').eq(14).text().trim()) || 0

      // receiving
      data.rec = Math.round($(el).find('td').eq(8).text().trim()) || 0
      data.recy = Math.round($(el).find('td').eq(9).text().trim()) || 0
      data.tdrec = Math.round($(el).find('td').eq(10).text().trim()) || 0

      data.twoptc = Math.round($(el).find('td').eq(13).text().trim()) || 0

      items.push({ params, data })
      lastProjection = parseFloat($(el).find('td').eq(15).text().trim())
    })
  }

  const inserts = []
  for (const { params, data } of items) {
    let playerId

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
      week: 0,
      year,
      sourceid: 4, // nfl sourceid,
      timestamp,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    return process.exit()
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections').insert(inserts)

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
