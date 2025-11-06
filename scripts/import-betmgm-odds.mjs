import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  betmgm,
  insert_prop_markets,
  find_player_row,
  report_job
} from '#libs-server'
import { normalize_selection_metric_line } from '#libs-server/normalize-selection-metric-line.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-betmgm-odds')
debug.enable('import-betmgm-odds,get-player,betmgm,insert-prop-markets')

const team_name_re = /\(([^)]+)\)/

const format_game_market = async ({
  betmgm_market,
  timestamp,
  nfl_game,
  fixture
}) => {
  const selections = []

  const open = betmgm_market.visibility === 'Visible'

  for (const result of betmgm_market.results) {
    selections.push({
      source_id: 'BETMGM',
      source_market_id: betmgm_market.id,
      source_selection_id: result.id,

      selection_pid: null, // TODO
      selection_name: result.name.value,
      selection_metric_line: null, // TODO
      odds_decimal: result.odds,
      odds_american: result.americanOdds
    })
  }

  return {
    market_type: null, // TODO

    source_id: 'BETMGM',
    source_market_id: betmgm_market.id,
    source_market_name: `${betmgm_market.name.value} (templateId: ${betmgm_market.templateId}, catgeoryId: ${betmgm_market.categoryId})`,

    esbid: nfl_game?.esbid || null,
    source_event_id: fixture.id,
    source_event_name: fixture.name.value,

    open,
    live: null,
    selection_count: betmgm_market.results.length,

    timestamp,
    selections
  }
}

const format_option_market = async ({
  betmgm_market,
  timestamp,
  nfl_game,
  fixture
}) => {
  const selections = []
  let player_row

  const open = betmgm_market.status === 'Visible'

  if (betmgm_market.player1) {
    const team_re_matches = team_name_re.exec(betmgm_market.player1.value)
    const params = {
      name: betmgm_market.player1.short,
      team: team_re_matches ? team_re_matches[1] : null,
      ignore_free_agent: true,
      ignore_retired: true
    }
    try {
      player_row = await find_player_row(params)
    } catch (err) {
      log(err)
    }
  }

  for (const option of betmgm_market.options) {
    let selection_name = null
    let selection_line = null

    if (option.name.value.includes('Over')) {
      selection_name = 'over'
    } else if (option.name.value.includes('Under')) {
      selection_name = 'under'
    } else {
      selection_name = option.name.value
    }

    if (selection_name) {
      selection_line = Number(option.name.value.replace(/[a-zA-Z]/g, ''))
    }

    // Normalize the line for N+ discrete stat markets
    selection_line = normalize_selection_metric_line({
      raw_value: selection_line,
      selection_name: option.name.value
    })

    selections.push({
      source_id: 'BETMGM',
      source_market_id: betmgm_market.id,
      source_selection_id: option.id,

      selection_pid: player_row?.pid || null,
      selection_name: option.name.value,
      selection_metric_line: selection_line,
      odds_decimal: option.price.odds,
      odds_american: option.price.americanOdds
    })
  }

  const templateId = betmgm_market.parameters.find(
    (param) => param.key === 'TemplateId'
  )?.value

  return {
    market_type: null, // TODO use name and templateId

    source_id: 'BETMGM',
    source_market_id: betmgm_market.id,
    source_market_name: `${betmgm_market.name.value} (templateId: ${
      templateId || ''
    })`,

    esbid: nfl_game?.esbid || null,
    source_event_id: fixture.id,
    source_event_name: fixture.name.value,

    open,
    live: null,
    selection_count: betmgm_market.options.length,

    timestamp,
    selections
  }
}

const import_betmgm_odds = async ({
  write_file = false,
  dry_run = false
} = {}) => {
  console.time('import-betmgm-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const all_markets = []
  const formatted_markets = []

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const { fixtures } = await betmgm.get_markets()

  log(`Found ${fixtures.length} fixtures`)

  for (const fixture of fixtures) {
    let nfl_game = null

    if (fixture.name?.value?.includes(' at ')) {
      const event_name_split = fixture.name.value.split(' at ')
      const visitor = fixTeam(
        event_name_split[0].replace(/\(.*?\)/g, '').trim()
      )
      const home = fixTeam(event_name_split[1].replace(/\(.*?\)/g, '').trim())
      const { week, seas_type } = constants.season.calculate_week(
        dayjs(fixture.startDate)
      )
      nfl_game = nfl_games.find(
        (game) =>
          game.week === week &&
          game.seas_type === seas_type &&
          game.year === constants.season.year &&
          game.v === visitor &&
          game.h === home
      )
    }

    for (const game_market of fixture.games) {
      all_markets.push(game_market)
      formatted_markets.push(
        await format_game_market({
          betmgm_market: game_market,
          timestamp,
          nfl_game,
          fixture
        })
      )
    }

    for (const option_market of fixture.optionMarkets) {
      all_markets.push(option_market)
      formatted_markets.push(
        await format_option_market({
          betmgm_market: option_market,
          timestamp,
          nfl_game,
          fixture
        })
      )
    }
  }

  if (write_file) {
    await fs.writeFile(
      `./tmp/betmgm-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
    await fs.writeFile(
      `./tmp/betmgm-formatted-markets-${timestamp}.json`,
      JSON.stringify(formatted_markets, null, 2)
    )
  }

  if (dry_run) {
    log(formatted_markets[0])
    console.timeEnd('import-betmgm-odds')
    return
  }

  if (formatted_markets.length) {
    log(`inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-betmgm-odds')
}

export const job = async () => {
  let error
  try {
    await import_betmgm_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.BETMGM_ODDS,
    error
  })
}

const main = async () => {
  await import_betmgm_odds({
    write_file: argv.write,
    dry_run: argv.dry
  })
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_betmgm_odds
