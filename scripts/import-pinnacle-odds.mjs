import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import oddslib from 'oddslib'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  find_player_row,
  pinnacle,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv))
  .option('dry', {
    describe: 'Dry run - do not insert to database',
    type: 'boolean',
    default: false
  })
  .option('ignore-cache', {
    describe: 'Ignore cache and fetch fresh data',
    type: 'boolean',
    default: false
  })
  .option('ignore-wait', {
    describe: 'Ignore wait time between requests',
    type: 'boolean',
    default: false
  })
  .option('save', {
    describe: 'Save JSON files to tmp directory',
    type: 'boolean',
    default: false
  })
  .help('h')
  .alias('h', 'help').argv

const log = debug('import-pinnacle-odds')
debug.enable(
  'import-pinnacle-odds,pinnacle,get-player,insert-prop-market,insert-prop-market-selections'
)

const format_source_event_name = ({
  is_valid_matchup,
  away_team,
  home_team,
  pinnacle_matchup,
  pinnacle_matchup_special_category,
  pinnacle_matchup_special_description
}) => {
  if (is_valid_matchup) {
    return `${away_team} @ ${home_team}`
  }
  if (pinnacle_matchup.special) {
    return `${pinnacle_matchup_special_category} - ${pinnacle_matchup_special_description}`
  }
  return null
}

const process_market_odds = async (
  pinnacle_matchup,
  pinnacle_markets,
  timestamp,
  nfl_games,
  unmatched_markets,
  unmatched_combinations
) => {
  const formatted_markets = []

  for (const odds_data of pinnacle_markets) {
    // Convert odds structure to match expected format
    const market_selection_odds = odds_data.prices.map((price) => ({
      participantId: price.participantId || price.designation,
      price: price.price,
      points: price.points || null
    }))

    // Create market with odds metadata
    const extended_pinnacle_matchup = {
      ...pinnacle_matchup,
      pinnacle_odds_type: odds_data.type,
      pinnacle_odds_key: odds_data.key,
      is_alternate_pinnacle_market: odds_data.isAlternate || false
    }

    const formatted_market = await format_market({
      pinnacle_matchup: extended_pinnacle_matchup,
      market_selection_odds,
      timestamp,
      nfl_games,
      unmatched_markets,
      unmatched_combinations
    })

    formatted_markets.push(formatted_market)
  }

  return formatted_markets
}

