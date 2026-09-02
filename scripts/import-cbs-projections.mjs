import fetch_cheerio from '#libs-server/fetch-cheerio.mjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  check_projections_index_floor,
  check_season_projections_floor,
  save_projections,
  projection_periods
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

// CBS states the board's own season in the page heading -- "2026 Projections
// Fantasy Football Quarterback Stats" -- and that heading is the ONLY part of
// the response that reflects which slice was actually served. Measured
// 2026-09-02: the year and week segments of the URL are both decorative. QB
// 2027, 2030, week 25 and week 99 all answer 200 with the identical 69-row 2026
// season-long board, so a request for a slice CBS has not opened is not an
// empty table -- it is last season's numbers wearing this season's label.
const board_season_year = ($) => {
  const heading = $('h1').first().text().trim()
  const match = heading.match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

const run = async ({ season = false, dry = false } = {}) => {
  const period = season ? projection_periods.SEASON : projection_periods.WEEK
  const week = current_season.active_fantasy_week
  const type = season ? 'season' : week

  // CBS publishes no weekly projection board at all. The week segment of the
  // URL is decorative -- week 1, week 25 and week 99 return the same
  // season-long table -- and unlike the year, the page carries no week marker,
  // so there is nothing to verify a weekly slice against. Running this path
  // does not fail; it writes full-season totals into week-N weekly rows, which
  // is why it must refuse rather than proceed.
  //
  // No such rows were ever written, so there is nothing to repair: the weekly
  // cron line in server/crontab-main/league-imports.cron has been commented out
  // since well before CBS's URL semantics went decorative, and the newest CBS
  // weekly slice in projections_index is 2023 week 4, whose passing yardage
  // maxima are in the 300s rather than the 4000s a season board would carry.
  // That commented line was load-bearing safety nobody had identified as such.
  if (!season) {
    throw new Error(
      'cbs projections: CBS publishes no weekly board -- the week segment of the URL is ignored and the page returns season-long totals, so a weekly run would write season numbers as week projections. Use --season.'
    )
  }
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

    // Which season CBS actually served, which is not necessarily the one asked
    // for. Reading a vendor's heading is normally a trap, but it fails SAFE in
    // both directions here: a redesign that drops or rewords the heading yields
    // null and throws below, and a heading that still parses but reports the
    // wrong year is precisely the case worth catching.
    const served_year = board_season_year($)

    if (served_year === null) {
      throw_if_shortfall(
        `cbs projections: could not read the board season from the page heading for ${position} (${url})`
      )
    }

    // CBS has not opened the requested season yet, so it is still serving the
    // previous board. Not a failure, and not something this importer can
    // predict -- CBS gives no notice of when it rolls over, so no date or
    // season phase can be put on it. Skipping is what keeps last season's
    // numbers from being written under this season's label; the season cron
    // runs every day in months 5-8, so the next run takes it as soon as the
    // board turns over.
    if (served_year < year) {
      console.log(
        `cbs has not published ${year} projections yet (still serving ${served_year}); nothing to import, skipping`
      )
      return { skipped: true, unpublished: true }
    }

    // A board AHEAD of the requested season is not a slice CBS declined to
    // publish -- it is this importer asking for the wrong year, and importing
    // it would file next season's numbers under this one.
    if (served_year > year) {
      throw_if_shortfall(
        `cbs projections: requested ${year} but CBS served the ${served_year} board for ${position} (${url})`
      )
    }

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
    // or changed shape. There is deliberately no "upstream published nothing"
    // arm here, because CBS has no such state: it answers every slice, valid or
    // not, with a full board. An unopened season is caught above by the heading
    // year instead, so the only way to reach a zero row count with a heading
    // that parses and matches is a markup change. Adding a skip arm would mean
    // inventing a signal the vendor does not send.
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

    inserts.push({ pid: player_row.pid, ...data })
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
    await save_projections({
      period,
      inserts,
      source_id: external_data_sources.CBS,
      season_year: year,
      week,
      generated_at
    })
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
      await (argv.season
        ? check_season_projections_floor(result)
        : check_projections_index_floor(result))
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_CBS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
