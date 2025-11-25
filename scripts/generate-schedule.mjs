import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, generateSchedule, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('generate-schedule')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const run = async ({ lid, random_seed }) => {
  log(`generating schedule for league: ${lid}`)
  await generateSchedule({ lid, random_seed })
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    debug.enable('generate-schedule')
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

  await report_job({
    job_type: job_types.GENERATE_SCHEDULE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
