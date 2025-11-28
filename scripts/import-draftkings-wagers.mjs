import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, draftkings, format_market_selection_id } from '#libs-server'
// import { job_types } from '#libs-shared/job-.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-draftkings-wagers')
debug.enable('import-draftkings-wagers,draft-kings')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const format_wager_type = (type) => {
  switch (type) {
    case 'RoundRobin':
      return 'ROUND_ROBIN'

    case 'Parlay':
      return 'PARLAY'

    default:
      throw new Error(`unknown wager type ${type}`)
  }
}

const format_wager_status = (settlement_status) => {
  switch (settlement_status) {
    case 'Open':
      return 'OPEN'

    case 'Won':
      return 'WON'

    case 'Lost':
      return 'LOST'

    case 'Cancelled':
      return 'CANCELLED'

    default:
      throw new Error(`unknown wager status ${settlement_status}`)
  }
}

const load_draftkings_wagers = async ({
  filename,
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
    placed_after: placed_after.format()
  })

  const wagers = await draftkings.get_all_wagers({
    authorization,
    placed_after,
    placed_before
  })

  log(`loaded ${wagers.length} wagers`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/draftkings_wagers_${placed_after.format(
    'YYYY'
  )}_${placed_after.format('MM')}_${placed_after.format('DD')}.json`
  await fs.writeJson(json_file_path, wagers, { spaces: 2 })

  log(`saved wagers to ${json_file_path}`)

  return wagers
}

const import_draftkings_wagers = async ({
  filename,
  authorization,
  placed_after,
  user_id = 1,
  dry = false
} = {}) => {
  const wagers = await load_draftkings_wagers({
    filename,
    authorization,
    placed_after
  })

  const wager_inserts = []
  const selection_details_index = {}

  for (const wager of wagers) {
    let wager_item

    try {
      wager_item = {
        userid: user_id,
        wager_type: format_wager_type(wager.type),
        placed_at: dayjs(wager.placementDate).unix(),
        bet_count: wager.numberOfBets,
        selection_count: wager.numberOfSelections,
        wager_status: format_wager_status(wager.settlementStatus),
        bet_wager_amount: Number(wager.stake / wager.numberOfBets),
        total_wager_amount: wager.stake,
        wager_returned_amount: wager.returns || wager.potentialReturns,
        book_id: 'DRAFTKINGS',
        book_wager_id: wager.betId
      }

      if (wager.selections.length > 10) {
        throw new Error(`wager ${wager.betId} has more than 10 selections`)
      }

      for (let index = 0; index < wager.selections.length; index++) {
        const selection = wager.selections[index]
        if (!selection_details_index[selection.selectionId]) {
          const selection_id = await format_market_selection_id({
            source_id: 'DRAFTKINGS',
            source_market_id: selection.marketId,
            source_selection_id: selection.selectionId
          })
          selection_details_index[selection.selectionId] = selection_id
        }
        wager_item[`selection_${index + 1}_id`] =
          selection_details_index[selection.selectionId] ||
          selection.selectionId
        wager_item[`selection_${index + 1}_odds`] = Number(
          selection.displayOdds.replace('−', '-')
        )

        // TODO check and add any missing markets and selections
        // selection_inserts.push({
        //   book_selection_id: selection.selectionId,
        //   source_market_id: selection.marketId,
        //   source_id: 'DRAFTKINGS',
        //   result: format_wager_status(selection.settlementStatus),
        //   selection_name: selection.selectionDisplayName,
        //   selection_value: selection.pointsMetadata?.targetOverPoints,
        //   odds: Number(selection.displayOdds),
        //   time_type: 'OTHER'
        // })
      }
    } catch (err) {
      log(err)
    }

    if (wager_item) {
      wager_inserts.push(wager_item)
    }
  }

  if (dry) {
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
    const argv = initialize_cli()
    const auth = argv.auth

    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null
    const placed_before = argv.placed_before
      ? dayjs(argv.placed_before, 'YYYY-MM-DD')
      : null
    const filename = argv.filename
    await import_draftkings_wagers({
      filename,
      authorization: auth,
      placed_after,
      placed_before,
      dry: argv.dry
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

export default import_draftkings_wagers
