import fetch_cheerio from '#libs-server/fetch-cheerio.mjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  check_projections_index_floor
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
debug.enable('import:projections,get-player')

const generated_at = new Date()
const year = current_season.year
const getURL = (week, offset) =>
  week === 0
    ? `https://fantasy.nfl.com/research/projections?position=O&sort=projectedPts&statCategory=projectedStats&statSeason=${year}&statType=seasonProjectedStats&offset=${
        offset + 1
      }`
    : `https://fantasy.nfl.com/research/projections?position=O&sort=projectedPts&statCategory=projectedStats&statSeason=${year}&statType=weekProjectedStats&statWeek=${week}&offset=${
        offset + 1
      }`

const runOne = async ({ week = 0, dry = false } = {}) => {
  const missing = []
  const items = []

  let lastProjection = 1
  while (lastProjection > 0) {
    const url = getURL(week, items.length)
    log(url)
    const $ = await fetch_cheerio(url)
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
        data.passing_yards =
          parseFloat($(el).find('td').eq(3).text().trim()) || 0
        data.passing_touchdowns =
          parseFloat($(el).find('td').eq(4).text().trim()) || 0
        data.passing_interceptions =
          parseFloat($(el).find('td').eq(5).text().trim()) || 0

        // rushing
        data.rushing_yards =
          parseFloat($(el).find('td').eq(6).text().trim()) || 0
        data.rushing_touchdowns =
          parseFloat($(el).find('td').eq(7).text().trim()) || 0
        data.fumbles_lost =
          parseFloat($(el).find('td').eq(14).text().trim()) || 0

        // receiving
        data.receptions = parseFloat($(el).find('td').eq(8).text().trim()) || 0
        data.receiving_yards =
          parseFloat($(el).find('td').eq(9).text().trim()) || 0
        data.receiving_touchdowns =
          parseFloat($(el).find('td').eq(10).text().trim()) || 0

        data.two_point_conversions =
          parseFloat($(el).find('td').eq(13).text().trim()) || 0

        items.push({ params, data })
        lastProjection = parseFloat($(el).find('td').eq(15).text().trim())
      } else {
        // passing
        data.passing_yards =
          parseFloat($(el).find('td').eq(2).text().trim()) || 0
        data.passing_touchdowns =
          parseFloat($(el).find('td').eq(3).text().trim()) || 0
        data.passing_interceptions =
          parseFloat($(el).find('td').eq(4).text().trim()) || 0

        // rushing
        data.rushing_yards =
          parseFloat($(el).find('td').eq(5).text().trim()) || 0
        data.rushing_touchdowns =
          parseFloat($(el).find('td').eq(6).text().trim()) || 0
        data.fumbles_lost =
          parseFloat($(el).find('td').eq(13).text().trim()) || 0

        // receiving
        data.receptions = parseFloat($(el).find('td').eq(7).text().trim()) || 0
        data.receiving_yards =
          parseFloat($(el).find('td').eq(8).text().trim()) || 0
        data.receiving_touchdowns =
          parseFloat($(el).find('td').eq(9).text().trim()) || 0

        data.two_point_conversions =
          parseFloat($(el).find('td').eq(12).text().trim()) || 0

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
      season_type: 'REG',
      season_year: year,
      sourceid: external_data_sources.NFL,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        season_year: year,
        week,
        sourceid: external_data_sources.NFL,
        season_type: 'REG'
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict([
        'sourceid',
        'pid',
        'userid',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, generated_at })))
  }
}

const run = async ({ season = false, dry = false } = {}) => {
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nflFinalWeek) {
    return { skipped: true }
  }

  if (season) {
    await runOne({ week: 0, dry })
  }

  const start_week = Math.max(1, current_season.week)
  for (let week = start_week; week <= current_season.finalWeek; week++) {
    await runOne({ week, dry })
  }

  return {
    skipped: false,
    year,
    week: season ? 0 : start_week,
    sourceid: external_data_sources.NFL,
    seas_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({ season: argv.season, dry: argv.dry })
    if (result && !result.skipped && !argv.dry) {
      await check_projections_index_floor(result)
    }
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
