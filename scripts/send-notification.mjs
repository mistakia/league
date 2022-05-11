import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { getLeague, sendNotifications, isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
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

if (isMain()) {
  main()
}

export default run
