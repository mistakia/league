import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'
import isBetween from 'dayjs/plugin/isBetween.js'

import db from '#db'
import { fixTeam, Errors, format_standard_selection_id } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, fanduel, find_player_row, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(isBetween)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-fanduel-wagers')
debug.enable('import-fanduel-wagers,fanduel')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

// Default FanDuel states for wager import
const DEFAULT_FANDUEL_STATES = ['va', 'md', 'dc', 'ny']

const format_wager_type = (type) => {
  switch (type) {
    case 'DBL':
    case 'TBL':
    case 'ACC2':
    case 'ACC3':
    case 'ACC4':
    case 'ACC5':
    case 'ACC6':
    case 'ACC7':
    case 'ACC8':
    case 'ACC9':
    case 'ACC10':
    case 'AC10':
    case 'ACC11':
    case 'AC11':
    case 'ACC12':
    case 'AC12':
      return 'PARLAY'

    case 'SGL':
      return 'SINGLE'

    default:
      throw new Error(`unknown wager type ${type}`)
  }
}

const format_wager_status = (settlement_status) => {
  switch (settlement_status) {
    case undefined:
    case 'OPEN':
      return 'OPEN'

    case 'WON':
      return 'WON'

    case 'LOST':
      return 'LOST'

    case 'VOID':
      return 'CANCELLED'

    case 'CASHED_OUT':
      return 'CASHED_OUT'

    default:
      throw new Error(`unknown wager status ${settlement_status}`)
  }
}

const format_bet_count = ({ wager_type, wager }) => {
  switch (wager_type) {
    case 'SINGLE':
    case 'PARLAY':
      return 1

    case 'ROUND_ROBIN':
      return Number(wager.numberOfSelections)

    default:
      throw new Error(`unknown wager type ${wager_type}`)
  }
}

/**
 * Maps FanDuel metric_name to standard market_type for format_standard_selection_id
 * FanDuel returns generic market_type (PLAYER_GAME_PROPS, etc.) with separate metric_name
 * The new format requires specific market types like GAME_PASSING_YARDS
 */
const get_standard_market_type = ({ metric_name, market_type }) => {
  // For game-level markets
  if (market_type === 'GAME_PROPS') {
    switch (metric_name) {
      case 'TOTAL_POINTS':
        return 'GAME_TOTAL'
      case 'MONEYLINE':
        return 'GAME_MONEYLINE'
      case 'SPREAD':
        return 'GAME_SPREAD'
      default:
        return `GAME_${metric_name}`
    }
  }

  // For team-level markets
  if (market_type === 'TEAM_GAME_PROPS') {
    switch (metric_name) {
      case 'FIRST_HALF_TEAM_TOTAL_POINTS':
        return 'FIRST_HALF_TEAM_TOTAL'
      case 'SPREAD':
        return 'GAME_SPREAD'
      case 'FIRST_HALF_SPREAD':
        return 'FIRST_HALF_SPREAD'
      default:
        return `GAME_${metric_name}`
    }
  }

  // For player-level markets - prefix with GAME_ for game props
  switch (metric_name) {
    case 'PASSING_YARDS':
      return 'GAME_PASSING_YARDS'
    case 'PASSING_TOUCHDOWNS':
      return 'GAME_PASSING_TOUCHDOWNS'
    case 'RUSHING_YARDS':
      return 'GAME_RUSHING_YARDS'
    case 'RECEIVING_YARDS':
      return 'GAME_RECEIVING_YARDS'
    case 'RUSHING_RECEIVING_YARDS':
      return 'GAME_RUSHING_RECEIVING_YARDS'
    case 'RECEPTIONS':
      return 'GAME_RECEPTIONS'
    case 'FIRST_QUARTER_RECEIVING_YARDS':
      return 'FIRST_QUARTER_RECEIVING_YARDS'
    case 'FIRST_QUARTER_RUSHING_YARDS':
      return 'FIRST_QUARTER_RUSHING_YARDS'
    case 'FIRST_QUARTER_PASSING_YARDS':
      return 'FIRST_QUARTER_PASSING_YARDS'
    case 'ANYTIME_TOUCHDOWN':
      return 'ANYTIME_TOUCHDOWN'
    case 'TWO_PLUS_TOUCHDOWNS':
      return 'TWO_PLUS_TOUCHDOWNS'
    default:
      return `GAME_${metric_name}`
  }
}

