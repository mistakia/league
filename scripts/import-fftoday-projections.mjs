import fetchCheerioObject from 'fetch-cheerio-object'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')
const timestamp = new Date()
const year = constants.season.year
const week = argv.season ? 0 : Math.max(constants.season.week, 1)
const getURL = ({ position, page }) =>
  argv.season
    ? `https://www.fftoday.com/rankings/playerproj.php?Season=${year}&PosID=${position}&LeagueID=&order_by=FFPts&sort_order=DESC&cur_page=${page}`
    : `https://www.fftoday.com/rankings/playerwkproj.php?Season=${year}&GameWeek=${week}&PosID=${position}&LeagueID=&order_by=FFPts&sort_order=DESC&cur_page=${page}`

const positions = {
  10: 'QB',
  20: 'RB',
  30: 'WR',
  40: 'TE'
}

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  const missing = []
  const items = []
  for (const position of Object.keys(positions)) {
    let count = 50
    let page = 0
    while (count === 50) {
      const url = getURL({ position, page })
      log(url)
      const $ = await fetchCheerioObject(url)
      count = $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').length
      $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').each(
        (i, el) => {
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
        }
      )

      page++
    }
  }

  const inserts = []
  for (const { params, data } of items) {
    let player_row

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
      sourceid: 5, // fftoday sourceid,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index').insert(inserts).onConflict().merge()
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
    type: constants.jobs.PROJECTIONS_FFTODAY,
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
