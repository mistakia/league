import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'
import oddslib from 'oddslib'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, fanduel } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel-wagers')
debug.enable('import-fanduel-wagers,fanduel')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const format_wager_type = (type) => {
  switch (type) {
    case 'ACC2':
    case 'ACC3':
    case 'ACC4':
    case 'ACC5':
    case 'ACC6':
    case 'ACC7':
    case 'ACC8':
    case 'ACC9':
    case 'ACC10':
      return 'PARLAY'

    default:
      throw new Error(`unknown wager type ${type}`)
  }
}

const format_wager_status = (settlement_status) => {
  switch (settlement_status) {
    case 'OPEN':
      return 'OPEN'

    case 'WON':
      return 'WON'

    case 'LOST':
      return 'LOST'

    default:
      throw new Error(`unknown wager status ${settlement_status}`)
  }
}

const format_bet_count = (wager) => Number(wager.numberOfSelections)

const load_fanduel_wagers = async ({
  filename,
  is_settled = false,
  fanduel_state = 'va',
  authorization,
  placed_after,
  placed_before
}) => {
  if (filename) {
    return fs.readJson(filename)
  }

  if (!authorization) {
    throw new Error('missing authorization')
  }

  if (!placed_after) {
    placed_after = dayjs().subtract(1, 'week')
  }

  log({
    is_settled,
    placed_after: placed_after.format(),
    placed_before: placed_before ? placed_before.format() : null,
    fanduel_state,
    authorization
  })

  const wagers = await fanduel.get_all_wagers({
    fanduel_state,
    is_settled,
    authorization,
    placed_after,
    placed_before
  })

  log(`loaded ${wagers.length} wagers`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/fanduel_wagers_${fanduel_state}_${placed_after.format(
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
  is_settled = false,
  fanduel_state = 'va',
  placed_after
} = {}) => {
  const wagers = await load_fanduel_wagers({
    filename,
    is_settled,
    authorization,
    placed_after,
    fanduel_state
  })

  const wager_inserts = []

  for (const wager of wagers) {
    let wager_item

    try {
      wager_item = {
        userid: user_id,
        wager_type: format_wager_type(wager.betType),
        placed_at: dayjs(wager.placedDate).unix(),
        bet_count: format_bet_count(wager),
        selection_count: wager.legs.length,
        wager_status: format_wager_status(wager.result),
        bet_wager_amount: wager.current_size,
        // TODO total_wager_amount:
        wager_returned_amount: wager.pandl,
        book_id: 'FANDUEL',
        book_wager_id: wager.betId
      }

      if (wager.legs.length > 10) {
        throw new Error(`wager ${wager.betId} has more than 10 selections`)
      }

      wager.legs.forEach((leg, index) => {
        // TODO check and add any missing markets and selections

        if (leg.parts.length > 1) {
          throw new Error('leg has multiple parts')
        }

        wager_item[`selection_${index + 1}_id`] = leg.parts[0].selectionId
        const decimal_odds = Number(leg.parts[0].price)
        wager_item[`selection_${index + 1}_odds`] = oddslib
          .from('decimal', decimal_odds)
          .to('moneyline')
      })
    } catch (err) {
      log(err)
    }

    if (wager_item) {
      wager_inserts.push(wager_item)
    }
  }

  if (argv.dry) {
    log(wager_inserts[0])
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
    const fanduel_state = argv.state
    const is_settled = argv.is_settled === 'true' || argv.is_settled === true

    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null
    const placed_before = argv.placed_before
      ? dayjs(argv.placed_before, 'YYYY-MM-DD')
      : null
    await import_fanduel_wagers({
      authorization: auth,
      fanduel_state,
      is_settled,
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
