import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, insert_prop_markets, betrivers } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-betrivers-odds')
debug.enable('import-betrivers-odds,insert-prop-market')

const import_betrivers_odds = async () => {
  const formatted_markets = []
  const all_markets = []
  const timestamp = Math.round(Date.now() / 1000)

  const format_market = ({ offer, event }) => ({
    market_id: String(offer.id),
    source_id: constants.sources.BETRIVERS_MD,
    source_event_id: String(event.id),
    source_market_name: offer.betDescription,
    market_name: `${event.name} - ${offer.betDescription}`,
    open: offer.status === 'OPEN',
    live: false,
    runners: offer.outcomes.length,
    market_type: null,
    timestamp
  })

  const market_groups = await betrivers.get_market_groups()
  for (const market_group of market_groups) {
    const group_events = await betrivers.get_group_events(market_group.id)
    for (const event of group_events) {
      if (event.betOffers.length !== event.offerCount) {
        const event_markets = await betrivers.get_event_markets(event.id)
        for (const offering_group of event_markets.offeringGroups) {
          for (const criterion_group of offering_group.criterionGroups) {
            for (const offer of criterion_group.betOffers) {
              all_markets.push(offer)
              formatted_markets.push(format_market({ event, offer }))
            }
          }
        }
        continue
      }

      for (const offer of event.betOffers) {
        all_markets.push(offer)
        formatted_markets.push(format_market({ event, offer }))
      }
    }
  }

  if (argv.write) {
    await fs.writeFile(
      `./betrivers-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
    return
  }

  if (formatted_markets.length) {
    log(`inserting ${formatted_markets.length} markets`)
    await insert_prop_markets(formatted_markets)
  }
}

export const job = async () => {
  let error
  try {
    await import_betrivers_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.BETRIVERS_ODDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_betrivers_odds
