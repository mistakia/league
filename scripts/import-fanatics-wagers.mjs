import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, fanatics, format_market_selection_id } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanatics-wagers')
debug.enable('import-fanatics-wagers,fanatics')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const format_wager_type = (type) => {
  switch (type) {
    case 'STACK':
    case 'PARLAY':
      return 'PARLAY'
    default:
      throw new Error(`unknown wager type ${type}`)
  }
}

const format_wager_status = (status) => {
  switch (status) {
    case 'OPEN':
    case 'NOT_SET':
      return 'OPEN'
    case 'WON':
      return 'WON'
    case 'LOST':
      return 'LOST'
    case 'VOID':
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      throw new Error(`unknown wager status ${status}`)
  }
}

const load_fanatics_wagers = async ({
  filename,
  session_token,
  channel = 'AMELCO_DC_MASTER',
  segment = 'AMELCO_DC',
  state_code = 'DC',
  dma = '511',
  placed_after
}) => {
  if (filename) {
    return fs.readJson(`${data_path}/${filename}`)
  }

  if (!session_token) {
    throw new Error('missing session token')
  }

  if (!placed_after) {
    placed_after = dayjs().subtract(1, 'week')
  }

  log({
    channel,
    segment,
    state_code,
    placed_after: placed_after.format(),
    session_token: session_token.substring(0, 10) + '...'
  })

  const open_wagers = await fanatics.get_open_wagers({
    session_token,
    channel,
    segment,
    stateCode: state_code,
    dma
  })

  const settled_wagers = await fanatics.get_settled_wagers({
    session_token,
    channel,
    segment,
    stateCode: state_code,
    dma
  })

  const wagers = [...open_wagers, ...settled_wagers].filter((wager) => {
    const placement_time = dayjs(wager.betMetaData.placementTime)
    return placement_time.isAfter(placed_after)
  })

  log(`loaded ${wagers.length} wagers after ${placed_after.format()}`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/fanatics_wagers_${placed_after.format('YYYY_MM_DD')}.json`
  await fs.writeJson(json_file_path, wagers, { spaces: 2 })
  log(`saved wagers to ${json_file_path}`)

  return wagers
}

const import_fanatics_wagers = async ({
  user_id = 1,
  filename,
  session_token,
  channel,
  segment,
  state_code,
  dma,
  placed_after
} = {}) => {
  const wagers = await load_fanatics_wagers({
    filename,
    session_token,
    channel,
    segment,
    state_code,
    dma,
    placed_after
  })

  const wager_inserts = []
  const book_wager_id_set = new Set()

  for (const wager of wagers) {
    let wager_item

    try {
      const parlay_legs = wager.parlayLegs || []
      if (parlay_legs.length > 12) {
        throw new Error(
          `wager ${wager.betMetaData.betId} has more than 12 selections`
        )
      }

      const wager_type = format_wager_type(wager.header.betType)
      const wager_amount = Number(wager.header.wager.replace('$', ''))
      const returned_amount = fanatics.format_wager_payout(wager.header.payout)

      wager_item = {
        userid: user_id,
        wager_type,
        placed_at: Math.floor(wager.betMetaData.placementTime / 1000),
        bet_count: 1,
        selection_count: parlay_legs.length,
        wager_status: format_wager_status(wager.header.betStatus),
        bet_wager_amount: wager_amount,
        total_wager_amount: wager_amount,
        wager_returned_amount: returned_amount,
        book_id: 'FANATICS',
        book_wager_id: wager.betMetaData.betId
      }

      for (let index = 0; index < parlay_legs.length; index++) {
        const leg = parlay_legs[index]
        const { metaData } = leg

        const selection_id = await format_market_selection_id({
          source_id: 'FANATICS',
          source_market_id: metaData.marketId,
          source_selection_id: metaData.selectionId
        })

        wager_item[`selection_${index + 1}_id`] = selection_id
        wager_item[`selection_${index + 1}_odds`] = Math.round(
          (Number(leg.oddsData.americanDisplay) < 0 ? -100 : 100) /
            Number(leg.oddsData.decimal - 1)
        )
        wager_item[`selection_${index + 1}_status`] = format_wager_status(
          leg.betStatus
        )
      }

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
    const session_token = argv.session
    const channel = argv.channel
    const segment = argv.segment
    const state_code = argv.state
    const dma = argv.dma
    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null

    await import_fanatics_wagers({
      filename: argv.file,
      session_token,
      channel,
      segment,
      state_code,
      dma,
      placed_after
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

export default import_fanatics_wagers
