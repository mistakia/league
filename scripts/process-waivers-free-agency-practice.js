// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const db = require('../db')
const { constants } = require('../common')
const {
  submitAcquisition,
  resetWaiverOrder,
  getTopPracticeSquadWaiver
} = require('../utils')

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return
  }

  // get leagueIds with pending practice squad waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
    .groupBy('lid')

  const leagueIds = results.map(w => w.lid)
  if (!leagueIds.length) {
    throw new Error('no waivers to process')
  }

  for (const lid of leagueIds) {
    let waiver = await getTopPracticeSquadWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error
      try {
        let value = 0
        if (!constants.season.isRegularSeason) {
          const transactions = await db('transactions')
            .where({
              lid,
              type: constants.transactions.DRAFT,
              player: waiver.player
            })

          if (transactions.length) {
            value = transactions[0].value
          }
        }

        await submitAcquisition({
          leagueId: lid,
          drop: waiver.drop,
          player: waiver.player,
          teamId: waiver.tid,
          bid: value,
          userId: waiver.userid,
          slot: constants.slots.PS
        })

        // cancel any outstanding waivers with the same drop player
        if (waiver.drop) {
          await db('waivers')
            .update({
              succ: 0,
              reason: 'invalid drop',
              processed: timestamp
            })
            .whereNull('processed')
            .whereNull('cancelled')
            .where({
              drop: waiver.drop,
              tid: waiver.tid
            })
        }

        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopPracticeSquadWaiver(lid)
    }
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CLAIMS_WAIVERS_PRACTICE,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
