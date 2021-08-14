// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const argv = require('yargs').argv

const db = require('../db')
const { constants } = require('../common')
const { generateSchedule } = require('../utils')

const log = debug('generate-schedule')
debug.enable('generate-schedule')

const run = async ({ lid }) => {
  log(`generating schedule for league: ${lid}`)
  await generateSchedule({ lid })
}

module.exports = run

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }
    await run({ lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GENERATE_SCHEDULE,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