const format_market = async ({
  pinnacle_matchup,
  market_selection_odds,
  timestamp,
  nfl_games = [],
  unmatched_markets,
  unmatched_combinations
}) => {
  let nfl_game
  const selections = []

  const source_market_id = `${pinnacle_matchup.id}/${pinnacle_matchup.pinnacle_odds_key}`

  // Extract home and away teams from market participants
  const participants = pinnacle_matchup.participants || []
  const home_team = participants.find((p) => p.alignment === 'home')?.name
  const away_team = participants.find((p) => p.alignment === 'away')?.name

  const is_valid_matchup =
    pinnacle_matchup.type === 'matchup' && home_team && away_team
  const teams = is_valid_matchup ? [fixTeam(home_team), fixTeam(away_team)] : []

  if (home_team && away_team) {
    const { week, seas_type } = constants.season.calculate_week(
      dayjs(pinnacle_matchup.startTime)
    )
    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.seas_type === seas_type &&
        game.year === constants.season.year &&
        game.v === fixTeam(away_team) &&
        game.h === fixTeam(home_team)
    )
  }

  const pinnacle_matchup_special_description =
    pinnacle_matchup.special?.description
  const pinnacle_matchup_special_category = pinnacle_matchup.special?.category

  let player_row = null
  if (
    pinnacle_matchup_special_category === 'Player Props' &&
    pinnacle_matchup_special_description
  ) {
    const player_name_string = pinnacle_matchup_special_description
      .split('(')[0]
      .trim()
    try {
      player_row = await find_player_row({
        name: player_name_string,
        teams,
        ignore_free_agent: true,
        ignore_retired: true
      })
    } catch (err) {
      log(err)
    }
  }

  for (const selection of market_selection_odds) {
    let pinnacle_matchup_participant
    let market_participant_name

    // For matchup markets, participants don't have IDs and should be matched by alignment
    if (pinnacle_matchup.type === 'matchup') {
      pinnacle_matchup_participant = pinnacle_matchup.participants.find(
        (p) => p.alignment === selection.participantId
      )
      market_participant_name = pinnacle_matchup_participant?.name
    } else {
      // For special markets, match by participant ID
      pinnacle_matchup_participant = pinnacle_matchup.participants.find(
        (p) => p.id === selection.participantId
      )
      market_participant_name = pinnacle_matchup_participant?.name
    }

    // filter some common non player values
    const filtered_name = market_participant_name
      ? market_participant_name.replace(/^(yes|no|over|under)$/i, '')
      : null

    const contains_alpha = filtered_name
      ? /[a-zA-Z]/.test(filtered_name)
      : false

    if (!player_row && filtered_name && contains_alpha) {
      const params = {
        name: filtered_name,
        teams,
        ignore_free_agent: true,
        ignore_retired: true
      }

      try {
        player_row = await find_player_row(params)
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        log(`could not find player: ${params.name} / ${params.teams}`)
      }
    }

    // Determine selection_pid based on market type
    let selection_pid = player_row?.pid || null

    // For team-based game markets (moneyline, spread), use team abbreviation as selection_pid
    if (pinnacle_matchup.type === 'matchup' && market_participant_name) {
      try {
        selection_pid = fixTeam(market_participant_name)
      } catch (err) {
        // If fixTeam fails, keep the original selection_pid
        log(
          `Failed to convert team name to abbreviation: ${market_participant_name}`
        )
      }
    }

    selections.push({
      source_id: 'PINNACLE',
      source_market_id,
      source_selection_id: selection.participantId,

      selection_pid,
      selection_name: market_participant_name,
      selection_metric_line: selection.points,
      selection_type: pinnacle.format_selection_type(market_participant_name),
      odds_decimal: oddslib.from('moneyline', selection.price).to('decimal'),
      odds_american: selection.price
    })
  }

  const market_type = pinnacle.get_market_type({
    is_alternate_pinnacle_market: pinnacle_matchup.is_alternate_pinnacle_market,
    pinnacle_matchup_type: pinnacle_matchup.type,
    pinnacle_matchup_units: pinnacle_matchup.units,
    pinnacle_special_description: pinnacle_matchup_special_description,
    pinnacle_special_category: pinnacle_matchup_special_category,
    pinnacle_odds_type: pinnacle_matchup.pinnacle_odds_type
  })

  // Track unmatched markets
  if (!market_type) {
    const combination_key = `${pinnacle_matchup.type}/${pinnacle_matchup_special_category}/${pinnacle_matchup_special_description}/${pinnacle_matchup.pinnacle_odds_type}/${pinnacle_matchup.units}/${pinnacle_matchup.is_alternate_pinnacle_market}`

    unmatched_markets.add(source_market_id)

    if (!unmatched_combinations.has(combination_key)) {
      unmatched_combinations.set(combination_key, {
        matchup_type: pinnacle_matchup.type,
        special_category: pinnacle_matchup_special_category,
        special_description: pinnacle_matchup_special_description,
        odds_type: pinnacle_matchup.pinnacle_odds_type,
        units: pinnacle_matchup.units,
        is_alternate: pinnacle_matchup.is_alternate_pinnacle_market,
        count: 0
      })
    }
    unmatched_combinations.get(combination_key).count++
  }

  return {
    market_type,

    source_id: 'PINNACLE',
    source_market_id,
    source_market_name: `type: ${pinnacle_matchup.type} / units: ${pinnacle_matchup.units} / category: ${pinnacle_matchup_special_category} / description: ${pinnacle_matchup_special_description}`,

    esbid: nfl_game ? nfl_game.esbid : null,
    year: nfl_game ? nfl_game.year : constants.season.year,
    source_event_id: pinnacle_matchup.id,
    source_event_name: format_source_event_name({
      is_valid_matchup,
      away_team,
      home_team,
      pinnacle_matchup,
      pinnacle_matchup_special_category,
      pinnacle_matchup_special_description
    }),

    open: true,
    live: pinnacle_matchup.isLive,
    selection_count: market_selection_odds.length,

    timestamp,
    selections
  }
}

