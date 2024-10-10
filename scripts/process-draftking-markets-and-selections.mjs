import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, draftkings, getPlayer } from '#libs-server'
import { bookmaker_constants, fixTeam } from '#libs-shared'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-draftkings-markets-and-selections')
debug.enable('process-draftkings-markets-and-selections,get-player')

const extract_player_name = ({ market_type, market_name, selection_name }) => {
  switch (market_type) {
    case bookmaker_constants.player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS:
    case bookmaker_constants.player_prop_types
      .SEASON_LEADER_RECEIVING_TOUCHDOWNS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_SACKS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_INTERCEPTIONS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_PASSING_YARDS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_RUSHING_YARDS:
    case bookmaker_constants.player_prop_types.SEASON_LEADER_RECEIVING_YARDS:
    case bookmaker_constants.player_prop_types.GAME_LEADER_PASSING_YARDS:
    case bookmaker_constants.player_prop_types.GAME_LEADER_RUSHING_YARDS:
    case bookmaker_constants.player_prop_types.GAME_LEADER_RECEIVING_YARDS:
    case bookmaker_constants.player_prop_types.SUNDAY_LEADER_PASSING_YARDS:
    case bookmaker_constants.player_prop_types.SUNDAY_LEADER_RUSHING_YARDS:
    case bookmaker_constants.player_prop_types.SUNDAY_LEADER_RECEIVING_YARDS:
      return selection_name
    default:
      return extract_player_name_from_string(market_name)
  }
}

const extract_player_name_from_string = (string = '') => {
  // Handle the case where there's no '('
  let name = string.includes('(') ? string.split('(')[0].trim() : string.trim()

  // Remove common prop types and words
  const words_to_remove = [
    'Props',
    'Receiving',
    'Rushing',
    'Passing',
    'Yards',
    'Longest',
    'Reception',
    'Rush',
    'Pass',
    'Receptions',
    'Touchdowns',
    'Attempts',
    'Completions',
    'TD',
    'INT',
    'Interceptions',
    'Thrown',
    'D/ST',
    'Tackles',
    'Ast',
    'Assists',
    'Rush',
    'Rec',
    'Yds',
    'Completion',
    'TDs',
    'Alternate',
    'Alt',
    'X+',
    'O/U',
    'on'
  ]

  for (const word of words_to_remove) {
    name = name.replace(new RegExp(`\\b${word}\\b`, 'gi'), '')
  }

  // remvoe `-` and `+`
  name = name.replace(/\s-\s/g, '')
  name = name.replace(/\+/g, '')

  // Remove any leading/trailing whitespace and dash
  name = name.replace(/^[-\s]+|[-\s]+$/g, '')

  return name.trim()
}

const update_market_type = async ({
  source_market,
  market_type,
  ignore_conflicts
}) => {
  const should_update_market_type =
    source_market.existing_market_types.size > 1 ||
    (source_market.existing_market_types.size === 1 &&
      !source_market.existing_market_types.has(market_type))

  if (
    !source_market.existing_market_types.size ||
    (ignore_conflicts && should_update_market_type)
  ) {
    log(
      `updating market type for ${source_market.source_market_id} to ${market_type}`
    )
    await db('prop_markets_index')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id
      })
      .update({ market_type })
  } else if (should_update_market_type) {
    log(
      `conflict found for market type: ${source_market.source_market_id}, existing: ${source_market.existing_market_types}, new: ${market_type}`
    )
  }
}

const update_year = async ({ source_market, year, ignore_conflicts }) => {
  const should_update_year =
    source_market.existing_years.size > 1 ||
    (source_market.existing_years.size === 1 &&
      !source_market.existing_years.has(year))

  if (
    !source_market.existing_years.size ||
    (ignore_conflicts && should_update_year)
  ) {
    log(`updating year for ${source_market.source_market_id} to ${year}`)
    await db('prop_markets_index')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id
      })
      .update({ year })
  } else if (should_update_year) {
    log(
      `conflict found for year: ${source_market.source_market_id}, existing: ${source_market.existing_years}, new: ${year}`
    )
  }
}

