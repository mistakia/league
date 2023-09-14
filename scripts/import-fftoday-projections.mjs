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
  if (constants.season.week > constants.season.nflFinalWeek) {
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
            data.pa = Number($(el).find('td').eq(5).text().trim()) || null
            data.pc = Number($(el).find('td').eq(4).text().trim()) || null
            data.py =
              Number($(el).find('td').eq(6).text().replace(',', '').trim()) ||
              null
            data.tdp = Number($(el).find('td').eq(7).text().trim()) || null
            data.ints = Number($(el).find('td').eq(8).text().trim()) || null

            data.ra = Number($(el).find('td').eq(9).text().trim()) || null
            data.ry =
              Number($(el).find('td').eq(10).text().replace(',', '').trim()) ||
              null
            data.tdr = Number($(el).find('td').eq(11).text().trim()) || null
          } else if (pos === 'TE') {
            data.rec = Number($(el).find('td').eq(4).text().trim()) || null
            data.recy =
              Number($(el).find('td').eq(5).text().replace(',', '').trim()) ||
              null
            data.tdrec = Number($(el).find('td').eq(6).text().trim()) || null
          } else if (pos === 'WR') {
            data.rec = Number($(el).find('td').eq(4).text().trim()) || null
            data.recy =
              Number($(el).find('td').eq(5).text().replace(',', '').trim()) ||
              null
            data.tdrec = Number($(el).find('td').eq(6).text().trim()) || null

            data.ra = Number($(el).find('td').eq(7).text().trim()) || null
            data.ry =
              Number($(el).find('td').eq(8).text().replace(',', '').trim()) ||
              null
            data.tdr = Number($(el).find('td').eq(9).text().trim()) || null
          } else if (pos === 'RB') {
            data.ra = Number($(el).find('td').eq(4).text().trim()) || null
            data.ry =
              Number($(el).find('td').eq(5).text().replace(',', '').trim()) ||
              null
            data.tdr = Number($(el).find('td').eq(6).text().trim()) || null

            data.rec = Number($(el).find('td').eq(7).text().trim()) || null
            data.recy =
              Number($(el).find('td').eq(8).text().replace(',', '').trim()) ||
              null
            data.tdrec = Number($(el).find('td').eq(9).text().trim()) || null
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
      sourceid: constants.sources.FFTODAY,
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
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.FFTODAY })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

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
