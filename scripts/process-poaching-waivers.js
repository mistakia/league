// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const { constants } = require('../common')
const {
  sendNotifications,
  submitPoach,
  resetWaiverOrder,
  getTopPoachingWaiver
} = require('../utils')
const db = require('../db')

const log = debug('process:waivers:poach')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:poach')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  // get leagueIds with pending waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)

  if (!leagueIds.length) {
    throw new Error('no waivers to process')
  }

  for (const lid of leagueIds) {
    let waiver = await getTopPoachingWaiver(lid)
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
        await submitPoach({
          release: release.map((r) => r.player),
          leagueId: waiver.lid,
          userId: waiver.userid,
          player: waiver.player,
          teamId: waiver.tid,
          team: waiver
        })

        log(
          `poaching waiver awarded to ${waiver.name} (${waiver.tid}) for ${waiver.player}`
        )

        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
        log(
          `poaching waiver unsuccessful for ${waiver.name} (${waiver.tid}) because ${error.message}`
        )
        const players = await db('player')
          .where('player', waiver.player)
          .limit(1)
        const player = players[0]
        await sendNotifications({
          leagueId: waiver.lid,
          teamIds: [waiver.tid],
          voice: false,
          league: false,
          message: `Your waiver claim to poach ${player.fname} ${player.lname} was unsuccessful.`
        })
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopPoachingWaiver(lid)
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
    type: constants.jobs.CLAIMS_WAIVERS_POACH,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