const process_selection = async ({
  selection,
  source_market,
  market_type,
  ignore_conflicts,
  missing_selection_lines,
  missing_selection_pids
}) => {
  const selection_type = draftkings.format_selection_type(
    selection.selection_name
  )
  if (selection_type) {
    await db('prop_market_selections_index')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id,
        source_selection_id: selection.source_selection_id
      })
      .update({ selection_type })

    await db('prop_market_selections_history')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id,
        source_selection_id: selection.source_selection_id
      })
      .update({ selection_type })
  }

  if (!selection.selection_metric_line) {
    missing_selection_lines.set(selection.source_selection_id, {
      source_market_name: source_market.market_name,
      source_event_name: source_market.source_event_name,
      market_type,
      ...selection
    })
  }

  // Handle spread market types
  if (
    (market_type === bookmaker_constants.team_game_market_types.GAME_SPREAD ||
      market_type ===
        bookmaker_constants.team_game_market_types.GAME_ALT_SPREAD) &&
    !selection.selection_pid
  ) {
    const team_abbr = selection.selection_name.split(' ')[1]
    let team_pid
    try {
      team_pid = fixTeam(team_abbr)
    } catch (err) {
      log(err)
      return
    }

    await update_selection_pid({
      selection,
      player_row: { pid: team_pid },
      source_market,
      ignore_conflicts
    })
    return
  }

  // Skip other game market types
  if (bookmaker_constants.team_game_market_types[market_type]) {
    return
  }

  const name_string = extract_player_name({
    market_type,
    market_name: source_market.market_name,
    selection_name: selection.selection_name
  })
  if (!name_string) {
    log({
      source_market_name: source_market.market_name,
      source_event_name: source_market.source_event_name,
      market_type,
      ...selection
    })
    return
  }

  const params = {
    name: name_string,
    ignore_retired: true
  }

  let player_row
  try {
    player_row = await getPlayer(params)
  } catch (err) {
    log(err)
    return
  }

  if (!player_row) {
    log(params)
    log({
      source_market_name: source_market.market_name,
      source_event_name: source_market.source_event_name,
      market_type,
      ...selection
    })
    missing_selection_pids.set(params.name, {
      params,
      source_selection_id: selection.source_selection_id,
      source_market_name: source_market.market_name,
      selection_name: selection.selection_name,
      market_type
    })
    return
  }

  await update_selection_pid({
    selection,
    player_row,
    source_market,
    ignore_conflicts
  })
}

const update_selection_pid = async ({
  selection,
  player_row,
  source_market,
  ignore_conflicts
}) => {
  if (selection.selection_pid) {
    if (selection.selection_pid !== player_row.pid) {
      if (ignore_conflicts) {
        await db('prop_market_selections_index')
          .where({
            source_market_id: source_market.source_market_id,
            source_id: source_market.source_id,
            source_selection_id: selection.source_selection_id
          })
          .update({
            selection_pid: player_row.pid
          })
      } else {
        log(
          `conflict found for ${selection.source_selection_id}, existing: ${selection.selection_pid}, new: ${player_row.pid}`
        )
      }
    }
  } else {
    await db('prop_market_selections_index')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id,
        source_selection_id: selection.source_selection_id
      })
      .update({
        selection_pid: player_row.pid
      })
  }
}

const process_market = async ({
  source_market,
  ignore_conflicts,
  missing_selection_lines,
  missing_selection_pids,
  missing_market_types
}) => {
  const market_type = draftkings.get_market_type({
    offerCategoryId: source_market.source_market_ids.offer_category_id,
    subcategoryId: source_market.source_market_ids.sub_category_id,
    betOfferTypeId: source_market.source_market_ids.bet_offer_type_id
  })
  if (!market_type) {
    missing_market_types.set(source_market.source_market_id, source_market)
    return
  }

  await update_market_type({ source_market, market_type, ignore_conflicts })

  if (!source_market.year) {
    const year = source_market.nfl_games_year
    if (year) {
      await update_year({ source_market, year, ignore_conflicts })
    }
  }

  for (const selection of source_market.selections) {
    await process_selection({
      selection,
      source_market,
      market_type,
      ignore_conflicts,
      missing_selection_lines,
      missing_selection_pids
    })
  }
}

