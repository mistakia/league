// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const argv = require('yargs').argv

const { getLeague, sendNotifications } = require('../utils')

const log = debug('send-notification')
debug.enable('send-notification')

const run = async ({ message, dry = false }) => {
  if (!message) {
    return
  }

  log(message)

  if (dry) {
    return
  }

  const leagueId = 1
  const league = await getLeague(leagueId)
  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })
}

module.exports = run

const main = async () => {
  let error
  try {
    await run({
      message: argv.message,
      dry: argv.dry
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (!module.parent) {
  main()
}
