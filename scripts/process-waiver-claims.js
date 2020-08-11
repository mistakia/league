// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const db = require('../db')
const { constants } = require('../common')
const {
  submitAcquisition,
  getTopFreeAgencyWaiver
} = require('../utils')

const log = debug('process:waivers:freeagency')
debug.enable('process:waivers:freeagency,knex:query,knex:bindings')

// const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  // get leagueIds with pending faab waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('lid')

  const leagueIds = results.map(w => w.lid)
  if (!leagueIds.length) {
    log('no waivers to process')
    process.exit()
  }

  for (const lid of leagueIds) {
    let waiver = await getTopFreeAgencyWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      // let error
      try {
        await submitAcquisition({
          leagueId: lid,
          drop: waiver.drop,
          player: waiver.player,
          teamId: waiver.tid,
          bid: waiver.bid,
          userId: waiver.userid
        })

        if (waiver.drop) {
          // process any other waivers with this drop player
        }

        // reset waiver order if necessary
      } catch (err) {
        // error = err
      }

      // save waiver result

      waiver = await getTopFreeAgencyWaiver(lid)
    }
  }
}

const main = async () => {
  await run()
  process.exit()
}

try {
  main()
} catch (error) {
  console.log(error)
}
