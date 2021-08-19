// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const db = require('../db')
const { constants } = require('../common')

const log = debug('reset-protected-designation')
debug.enable('reset-protected-designation')

const run = async () => {
  if (constants.season.week !== 0) {
    log('abort, during regular season')
    return
  }

  // reset protection for current PS players
  const rowCount = await db('rosters_players')
    .update({ slot: constants.slots.PS })
    .join('rosters', 'rosters.uid', 'rosters_players.rid')
    .where({
      week: 0,
      slot: constants.slots.PSP,
      year: constants.season.year
    })

  log(`updated ${rowCount} practice squad players`)
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
    type: constants.jobs.RESET_PROTECTED_DESIGNATION,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