const import_pinnacle_odds = async ({
  dry_run = false,
  ignore_cache = false,
  ignore_wait = false,
  save = false
} = {}) => {
  console.time('import-pinnacle-odds')

  const timestamp = Math.round(Date.now() / 1000)
  const formatted_markets = []
  const all_matchups_with_markets = []

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const pinnacle_matchups = await pinnacle.get_nfl_matchups({ ignore_cache })

  const unique_categories = new Set()
  const unique_descriptions = new Set()
  const unique_types = new Set()
  const unique_units_by_category = {}
  const unique_odds_types = new Set()
  const unique_units = new Set()

  // Track unmatched markets
  const unmatched_markets = new Set()
  const unmatched_combinations = new Map()

  for (const pinnacle_matchup of pinnacle_matchups) {
    if (pinnacle_matchup.special) {
      const pinnacle_matchup_category = pinnacle_matchup.special.category
      unique_categories.add(pinnacle_matchup_category)
      unique_descriptions.add(pinnacle_matchup.special.description)

      if (!unique_units_by_category[pinnacle_matchup_category]) {
        unique_units_by_category[pinnacle_matchup_category] = new Set()
      }
      if (pinnacle_matchup.units) {
        unique_units_by_category[pinnacle_matchup_category].add(
          pinnacle_matchup.units
        )
      }
    }
    unique_types.add(pinnacle_matchup.type)

    // Track additional unique values for market matching
    if (pinnacle_matchup.units) {
      unique_units.add(pinnacle_matchup.units)
    }
  }

  log(`found ${pinnacle_matchups.length} matchups to process`)

  for (const pinnacle_matchup of pinnacle_matchups) {
    const pinnacle_matchup_type_label =
      pinnacle_matchup.type === 'special'
        ? `${pinnacle_matchup.special?.category} - ${pinnacle_matchup.special?.description}`
        : `matchup id: ${pinnacle_matchup.id}`

    log(
      `fetching odds for ${pinnacle_matchup.type} matchup: ${pinnacle_matchup_type_label}`
    )

    const pinnacle_markets = await pinnacle.get_market_odds({
      matchup_id: pinnacle_matchup.id,
      ignore_cache
    })

    if (!pinnacle_markets || pinnacle_markets.length === 0) {
      log(
        `no market odds found for ${pinnacle_matchup.type} matchup: ${pinnacle_matchup.id}`
      )
      continue
    }

    // Track unique odds types from markets
    pinnacle_markets.forEach((market) => {
      if (market.type) {
        unique_odds_types.add(market.type)
      }
    })

    // Merge matchup with its markets for complete data structure
    const matchup_with_markets = {
      ...pinnacle_matchup,
      markets: pinnacle_markets
    }
    all_matchups_with_markets.push(matchup_with_markets)

    const market_formatted_results = await process_market_odds(
      pinnacle_matchup,
      pinnacle_markets,
      timestamp,
      nfl_games,
      unmatched_markets,
      unmatched_combinations
    )

    formatted_markets.push(...market_formatted_results)

    if (!ignore_wait) {
      await wait(5000)
    }
  }

  if (save) {
    await fs.writeFile(
      `./tmp/pinnacle-markets-${timestamp}.json`,
      JSON.stringify(all_matchups_with_markets, null, 2)
    )

    await fs.writeFile(
      `./tmp/pinnacle-markets-formatted-${timestamp}.json`,
      JSON.stringify(formatted_markets, null, 2)
    )

    log(`Saved raw matchups to ./tmp/pinnacle-matchups-${timestamp}.json`)
    log(`Saved raw markets to ./tmp/pinnacle-markets-${timestamp}.json`)
    log(
      `Saved matchups with markets to ./tmp/pinnacle-matchups-with-markets-${timestamp}.json`
    )
    log(
      `Saved formatted data to ./tmp/pinnacle-markets-formatted-${timestamp}.json`
    )
  }

  log('\n=== UNIQUE VALUES SUMMARY ===')
  log('Unique categories:', Array.from(unique_categories))
  log('Unique types:', Array.from(unique_types))
  log('Unique odds types:', Array.from(unique_odds_types))
  log('Unique units:', Array.from(unique_units))
  log('Unique units by category:')
  for (const [category, units] of Object.entries(unique_units_by_category)) {
    log(`  ${category}:`, Array.from(units))
  }
  log(
    'Unique descriptions (first 10):',
    Array.from(unique_descriptions).slice(0, 10)
  )

  // Output unmatched markets summary
  if (unmatched_markets.size > 0) {
    log(`\n=== UNMATCHED MARKETS SUMMARY ===`)
    log(`Total unmatched markets: ${unmatched_markets.size}`)
    log(`Total unmatched combinations: ${unmatched_combinations.size}`)

    log(`\n=== UNMATCHED COMBINATIONS ===`)
    for (const [, combination] of unmatched_combinations) {
      log(`\nCombination (${combination.count} occurrences):`)
      log(`  Matchup Type: ${combination.matchup_type}`)
      log(`  Special Category: ${combination.special_category}`)
      log(`  Special Description: ${combination.special_description}`)
      log(`  Odds Type: ${combination.odds_type}`)
      log(`  Units: ${combination.units}`)
      log(`  Is Alternate: ${combination.is_alternate}`)
    }
  }

  if (dry_run) {
    log(formatted_markets.slice(0, 10))
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-pinnacle-odds')
}

export const job = async () => {
  let error
  try {
    await import_pinnacle_odds({
      dry_run: argv.dry,
      ignore_cache: argv.ignore_cache,
      ignore_wait: argv.ignore_wait,
      save: argv.save
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PINNACLE_ODDS,
    error
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_pinnacle_odds
