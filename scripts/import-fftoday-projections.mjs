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

// fftoday's own statement that the requested season/week does not exist. It
// serves this on a 200 with no table at all, which is what makes "not published
// yet" separable from "the markup changed".
const NO_PLAYERS_SENTINEL = 'No Player Found!'

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
  if (current_season.week > current_season.nfl_final_week) {
    return { skipped: true }
  }

  const year = current_season.year
  const period = is_regular_season_projection
    ? projection_periods.SEASON
    : projection_periods.WEEK
  const week = current_season.active_fantasy_week

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

      // Zero rows on the FIRST page has two causes that must not be conflated;
      // on a later page it is just the end of the pagination.
      if (page === 0 && count === 0) {
        // fftoday answers a season/week it has not published yet with a 200
        // carrying an explicit sentinel instead of an empty table, so the two
        // cases are distinguishable at the source. Matching a vendor's literal
        // string is normally a trap, but it fails SAFE here: a reworded
        // sentinel stops matching, falls through, and throws.
        const upstream_reports_no_players =
          $.html().includes(NO_PLAYERS_SENTINEL)

        // A weekly slice is legitimately absent in the offseason -- fftoday
        // publishes week N shortly before week N's games. This is the same
        // judgment check_projections_index_floor already makes, on the same
        // predicate, and deliberately stops excusing the absence once
        // is_offseason turns false (the Tuesday before the week 1 opener), so a
        // genuine fftoday outage is still caught before week 1 is played.
        if (
          upstream_reports_no_players &&
          !is_regular_season_projection &&
          current_season.is_offseason
        ) {
          console.log(
            `fftoday has not published ${year} week ${week} weekly projections yet; skipping (offseason)`
          )
          return { skipped: true }
        }

        throw_if_shortfall(
          upstream_reports_no_players
            ? `fftoday projections: upstream reports no players for season ${year} week ${week} position ${position} (${url})`
            : `fftoday projections: parsed 0 rows for position ${position} (${url})`
        )
      }

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

    inserts.push({ pid: player_row.pid, ...data })
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
    await save_projections({
      period,
      inserts,
      source_id: external_data_sources.FFTODAY,
      season_year: year,
      week,
      generated_at
    })
  }

  return {
    skipped: false,
    season_year: year,
    week,
    source_id: external_data_sources.FFTODAY,
    season_type: 'REG'
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
      await (argv.season
        ? check_season_projections_floor(result)
        : check_projections_index_floor(result))
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_FFTODAY,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
