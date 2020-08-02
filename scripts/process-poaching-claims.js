// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const moment = require('moment')
const debug = require('debug')

const db = require('../db')
const { processPoach } = require('../utils')

const log = debug('process:claims')
debug.enable('process:claims')

const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const cutoff = moment().subtract('48', 'hours').format('X')
  const claims = await db('poaches')
    .where('submitted', '<', cutoff)
    .whereNull('processed')

  if (!claims.length) {
    log('no claims to process')
    process.exit()
  }

  for (const claim of claims) {
    let error
    try {
      await processPoach(claim)
      log(`poaching claim awarded to teamId: (${claim.tid}) for ${claim.player}`)
    } catch (err) {
      error = err
      log(`poaching claim unsuccessful by teamId: (${claim.tid}) because ${error.message}`)
      await sendNotifications({
        leagueId: claim.lid,
        teamIds: [claim.tid],
        voice: false,
        league: false,
        message: `Your poaching claim was unsuccessful.` // TODO - update add player info
      })
    }

    await db('poaches')
      .update('processed', timestamp)
      .update('reason', error ? error.message : null) // TODO - add error codes
      .where({
        player: claim.player,
        tid: claim.tid,
        lid: claim.lid
      })
  }

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
