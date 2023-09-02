import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, generateSchedule } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-schedule')
debug.enable('generate-schedule')

const run = async ({ lid, random_seed }) => {
  log(`generating schedule for league: ${lid}`)
  await generateSchedule({ lid, random_seed })
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const block_timestamp = argv.block_timestamp
    const block_reward = argv.block_reward
    const random_seed = block_timestamp + block_reward
    await run({ lid, random_seed })
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

if (isMain(import.meta.url)) {
  main()
}

export default run
