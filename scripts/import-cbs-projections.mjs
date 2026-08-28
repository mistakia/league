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
  check_projections_index_floor,
  record_projection_history
} from '#libs-server'
import throw_if_shortfall from '#libs-server/throw-if-shortfall.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
enable_debug_namespaces('import:projections,get-player')

const year = current_season.year
const generated_at = new Date()
const getUrl = (pos, type) =>
  `https://www.cbssports.com/fantasy/football/stats/${pos}/${year}/${type}/projections/ppr/`

const positions = ['QB', 'RB', 'WR', 'TE']

const run = async ({ season = false, dry = false } = {}) => {
  const week = season ? 0 : current_season.active_fantasy_week
  const type = season ? 'season' : week
  // do not pull in any projections after the season has ended
  if (
    type !== 'season' &&
    current_season.week > current_season.nfl_final_week
  ) {
    return { skipped: true }
  }

  if (type === 'season' && current_season.week > 0) {
    return { skipped: true }
  }

  const missing = []
  const items = []
  for (const position of positions) {
    const url = getUrl(position, type)
    log(url)
    const $ = await fetch_cheerio(url)
    const row_count_before = items.length
    // CBS renders one table per stat page; it sat inside <main> until a 2025
    // redesign moved it out, which silently zeroed this import for a year.
    $('.TableBase table tbody tr').each((i, el) => {
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
        ignore_retired: year === current_season.year
      }
      const data = {}

      if (position === 'QB') {
        data.passing_attempts = $(el).find('td').eq(2).text().trim()
        data.passing_completions = $(el).find('td').eq(3).text().trim()
        data.passing_yards = $(el).find('td').eq(4).text().trim()
        data.passing_touchdowns = $(el).find('td').eq(6).text().trim()
        data.passing_interceptions = $(el).find('td').eq(7).text().trim()

        data.rushing_attempts = $(el).find('td').eq(9).text().trim()
        data.rushing_yards = $(el).find('td').eq(10).text().trim()
        data.rushing_touchdowns = $(el).find('td').eq(12).text().trim()
        data.fumbles_lost = $(el).find('td').eq(13).text().trim()
      } else if (position === 'TE') {
        data.targets = $(el).find('td').eq(2).text().trim()
        data.receptions = $(el).find('td').eq(3).text().trim()
        data.receiving_yards = $(el).find('td').eq(4).text().trim()
        data.receiving_touchdowns = $(el).find('td').eq(7).text().trim()
        data.fumbles_lost = $(el).find('td').eq(8).text().trim()
      } else if (position === 'WR') {
        data.targets = $(el).find('td').eq(2).text().trim()
        data.receptions = $(el).find('td').eq(3).text().trim()
        data.receiving_yards = $(el).find('td').eq(4).text().trim()
        data.receiving_touchdowns = $(el).find('td').eq(7).text().trim()

        data.rushing_attempts = $(el).find('td').eq(8).text().trim()
        data.rushing_yards = $(el).find('td').eq(9).text().trim()
        data.rushing_touchdowns = $(el).find('td').eq(11).text().trim()
        data.fumbles_lost = $(el).find('td').eq(12).text().trim()
      } else if (position === 'RB') {
        data.rushing_attempts = $(el).find('td').eq(2).text().trim()
        data.rushing_yards = $(el).find('td').eq(3).text().trim()
        data.rushing_touchdowns = $(el).find('td').eq(5).text().trim()

        data.targets = $(el).find('td').eq(6).text().trim()
        data.receptions = $(el).find('td').eq(7).text().trim()
        data.receiving_yards = $(el).find('td').eq(8).text().trim()
        data.receiving_touchdowns = $(el).find('td').eq(11).text().trim()
        data.fumbles_lost = $(el).find('td').eq(12).text().trim()
      }

      items.push({ params, data })
    })

    // A parse that yields nothing is always a failure — the page either moved
    // or changed shape. check_projections_index_floor cannot catch it here,
    // because it short-circuits on current_season.is_offseason and the only live CBS cron is
    // the offseason season-projection run.
    throw_if_shortfall(
      items.length === row_count_before
        ? `cbs projections: parsed 0 rows for ${position} (${url})`
        : null
    )
  }

  const inserts = []
  for (const { params, data } of items) {
    let player_row

    // TODO cleanup
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
      source_id: external_data_sources.CBS,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.teams.join(', ')}`)
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
        source_id: external_data_sources.CBS,
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
        'source_id',
        'pid',
        'user_id',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    await record_projection_history({ inserts, generated_at })
  }

  return {
    skipped: false,
    season_year: year,
    week,
    source_id: external_data_sources.CBS,
    season_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({
      season: argv.season,
      dry: argv.dry
    })
    if (result && !result.skipped && !argv.dry) {
      await check_projections_index_floor(result)
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_CBS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
