// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const moment = require('moment')

const { constants } = require('../common')
const { sendNotifications } = require('../utils')
const db = require('../db')

const run = async () => {
  // get list of poaches that were submitted more than 40 hours ago
  // player still on practice squad
  const cutoff = moment().subtract('40', 'hours').format('X')
  const claims = await db('poaches')
    .select('rosters.tid', 'player.*', 'rosters.lid')
    .join('rosters_players', 'poaches.player', 'rosters_players.player')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .join('player', 'poaches.player', 'player.player')
    .where('year', constants.season.year)
    .where('week', constants.season.week)
    .where('slot', constants.slots.PS)
    .where('submitted', '<', cutoff)
    .whereNull('processed')

  if (!claims.length) {
    throw new Error('no claims to notify')
  }

  // for each claim, notify the team owners
  for (const claim of claims) {
    const time = moment(claim.submitted, 'X').add('48', 'hours').utcOffset(-4)
    const message = `The poaching claim for ${claim.fname} ${claim.lname} (${
      claim.pos
    }) will be processed ${time.toNow()} around ${time.format(
      'dddd, MMMM Do h:mm a'
    )} EST.`
    await sendNotifications({
      leagueId: claim.lid,
      teamIds: [claim.tid],
      voice: false,
      league: false,
      message
    })
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
    type: constants.jobs.NOTIFICATIONS_POACH_8HR,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