const process_draftkings_markets_and_selections = async ({
  missing_only = false,
  since_date = null,
  ignore_conflicts = false
}) => {
  const missing_market_types = new Map()
  const missing_selection_pids = new Map()
  const missing_selection_lines = new Map()

  const query = db('prop_market_selections_index')
    .select(
      'prop_market_selections_index.*',
      'prop_markets_index.*',
      'nfl_games.year as nfl_games_year'
    )
    .leftJoin('prop_markets_index', function () {
      this.on(
        'prop_market_selections_index.source_market_id',
        'prop_markets_index.source_market_id'
      )
      this.andOn(
        'prop_market_selections_index.source_id',
        'prop_markets_index.source_id'
      )
      this.andOn(
        'prop_market_selections_index.time_type',
        'prop_markets_index.time_type'
      )
    })
    .leftJoin('nfl_games', 'nfl_games.esbid', 'prop_markets_index.esbid')
    .where('prop_markets_index.source_id', 'DRAFTKINGS')

  if (since_date) {
    const since_timestamp = Math.floor(new Date(since_date).getTime() / 1000)
    query.where('prop_markets_index.timestamp', '>=', since_timestamp)
  }

  if (missing_only) {
    query.where(function () {
      this.whereNull('prop_markets_index.market_type').orWhereNull(
        'prop_market_selections_index.selection_pid'
      )
    })
  }

  const market_selection_rows = await query
  const source_market_index = {}
  const add_market_selection = ({
    source_market_id,
    market_name,
    source_market_ids,
    market_selection_row
  }) => {
    if (!source_market_index[source_market_id]) {
      source_market_index[source_market_id] = {
        source_market_id: market_selection_row.source_market_id,
        source_id: market_selection_row.source_id,
        esbid: market_selection_row.esbid,
        year: market_selection_row.year,
        nfl_games_year: market_selection_row.nfl_games_year,
        source_event_name: market_selection_row.source_event_name,
        market_name,
        source_market_ids,
        selections: [],
        existing_market_types: new Set(),
        existing_years: new Set()
      }
    }
    source_market_index[source_market_id].selections.push(market_selection_row)

    if (market_selection_row.market_type) {
      source_market_index[source_market_id].existing_market_types.add(
        market_selection_row.market_type
      )
    }

    if (market_selection_row.year) {
      source_market_index[source_market_id].existing_years.add(
        market_selection_row.year
      )
    }

    // if the market name is longer than the previous one, use it
    if (
      source_market_index[source_market_id].market_name !== market_name &&
      market_name.length >
        source_market_index[source_market_id].market_name.length
    ) {
      source_market_index[source_market_id].market_name = market_name
    }
  }

  for (const market_selection_row of market_selection_rows) {
    const market_name = market_selection_row.source_market_name
      .split(' (categoryId:')[0]
      .trim()

    const id_regex =
      /categoryId:\s*(\d+)(?:,\s*subcategoryId:\s*(\d+))?(?:,\s*betOfferTypeId:\s*(\d+))?/
    const match = market_selection_row.source_market_name.match(id_regex)

    let offer_category_id = null
    let sub_category_id = null
    let bet_offer_type_id = null

    if (match) {
      ;[, offer_category_id, sub_category_id, bet_offer_type_id] = match
    }

    // get missing bet_offer_type_id from market_name
    if (
      !bet_offer_type_id &&
      Number(offer_category_id) === 492 &&
      Number(sub_category_id) === 4518
    ) {
      if (market_name.includes('Total')) {
        bet_offer_type_id = 6
      } else if (market_name.includes('Moneyline')) {
        bet_offer_type_id = 2
      } else if (market_name.includes('Spread')) {
        bet_offer_type_id = 1
      }
    }

    add_market_selection({
      source_market_id: market_selection_row.source_market_id,
      market_name,
      source_market_ids: {
        offer_category_id,
        sub_category_id,
        bet_offer_type_id
      },
      market_selection_row
    })
  }

  log(`loaded market types: ${Object.keys(source_market_index).length}`)

  for (const source_market of Object.values(source_market_index)) {
    await process_market({
      source_market,
      ignore_conflicts,
      missing_selection_lines,
      missing_selection_pids,
      missing_market_types
    })
  }

  // output up to 20 missing market_types
  log(Array.from(missing_market_types.entries()).slice(0, 20))

  // output up to 100 missing selection_pids
  log(Array.from(missing_selection_pids.entries()).slice(0, 100))
}

const main = async () => {
  let error
  try {
    await process_draftkings_markets_and_selections({
      missing_only: argv.missing_only,
      since_date: argv.since_date
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_draftkings_markets_and_selections
