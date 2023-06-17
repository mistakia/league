import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('template')
debug.enable('template')

const script = async () => {}
const main = async () => {
  let error
  try {
    await script()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.EXAMPLE,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default script
