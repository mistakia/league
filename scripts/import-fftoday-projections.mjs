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

const getURL = ({
  position,
  page,
  is_regular_season_projection,
  year,
  week
}) =>
  is_regular_season_projection
    ? `https://www.fftoday.com/rankings/playerproj.php?Season=${year}&PosID=${position}&LeagueID=&order_by=FFPts&sort_order=DESC&cur_page=${page}`
    : `https://www.fftoday.com/rankings/playerwkproj.php?Season=${year}&GameWeek=${week}&PosID=${position}&LeagueID=&order_by=FFPts&sort_order=DESC&cur_page=${page}`

const positions = {
  10: 'QB',
  20: 'RB',
  30: 'WR',
  40: 'TE'
}

// Parsing functions for different projection types
const parse_regular_season_data = (pos, $, el) => {
  const data = {}

  if (pos === 'QB') {
    data.passing_attempts = Number($(el).find('td').eq(5).text().trim()) || null
    data.passing_completions =
      Number($(el).find('td').eq(4).text().trim()) || null
    data.passing_yards =
      Number($(el).find('td').eq(6).text().replace(',', '').trim()) || null
    data.passing_touchdowns =
      Number($(el).find('td').eq(7).text().trim()) || null
    data.passing_interceptions =
      Number($(el).find('td').eq(8).text().trim()) || null

    data.rushing_attempts = Number($(el).find('td').eq(9).text().trim()) || null
    data.rushing_yards =
      Number($(el).find('td').eq(10).text().replace(',', '').trim()) || null
    data.rushing_touchdowns =
      Number($(el).find('td').eq(11).text().trim()) || null
  } else if (pos === 'RB') {
    data.rushing_attempts = Number($(el).find('td').eq(4).text().trim()) || null
    data.rushing_yards =
      Number($(el).find('td').eq(5).text().replace(',', '').trim()) || null
    data.rushing_touchdowns =
      Number($(el).find('td').eq(6).text().trim()) || null

    data.receptions = Number($(el).find('td').eq(7).text().trim()) || null
    data.receiving_yards =
      Number($(el).find('td').eq(8).text().replace(',', '').trim()) || null
    data.receiving_touchdowns =
      Number($(el).find('td').eq(9).text().trim()) || null
  } else if (pos === 'WR') {
    data.receptions = Number($(el).find('td').eq(4).text().trim()) || null
    data.receiving_yards =
      Number($(el).find('td').eq(5).text().replace(',', '').trim()) || null
    data.receiving_touchdowns =
      Number($(el).find('td').eq(6).text().trim()) || null

    data.rushing_attempts = Number($(el).find('td').eq(7).text().trim()) || null
    data.rushing_yards =
      Number($(el).find('td').eq(8).text().replace(',', '').trim()) || null
    data.rushing_touchdowns =
      Number($(el).find('td').eq(9).text().trim()) || null
  } else if (pos === 'TE') {
    data.receptions = Number($(el).find('td').eq(4).text().trim()) || null
    data.receiving_yards =
      Number($(el).find('td').eq(5).text().replace(',', '').trim()) || null
    data.receiving_touchdowns =
      Number($(el).find('td').eq(6).text().trim()) || null
  }

  return data
}

const parse_week_data = (pos, $, el) => {
  const data = {}

  if (pos === 'QB') {
    // QB parsing remains the same for week projections
    data.passing_attempts = Number($(el).find('td').eq(5).text().trim()) || null
    data.passing_completions =
      Number($(el).find('td').eq(4).text().trim()) || null
    data.passing_yards =
      Number($(el).find('td').eq(6).text().replace(',', '').trim()) || null
    data.passing_touchdowns =
      Number($(el).find('td').eq(7).text().trim()) || null
    data.passing_interceptions =
      Number($(el).find('td').eq(8).text().trim()) || null

    data.rushing_attempts = Number($(el).find('td').eq(9).text().trim()) || null
    data.rushing_yards =
      Number($(el).find('td').eq(10).text().replace(',', '').trim()) || null
    data.rushing_touchdowns =
      Number($(el).find('td').eq(11).text().trim()) || null
  } else if (pos === 'RB' || pos === 'WR' || pos === 'TE') {
    // For week projections, RB/WR/TE follow the order:
    // rush attempts, rush yards, rush TDs, receptions, receiving yards, receiving TDs
    data.rushing_attempts = Number($(el).find('td').eq(4).text().trim()) || null
    data.rushing_yards =
      Number($(el).find('td').eq(5).text().replace(',', '').trim()) || null
    data.rushing_touchdowns =
      Number($(el).find('td').eq(6).text().trim()) || null

    data.receptions = Number($(el).find('td').eq(7).text().trim()) || null
    data.receiving_yards =
      Number($(el).find('td').eq(8).text().replace(',', '').trim()) || null
    data.receiving_touchdowns =
      Number($(el).find('td').eq(9).text().trim()) || null
  }

  return data
}

const run = async ({
  dry = false,
  is_regular_season_projection = false
} = {}) => {
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nflFinalWeek) {
    return { skipped: true }
  }

  const year = current_season.year
  const week = is_regular_season_projection
    ? 0
    : Math.max(current_season.week, 1)

  const missing = []
  const items = []
  for (const position of Object.keys(positions)) {
    let count = 50
    let page = 0
    while (count === 50) {
      const url = getURL({
        position,
        page,
        is_regular_season_projection,
        year,
        week
      })
      log(url)
      const $ = await fetch_cheerio(url)
      count = $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').length
      $('table tr table tr tr:not(.tablehdr):not(.tableclmhdr)').each(
        (i, el) => {
          const name = $(el).find('td').eq(1).text().trim()
          const team = $(el).find('td').eq(2).text().trim()
          const pos = positions[position]
          const params = { name, team, pos }

          // Use appropriate parsing function based on projection type
          const data = is_regular_season_projection
            ? parse_regular_season_data(pos, $, el)
            : parse_week_data(pos, $, el)

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
      season_year: year,
      season_type: 'REG',
      sourceid: external_data_sources.FFTODAY,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry) {
    // Shuffle the inserts array to get random elements
    const shuffled_inserts = inserts.sort(() => 0.5 - Math.random())

    // Select 10 random inserts or all if less than 10
    const random_inserts = shuffled_inserts.slice(0, 10)

    log('10 Random Inserts:')
    for (const insert of random_inserts) {
      log(insert)
    }
    return
  }
  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        season_year: year,
        week,
        sourceid: external_data_sources.FFTODAY,
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

  return {
    skipped: false,
    year,
    week,
    sourceid: external_data_sources.FFTODAY,
    seas_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({
      dry: argv.dry,
      is_regular_season_projection: argv.season
    })
    if (result && !result.skipped && !argv.dry) {
      await check_projections_index_floor(result)
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_FFTODAY,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
