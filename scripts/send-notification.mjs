import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { getLeague, sendNotifications, is_main } from '#libs-server'

const log = debug('send-notification')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const run = async ({ message, dry = false }) => {
  if (!message) {
    return
  }

  log(message)

  if (dry) {
    return
  }

  const lid = 1
  const league = await getLeague({ lid })
  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    debug.enable('send-notification')
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

if (is_main(import.meta.url)) {
  main()
}

export default run
