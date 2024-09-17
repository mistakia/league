import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'
import oddslib from 'oddslib'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  getPlayer,
  pinnacle,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-pinnacle-odds')
debug.enable(
  'import-pinnacle-odds,pinnacle,get-player,insert-prop-market,insert-prop-market-selections'
)

const format_market = async ({
  pinnacle_market,
  market_selection_odds,
  timestamp,
  nfl_games = []
}) => {
  let nfl_game
  const selections = []

  // Extract home and away teams from parent object
  const home_team = pinnacle_market.parent.participants.find(
    (p) => p.alignment === 'home'
  )?.name
  const away_team = pinnacle_market.parent.participants.find(
    (p) => p.alignment === 'away'
  )?.name

  const teams = [fixTeam(home_team), fixTeam(away_team)]

  if (home_team && away_team) {
    const { week, seas_type } = constants.season.calculate_week(
      dayjs(pinnacle_market.parent.startTime)
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

  const special_category = pinnacle_market.special?.category
  const special_description = pinnacle_market.special?.description

  let player_row = null
  if (special_category === 'Player Props' && special_description) {
    const player_name_string = special_description.split('(')[0].trim()
    try {
      player_row = await getPlayer({
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
    const pinnnacle_market_participant = pinnacle_market.participants.find(
      (p) => p.id === selection.participantId
    )

    const market_participant_name = pinnnacle_market_participant?.name

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
        player_row = await getPlayer(params)
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        log(`could not find player: ${params.name} / ${params.teams}`)
      }
    }

    selections.push({
      source_id: 'PINNACLE',
      source_market_id: pinnacle_market.id,
      source_selection_id: selection.participantId,

      selection_pid: player_row?.pid || null,
      selection_name: market_participant_name,
      selection_metric_line: selection.points,
      selection_type: pinnacle.format_selection_type(market_participant_name),
      odds_decimal: oddslib.from('moneyline', selection.price).to('decimal'),
      odds_american: selection.price
    })
  }

  return {
    market_type: pinnacle.get_market_type({
      type: pinnacle_market.type,
      units: pinnacle_market.units,
      category: special_category
    }),

    source_id: 'PINNACLE',
    source_market_id: pinnacle_market.id,
    source_market_name: `type: ${pinnacle_market.type} / units: ${pinnacle_market.units} / category: ${special_category} / description: ${special_description}`,

    esbid: nfl_game ? nfl_game.esbid : null,
    year: nfl_game ? nfl_game.year : null,
    source_event_id: pinnacle_market.parentId,
    source_event_name: `${away_team} @ ${home_team}`,

    open: true,
    live: pinnacle_market.isLive,
    selection_count: market_selection_odds.length,

    timestamp,
    selections
  }
}

const import_pinnacle_odds = async ({
  dry_run = false,
  ignore_cache = false,
  ignore_wait = false
} = {}) => {
  console.time('import-pinnacle-odds')

  const timestamp = Math.round(Date.now() / 1000)
  const formatted_markets = []

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const markets = await pinnacle.get_nfl_markets({ ignore_cache })

  const unique_categories = new Set()
  const unique_descriptions = new Set()
  const unique_types = new Set()
  const unique_units_by_category = {}
  const unique_participant_names = new Set()

  for (const market of markets) {
    if (market.special) {
      const category = market.special.category
      unique_categories.add(category)
      unique_descriptions.add(market.special.description)

      if (!unique_units_by_category[category]) {
        unique_units_by_category[category] = new Set()
      }
      if (market.units) {
        unique_units_by_category[category].add(market.units)
      }
    }
    unique_types.add(market.type)
    if (market.participants) {
      market.participants.forEach((participant) => {
        if (participant.name) {
          unique_participant_names.add(participant.name)
        }
      })
    }
  }

  // log('Unique descriptions:', Array.from(unique_descriptions))
  // log('Unique categories:', Array.from(unique_categories))
  // log('Unique types:', Array.from(unique_types))
  log('Unique units by category:')
  for (const [category, units] of Object.entries(unique_units_by_category)) {
    log(`  ${category}:`, Array.from(units))
  }
  // log('Unique participant names:', Array.from(unique_participant_names))

  const market_parent_ids = new Set()

  markets.forEach((market) => {
    if (!market.parentId) {
      return
    }
    market_parent_ids.add(market.parentId)
  })

  log(`found ${market_parent_ids.size} market parent ids`)

  if (!ignore_wait) {
    await wait(5000)
  }

  const market_selection_odds_by_parent_id = {}
  const market_selection_by_participant_id = {}

  for (const market_parent_id of Array.from(market_parent_ids)) {
    log(`fetching market odds for market parent id: ${market_parent_id}`)
    const market_odds = await pinnacle.get_market_odds({
      market_parent_id,
      ignore_cache
    })

    if (!market_odds || market_odds.length === 0) {
      log(`no market odds found for market parent id: ${market_parent_id}`)
      continue
    }

    market_selection_odds_by_parent_id[market_parent_id] = market_odds

    for (const market_selection_odds of market_odds) {
      for (const selection of market_selection_odds.prices) {
        const participant_id = selection.participantId
        if (participant_id) {
          market_selection_by_participant_id[participant_id] = selection
        }
      }
    }

    if (!ignore_wait) {
      await wait(5000)
    }
  }

  for (const market of markets) {
    if (!market.parentId) continue

    const parent_market_selection_odds =
      market_selection_odds_by_parent_id[market.parentId]
    if (!parent_market_selection_odds) continue

    const market_selection_odds = market.participants
      .map((participant) => {
        if (!participant.id) {
          log(`participant has no id: ${participant}`)
          return null
        }
        const selection = market_selection_by_participant_id[participant.id]
        if (!selection) {
          log(`could not find selection for participant id: ${participant.id}`)
          return null
        }
        return selection
      })
      .filter(Boolean)

    const formatted_market = await format_market({
      pinnacle_market: market,
      market_selection_odds,
      timestamp,
      nfl_games
    })

    formatted_markets.push(formatted_market)
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
      ignore_wait: argv.ignore_wait
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