const load_fanduel_wagers = async ({
  filename,
  fanduel_states = DEFAULT_FANDUEL_STATES,
  authorization,
  placed_after,
  placed_before
}) => {
  if (filename) {
    return fs.readJson(`${data_path}/${filename}`)
  }

  if (!authorization) {
    throw new Error('missing authorization')
  }

  if (!placed_after) {
    placed_after = dayjs().subtract(1, 'week')
  }

  log({
    placed_after: placed_after.format(),
    placed_before: placed_before ? placed_before.format() : null,
    fanduel_states,
    authorization
  })

  let wagers = []

  for (const fanduel_state of fanduel_states) {
    const state_wagers = await fanduel.get_all_wagers({
      fanduel_state,
      authorization,
      placed_after,
      placed_before
    })

    wagers = wagers.concat(state_wagers)
  }

  log(`loaded ${wagers.length} wagers`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/fanduel_wagers_${placed_after.format(
    'YYYY'
  )}_${placed_after.format('MM')}_${placed_after.format('DD')}_${
    placed_before ? placed_before.format('YYYY_MM_DD') : 'present'
  }.json`
  await fs.writeJson(json_file_path, wagers, { spaces: 2 })
  log(`saved wagers to ${json_file_path}`)

  return wagers
}

const import_fanduel_wagers = async ({
  user_id = 1,
  filename,
  authorization,
  fanduel_states = DEFAULT_FANDUEL_STATES,
  placed_after,
  dry_run = false
} = {}) => {
  const wagers = await load_fanduel_wagers({
    filename,
    authorization,
    placed_after,
    fanduel_states
  })

  const wager_inserts = []
  const book_wager_id_set = new Set()
  const market_selection_index = {}
  const wager_legs = wagers.map((wager) => wager.legs).flat()
  const wager_parts = wager_legs.map((legs) => legs.parts).flat()
  const seen_parts = new Set()
  const unique_parts = wager_parts.filter((part) => {
    const key = `${part.eventId}/${part.marketId}/${part.selectionId}`
    if (seen_parts.has(key)) {
      return false
    }

    seen_parts.add(key)

    return true
  })

  log(`found ${unique_parts.length} unique selections`)

  const weeks = []
  for (const part of unique_parts) {
    const start_time = dayjs(part.startTime)

    // check if start_time is not between now and end of current season
    if (
      !start_time.isBetween(
        current_season.regular_season_start,
        current_season.end
      )
    ) {
      log(
        `start time ${start_time.format()} is not this season (${
          current_season.year
        })`
      )
      continue
    }

    const { week } = current_season.calculate_week(start_time)

    if (!weeks.includes(week)) {
      weeks.push(week)
    }
  }

  const nfl_games = await db('nfl_games')
    .where({
      year: current_season.year
    })
    .whereIn('seas_type', ['REG', 'POST'])
    .whereIn('week', weeks)

  for (const part of unique_parts) {
    try {
      const { player_name, event_description, start_time } =
        fanduel.get_market_details_from_wager(part)

      const { week: event_week } = current_season.calculate_week(start_time)

      const home_team = fixTeam(event_description.split(' @ ')[1])
      const away_team = fixTeam(event_description.split(' @ ')[0])

      const nfl_game = nfl_games.find(
        (game) =>
          game.h === home_team &&
          game.v === away_team &&
          game.week === event_week
      )

      if (!nfl_game) {
        throw new Error(`could not find game ${event_description}`)
      }

      let player_row

      if (player_name) {
        try {
          player_row = await find_player_row({
            name: player_name
          })
        } catch (err) {
          if (err instanceof Errors.MatchedMultiplePlayers) {
            try {
              player_row = await find_player_row({
                name: player_name,
                teams: [nfl_game.h, nfl_game.v]
              })
            } catch (err) {
              log(err)
            }
          } else {
            log(err)
          }
        }

        if (!player_row) {
          throw new Error(`missing player ${player_name}`)
        }
      }

      market_selection_index[
        `${part.eventId}/${part.marketId}/${part.selectionId}`
      ] = {
        nfl_game,
        player_row
      }
    } catch (err) {
      log(err)
    }
  }

  log('built market selection index')

  for (const wager of wagers) {
    let wager_item

    try {
      const wager_type = format_wager_type(wager.betType)
      const bet_count = format_bet_count({ wager_type, wager })
      wager_item = {
        userid: user_id,
        wager_type,
        placed_at: dayjs(wager.placedDate).unix(),
        bet_count,
        selection_count: wager.legs.length,
        selection_lost: wager.legs.filter((leg) => leg.result === 'LOST')
          .length,
        wager_status: format_wager_status(wager.result),
        bet_wager_amount: wager.currentSize,
        total_wager_amount: wager.currentSize * bet_count,
        wager_returned_amount: wager.pandl,
        book_id: 'FANDUEL',
        book_wager_id: wager.betId
      }

      const selections = []

      for (let index = 0; index < wager.legs.length; index++) {
        const leg = wager.legs[index]

        if (leg.parts.length > 1) {
          // i.e. same game parlay
          throw new Error('leg has multiple parts')
        }

        const {
          nfl_team,
          metric_name,
          metric_line,
          selection_type,
          market_type
        } = fanduel.get_market_details_from_wager(leg.parts[0])

        const selection_index_key = `${leg.parts[0].eventId}/${leg.parts[0].marketId}/${leg.parts[0].selectionId}`
        const selection_index_entry =
          market_selection_index[selection_index_key]

        if (!selection_index_entry || !selection_index_entry.nfl_game) {
          throw new Error(
            `selection not found in market selection index: ${selection_index_key}`
          )
        }

        const { nfl_game, player_row } = selection_index_entry

        const standard_market_type = get_standard_market_type({
          metric_name,
          market_type
        })

        const selection_id = format_standard_selection_id({
          esbid: nfl_game.esbid,
          market_type: standard_market_type,
          pid: player_row?.pid,
          team: nfl_team,
          selection_type,
          line: metric_line,
          safe: true,
          source_id: 'FANDUEL',
          raw_data: {
            event_id: leg.parts[0].eventId,
            market_id: leg.parts[0].marketId,
            selection_id: leg.parts[0].selectionId,
            metric_name
          }
        })

        if (!leg.parts[0].americanPrice) {
          throw new Error('missing american price')
        }

        selections.push({
          id: selection_id,
          odds: Number(leg.parts[0].americanPrice),
          status: format_wager_status(leg.result)
        })
      }

      wager_item.selections = JSON.stringify(selections)

      if (book_wager_id_set.has(wager_item.book_wager_id)) {
        log(`skipping duplicate book_wager_id: ${wager_item.book_wager_id}`)
        continue
      }

      book_wager_id_set.add(wager_item.book_wager_id)

      wager_inserts.push(wager_item)
    } catch (err) {
      log(err)
      log(wager)
    }
  }

  if (dry_run) {
    log(wager_inserts[0])
    log(wager_inserts.find((w) => w.selection_count > 8))
    return
  }

  if (wager_inserts.length) {
    log(`inserting ${wager_inserts.length} wagers`)
    await batch_insert({
      items: wager_inserts,
      save: async (batch) => {
        await db('placed_wagers')
          .insert(batch)
          .onConflict(['book_wager_id'])
          .merge()
      },
      batch_size: 1000
    })
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const auth = argv.auth
    let fanduel_states = argv.states
    if (fanduel_states && !Array.isArray(fanduel_states)) {
      fanduel_states = [fanduel_states]
    }

    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null
    const placed_before = argv.placed_before
      ? dayjs(argv.placed_before, 'YYYY-MM-DD')
      : null
    await import_fanduel_wagers({
      filename: argv.file,
      authorization: auth,
      fanduel_states,
      placed_after,
      placed_before,
      dry_run: argv.dry
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

export default import_fanduel_wagers
