import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  getPlayer,
  caesars,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-caesars')
debug.enable('import-caesars,get-player,caesars,insert-prop-market')

const format_market = async ({
  caesars_market,
  timestamp,
  nfl_game,
  event,
  unknown_market_types
}) => {
  const selections = []
  let player_row
  let market_line

  if (caesars_market.metadata?.player) {
    const team = fixTeam(caesars_market.metadata.teamName.replaceAll('|', ''))
    const params = {
      name: caesars_market.metadata.player,
      team,
      ignore_free_agent: true,
      ignore_retired: true
    }

    try {
      player_row = await getPlayer(params)
    } catch (err) {
      log(err)
    }
  }

  if (caesars_market.line) {
    market_line = Number(caesars_market.line)
  } else if (caesars_market.metadata?.line) {
    market_line = Number(caesars_market.metadata.line)
  } else if (
    caesars_market.type === 'over-under' &&
    caesars_market.metadata?.overUnderLine
  ) {
    market_line = Number(caesars_market.metadata.overUnderLine)
  }

  let selection_counter = 0
  for (const selection of caesars_market.selections) {
    if (!selection.price) {
      continue
    }

    let selection_name = null
    let selection_line = market_line || null

    if (selection.type === 'over') {
      selection_name = 'over'
    } else if (selection.type === 'under') {
      selection_name = 'under'
    } else {
      selection_name = selection.name.replaceAll('|', '')
      const alt_line_regex = /^\d+\+$/
      const is_alt_line = alt_line_regex.test(selection_name)

      if (!selection_line && is_alt_line) {
        selection_line = Number(selection_name.replace('+', '')) - 0.5
        selection_name = 'over'
      }

      if (caesars_market.type === 'two-way-handicap') {
        if (selection_counter === 0) {
          selection_line = -market_line
        } else if (selection_counter === 1) {
          selection_line = market_line
        }
        selection_counter++
      }
    }

    // if (!player_row) {
    //   try {
    //     player_row = await getPlayer({
    //       name: selection.name.replaceAll('|', ''),
    //       ignore_free_agent: true,
    //       ignore_retired: true
    //     })
    //   } catch (err) {
    //     log(err)
    //   }
    // }

    selections.push({
      source_id: 'CAESARS',
      source_market_id: caesars_market.id,
      source_selection_id: selection.id,

      selection_pid: player_row?.pid || null,
      selection_name,
      selection_metric_line: selection_line,
      odds_decimal: selection.price.d,
      odds_american: selection.price.a
    })
  }

  const market_type = caesars.get_market_type({
    market_name: caesars_market.name,
    template_name: caesars_market.templateName,
    market_category: caesars_market.metadata?.marketCategory
  })

  if (!market_type) {
    unknown_market_types.add(
      JSON.stringify({
        template_name: caesars_market.templateName,
        market_category: caesars_market.metadata?.marketCategory
      })
    )
  }

  return {
    market_type,

    source_id: 'CAESARS',
    source_market_id: caesars_market.id,
    source_market_name: `${event?.name.replaceAll(
      '|',
      ''
    )} - ${caesars_market.name.replaceAll(
      '|',
      ''
    )} — ${caesars_market.templateName.replaceAll('|', '')} — ${
      caesars_market.metadata?.marketCategory || ''
    }`,

    esbid: nfl_game?.esbid || null,
    source_event_id: event?.id || null,
    source_event_name: event?.name.replaceAll('|', '') || null,

    open: caesars_market.active,
    live: null,
    selection_count: caesars_market.selections.length,

    timestamp,
    selections
  }
}

const calculate_sets = ({ market, unique_sets, groupings }) => {
  unique_sets.template_id.add(market.templateId)
  unique_sets.template_name.add(market.templateName)
  unique_sets.template_type.add(market.templateType)
  unique_sets.display_name.add(market.displayName)

  if (market.metadata) {
    unique_sets.market_category.add(market.metadata.marketCategory)
    unique_sets.market_type.add(market.metadata.marketType)
    unique_sets.market_code.add(market.metadata.marketCode)
    unique_sets.market_category_name.add(market.metadata.marketCategoryName)

    // Add to groupings
    const market_code = market.metadata.marketCode
    const market_category = market.metadata.marketCategory
    if (market_code) {
      if (!groupings.template_name_by_market_code[market_code]) {
        groupings.template_name_by_market_code[market_code] = new Set()
      }
      groupings.template_name_by_market_code[market_code].add(
        market.templateName
      )

      if (!groupings.market_category_by_market_code[market_code]) {
        groupings.market_category_by_market_code[market_code] = new Set()
      }
      groupings.market_category_by_market_code[market_code].add(market_category)

      if (!groupings.market_category_name_by_market_code[market_code]) {
        groupings.market_category_name_by_market_code[market_code] = new Set()
      }
      groupings.market_category_name_by_market_code[market_code].add(
        market.metadata.marketCategoryName
      )
    }

    if (market_category) {
      if (!groupings.template_name_by_market_category[market_category]) {
        groupings.template_name_by_market_category[market_category] = new Set()
      }
      groupings.template_name_by_market_category[market_category].add(
        market.templateName
      )
    }
  }
}

