import fetchCheerioObject from 'fetch-cheerio-object'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, find_player_row, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')

const timestamp = Math.round(Date.now() / 1000)
const year = constants.season.year
const getURL = (week, offset) =>
  week === 0
    ? `https://fantasy.nfl.com/research/projections?position=O&sort=projectedPts&statCategory=projectedStats&statSeason=${year}&statType=seasonProjectedStats&offset=${
        offset + 1
      }`
    : `https://fantasy.nfl.com/research/projections?position=O&sort=projectedPts&statCategory=projectedStats&statSeason=${year}&statType=weekProjectedStats&statWeek=${week}&offset=${
        offset + 1
      }`

const runOne = async (week = 0) => {
  const missing = []
  const items = []

  let lastProjection = 1
  while (lastProjection > 0) {
    const url = getURL(week, items.length)
    log(url)
    const $ = await fetchCheerioObject(url)
    $('table.tableType-player tbody tr').each((i, el) => {
      const name = $(el, 'td')
        .eq(0)
        .find('a')
        .text()
        .trim()
        .replace('View News', '')
      const meta = $(el, 'td').eq(0).find('em').text().split('-')
      const pos = meta.shift().trim()
      const team = meta.pop()

      const params = { name, team: team && team.trim(), pos }
      const data = {}

      if (week === 0) {
        // passing
        data.py = parseFloat($(el).find('td').eq(3).text().trim()) || 0
        data.tdp = parseFloat($(el).find('td').eq(4).text().trim()) || 0
        data.ints = parseFloat($(el).find('td').eq(5).text().trim()) || 0

        // rushing
        data.ry = parseFloat($(el).find('td').eq(6).text().trim()) || 0
        data.tdr = parseFloat($(el).find('td').eq(7).text().trim()) || 0
        data.fuml = parseFloat($(el).find('td').eq(14).text().trim()) || 0

        // receiving
        data.rec = parseFloat($(el).find('td').eq(8).text().trim()) || 0
        data.recy = parseFloat($(el).find('td').eq(9).text().trim()) || 0
        data.tdrec = parseFloat($(el).find('td').eq(10).text().trim()) || 0

        data.twoptc = parseFloat($(el).find('td').eq(13).text().trim()) || 0

        items.push({ params, data })
        lastProjection = parseFloat($(el).find('td').eq(15).text().trim())
      } else {
        // passing
        data.py = parseFloat($(el).find('td').eq(2).text().trim()) || 0
        data.tdp = parseFloat($(el).find('td').eq(3).text().trim()) || 0
        data.ints = parseFloat($(el).find('td').eq(4).text().trim()) || 0

        // rushing
        data.ry = parseFloat($(el).find('td').eq(5).text().trim()) || 0
        data.tdr = parseFloat($(el).find('td').eq(6).text().trim()) || 0
        data.fuml = parseFloat($(el).find('td').eq(13).text().trim()) || 0

        // receiving
        data.rec = parseFloat($(el).find('td').eq(7).text().trim()) || 0
        data.recy = parseFloat($(el).find('td').eq(8).text().trim()) || 0
        data.tdrec = parseFloat($(el).find('td').eq(9).text().trim()) || 0

        data.twoptc = parseFloat($(el).find('td').eq(12).text().trim()) || 0

        items.push({ params, data })
        lastProjection = parseFloat($(el).find('td').eq(14).text().trim())
      }
    })
  }

  const inserts = []
  for (const { params, data } of items) {
    let player_row

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
      seas_type: 'REG',
      year,
      sourceid: constants.sources.NFL,
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
      .where({ year, week, sourceid: constants.sources.NFL, seas_type: 'REG' })
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

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  if (argv.season) {
    await runOne()
  }

  let week = Math.max(1, constants.season.week)
  for (; week <= constants.season.finalWeek; week++) {
    await runOne(week)
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
    job_type: job_types.PROJECTIONS_NFL,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
