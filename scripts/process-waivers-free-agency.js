// eslint-disable-next-line
require = require('esm')(module /*, options*/)
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
  } else if (constants.season.isWaiverPeriod) {
    return
  }

  // get leagueIds with pending faab waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)
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
        const release = await db('waiver_releases')
          .select('player')
          .where('waiverid', waiver.uid)
        await submitAcquisition({
          release: release.map((r) => r.player),
          leagueId: lid,
          player: waiver.player,
          teamId: waiver.tid,
          bid: waiver.bid,
          userId: waiver.userid
        })

        // cancel any outstanding waivers with the same release player
        if (release.length) {
          await db('waivers')
            .update({
              succ: 0,
              reason: 'invalid release',
              processed: timestamp
            })
            .join('waiver_releases', 'waiver_releases.waiverid', 'waviers.uid')
            .whereNull('processed')
            .whereNull('cancelled')
            .where('tid', waiver.tid)
            .whereIn('waiver_releases', release)
        }

        // reset waiver order if necessary
        const tiedWaivers = await db('waivers')
          .where({
            bid: waiver.bid,
            player: waiver.player,
            lid: waiver.lid
          })
          .whereNot('uid', waiver.wid)
          .whereNot('tid', waiver.tid)
          .whereNull('processed')
          .whereNull('cancelled')

        if (tiedWaivers.length) {
          await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
        }

        // update team budget
        await db('teams').decrement('faab', waiver.bid).where('uid', waiver.tid)
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