const run = async ({
  ignore_cache = false,
  dry_run = false,
  write_file = false,
  ignore_wait = false,
  skip_futures = false
} = {}) => {
  log({
    ignore_cache,
    dry_run,
    write_file,
    ignore_wait
  })
  console.time('import-caesars-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const session_headers = await caesars.get_caesars_session()
  log(session_headers)

  const unknown_market_types = new Set()
  const missing = []
  const formatted_markets = []
  const all_markets = []

  const futures = await caesars.get_futures({ ignore_cache })

  if (
    !skip_futures &&
    futures &&
    futures.competitions &&
    futures.competitions.length
  ) {
    for (const event of futures.competitions[0].events) {
      for (const market of event.markets) {
        all_markets.push(market)
        formatted_markets.push(
          await format_market({
            caesars_market: market,
            timestamp,
            event,
            unknown_market_types
          })
        )
      }
    }
  }

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const schedule = await caesars.get_schedule({ ignore_cache })
  const { events } = schedule.competitions[0]

  log(`Found ${events.length} events`)

  if (write_file) {
    const file_name = `./tmp/caesars-schedule-${timestamp}.json`
    log(`Writing schedule to ${file_name}`)
    await fs.writeFile(file_name, JSON.stringify(schedule, null, 2))
  }

  if (!ignore_wait) {
    await wait(10000)
  }

  // filter events to only include games that are for the current week
  const filtered_events = events.filter((event) => {
    const event_start = dayjs(event.startTime)
    return event_start.isBefore(constants.season.week_end)
  })

  log(`Getting odds for ${filtered_events.length} events`)

  const unique_sets = {
    template_id: new Set(),
    template_name: new Set(),
    template_type: new Set(),
    display_name: new Set(),
    market_category: new Set(),
    market_type: new Set(),
    market_code: new Set(),
    market_category_name: new Set()
  }

  const groupings = {
    template_name_by_market_code: {},
    market_category_by_market_code: {},
    market_category_name_by_market_code: {},
    template_name_by_market_category: {}
  }

  for (const event of filtered_events) {
    console.time(`caesars-event-${event.id}`)
    const event_odds = await caesars.get_event({
      event_id: event.id,
      ignore_cache
    })

    let nfl_game = null

    if (event?.type === 'MATCH') {
      if (!event.name.includes('|at|')) {
        log(`Could not parse event name: ${event.name}`)
      } else {
        try {
          const event_name_split = event.name.replaceAll('|', '').split(' at ')
          const event_date = dayjs(event.startTime).format('YYYY-MM-DD')
          nfl_game = nfl_games.find(
            (game) =>
              game.date === event_date &&
              game.year === constants.season.year &&
              game.v === fixTeam(event_name_split[0]) &&
              game.h === fixTeam(event_name_split[1])
          )
        } catch (err) {
          log(err)
          log('Could not find game for event', event.name)
        }
      }
    }

    for (const market of event_odds.markets) {
      calculate_sets({
        market,
        unique_sets,
        groupings
      })
      all_markets.push(market)
      formatted_markets.push(
        await format_market({
          caesars_market: market,
          timestamp,
          nfl_game,
          event,
          unknown_market_types
        })
      )
    }

    if (!ignore_wait) {
      await wait(10000)
    }

    console.timeEnd(`caesars-event-${event.id}`)
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.team}`))

  // Convert Sets to Arrays for easier JSON serialization
  const unique_sets_arrays = Object.fromEntries(
    Object.entries(unique_sets).map(([key, value]) => [key, Array.from(value)])
  )

  const groupings_arrays = Object.fromEntries(
    Object.entries(groupings).map(([key, value]) => [
      key,
      Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, Array.from(v)])
      )
    ])
  )

  if (write_file) {
    await fs.writeFile(
      `./tmp/caesars-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
    await fs.writeFile(
      `./tmp/caesars-formatted-markets-${timestamp}.json`,
      JSON.stringify(formatted_markets, null, 2)
    )

    await fs.writeFile(
      `./tmp/caesars-unique-sets-${timestamp}.json`,
      JSON.stringify(unique_sets_arrays, null, 2)
    )

    await fs.writeFile(
      `./tmp/caesars-groupings-${timestamp}.json`,
      JSON.stringify(groupings_arrays, null, 2)
    )

    await fs.writeFile(
      `./tmp/caesars-unknown-market-types-${timestamp}.json`,
      JSON.stringify(Array.from(unknown_market_types).map(JSON.parse), null, 2)
    )
  }

  if (dry_run) {
    log(formatted_markets[0])
    console.timeEnd('import-caesars-odds')
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-caesars-odds')
}

export const job = async ({
  ignore_cache = true,
  dry_run = false,
  write_file = false,
  ignore_wait = false,
  skip_futures = false
}) => {
  let error
  try {
    await run({
      ignore_cache,
      dry_run,
      write_file,
      ignore_wait,
      skip_futures
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.CAESARS_ODDS,
    error
  })
}

const main = async () => {
  await job({
    ignore_cache: argv.ignore_cache || false,
    dry_run: argv.dry,
    write_file: argv.write,
    ignore_wait: argv.ignore_wait,
    skip_futures: argv.skip_futures
  })
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
