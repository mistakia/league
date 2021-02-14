// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')
const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:job')
debug.enable('import:job')

const { constants } = require('../common')

const run = async () => {

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
    type: constants.jobs.JOB_NAME,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
