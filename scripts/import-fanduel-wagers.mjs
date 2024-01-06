import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'
import isBetween from 'dayjs/plugin/isBetween.js'

import db from '#db'
import { constants, fixTeam, Errors } from '#libs-shared'
import {
  isMain,
  fanduel,
  getPlayer,
  encode_market_selection_id
} from '#libs-server'

dayjs.extend(isBetween)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel-wagers')
debug.enable('import-fanduel-wagers,fanduel')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

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

const load_fanduel_wagers = async ({
  filename,
  fanduel_states = ['va', 'md'],
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
  fanduel_states = ['va', 'md'],
  placed_after
} = {}) => {
  const wagers = await load_fanduel_wagers({
    filename,
    authorization,
    placed_after,
    fanduel_states
  })

  const wager_inserts = []
  const market_selection_index = {}
  const wager_legs = wagers.map((wager) => wager.legs).flat()
  const wager_parts = wager_legs.map((legs) => legs.parts).flat()
  const unique_parts = wager_parts.filter((part) => {
    const key = `${part.eventId}/${part.marketId}/${part.selectionId}`
    if (market_selection_index[key]) {
      return false
    }

    market_selection_index[key] = true

    return true
  })

  log(`found ${unique_parts.length} unique selections`)

  const weeks = []
  for (const part of unique_parts) {
    const start_time = dayjs(part.startTime)

    // check if start_time is not between now and end of current season
    if (!start_time.isBetween(constants.season.start, constants.season.end)) {
      throw new Error(
        `start time ${start_time.format()} is not this season (${
          constants.season.year
        })`
      )
    }

    const week = constants.season.calculate_week(start_time)

    if (!weeks.includes(week)) {
      weeks.push(week)
    }
  }

  const nfl_games = await db('nfl_games')
    .where({
      year: constants.season.year,
      seas_type: 'REG'
    })
    .whereIn('week', weeks)

  for (const part of unique_parts) {
    try {
      const { player_name, event_description, start_time } =
        fanduel.get_market_details_from_wager(part)

      const event_week = constants.season.calculate_week(start_time)

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
          player_row = await getPlayer({
            name: player_name
          })
        } catch (err) {
          if (err instanceof Errors.MatchedMultiplePlayers) {
            try {
              player_row = await getPlayer({
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
      if (wager.legs.length > 12) {
        throw new Error(`wager ${wager.betId} has more than 12 selections`)
      }

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
          selection_name,
          start_time,
          market_type
        } = fanduel.get_market_details_from_wager(leg.parts[0])

        if (
          !market_selection_index[
            `${leg.parts[0].eventId}/${leg.parts[0].marketId}/${leg.parts[0].selectionId}`
          ]
        ) {
          throw new Error('selection not found in market selection index')
        }

        const { nfl_game, player_row } =
          market_selection_index[
            `${leg.parts[0].eventId}/${leg.parts[0].marketId}/${leg.parts[0].selectionId}`
          ]

        const selection_id = encode_market_selection_id({
          market_type,
          esbid: nfl_game.esbid,
          pid: player_row?.pid,
          nfl_team,
          metric_name,
          metric_line,
          selection_name,
          start_time
        })
        wager_item[`selection_${index + 1}_id`] = selection_id

        if (!leg.parts[0].americanPrice) {
          throw new Error('missing american price')
        }

        wager_item[`selection_${index + 1}_odds`] = Number(
          leg.parts[0].americanPrice
        )
        wager_item[`selection_${index + 1}_status`] = format_wager_status(
          leg.result
        )
      }

      wager_inserts.push(wager_item)
    } catch (err) {
      log(err)
      log(wager)
    }
  }

  if (argv.dry) {
    log(wager_inserts[0])
    log(wager_inserts.find((w) => w.selection_count > 8))
    return
  }

  if (wager_inserts.length) {
    log(`inserting ${wager_inserts.length} wagers`)
    await db('placed_wagers')
      .insert(wager_inserts)
      .onConflict(['book_wager_id'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
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
      placed_before
    })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_fanduel_wagers
