// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const moment = require('moment-timezone')
const debug = require('debug')

const db = require('../db')
const { constants } = require('../common')
const {
  submitAcquisition,
  resetWaiverOrder,
  getTopFreeAgencyWaiver
} = require('../utils')

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  if (!constants.season.isRegularSeason) {
    throw new Error('outside regular season')
  } else {
    const now = moment.tz('America/New_York')
    // do not run on tuesdays
    if (now.day() === 2) {
      return
    }

    // do not run before 2:59pm on wednesday
    if (now.day() === 3 && now.hour() < 14 && now.minute() < 59) {
      return
    }
  }

  // get leagueIds with pending faab waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('lid')

  const leagueIds = results.map(w => w.lid)
  if (!leagueIds.length) {
    throw new Error('no waivers to process')
  }

  for (const lid of leagueIds) {
    let waiver = await getTopFreeAgencyWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error
      try {
        await submitAcquisition({
          leagueId: lid,
          drop: waiver.drop,
          player: waiver.player,
          teamId: waiver.tid,
          bid: waiver.bid,
          userId: waiver.userid
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

        // reset waiver order if necessary
        const tiedWaivers = await db('waivers').where({
          bid: waiver.bid,
          player: waiver.player,
          lid: waiver.lid
        }).whereNot('uid', waiver.wid)

        if (tiedWaivers.length) {
          await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
        }

        // update team budget
        await db('teams')
          .decrement('faab', waiver.bid)
          .where('uid', waiver.tid)
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

      waiver = await getTopFreeAgencyWaiver(lid)
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
    type: constants.jobs.CLAIMS_WAIVERS_ACTIVE,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
