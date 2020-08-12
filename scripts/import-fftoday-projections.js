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
const year = constants.season.year
const getURL = ({ position, page }) => `https://www.fftoday.com/rankings/playerproj.php?Season=${year}&PosID=${position}&LeagueID=&order_by=FFPts&sort_order=DESC&cur_page=${page}`

const positions = {
  10: 'QB',
  20: 'RB',
  30: 'WR',
  40: 'TE'
}

const run = async () => {
  const missing = []
  const items = []
  for (const position of Object.keys(positions)) {
    let count = 50
    let page = 0
    while (count === 50) {
      const url = getURL({ position, page })
      const $ = await fetchCheerioObject(url)
      count = $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').length
      $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').map((i, el) => {
        const name = $(el).find('td').eq(1).text().trim()
        const team = $(el).find('td').eq(2).text().trim()
        const pos = positions[position]
        const params = { name, team, pos }
        const data = {}

        if (pos === 'QB') {
          data.pa = $(el).find('td').eq(5).text().trim()
          data.pc = $(el).find('td').eq(4).text().trim()
          data.py = $(el).find('td').eq(6).text().replace(',', '').trim()
          data.tdp = $(el).find('td').eq(7).text().trim()
          data.ints = $(el).find('td').eq(8).text().trim()

          data.ra = $(el).find('td').eq(9).text().trim()
          data.ry = $(el).find('td').eq(10).text().replace(',', '').trim()
          data.tdr = $(el).find('td').eq(11).text().trim()
        } else if (pos === 'TE') {
          data.rec = $(el).find('td').eq(4).text().trim()
          data.recy = $(el).find('td').eq(5).text().replace(',', '').trim()
          data.tdrec = $(el).find('td').eq(6).text().trim()
        } else if (pos === 'WR') {
          data.rec = $(el).find('td').eq(4).text().trim()
          data.recy = $(el).find('td').eq(5).text().replace(',', '').trim()
          data.tdrec = $(el).find('td').eq(6).text().trim()

          data.ra = $(el).find('td').eq(7).text().trim()
          data.ry = $(el).find('td').eq(8).text().replace(',', '').trim()
          data.tdr = $(el).find('td').eq(9).text().trim()
        } else if (pos === 'RB') {
          data.ra = $(el).find('td').eq(4).text().trim()
          data.ry = $(el).find('td').eq(5).text().replace(',', '').trim()
          data.tdr = $(el).find('td').eq(6).text().trim()

          data.rec = $(el).find('td').eq(7).text().trim()
          data.recy = $(el).find('td').eq(8).text().replace(',', '').trim()
          data.tdrec = $(el).find('td').eq(9).text().trim()
        }

        items.push({ params, data })
      })

      page++
    }
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
      sourceid: 5, // fftoday sourceid,
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
