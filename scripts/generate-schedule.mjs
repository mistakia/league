import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, generateSchedule, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('generate-schedule')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const run = async ({ lid, team_order }) => {
  log(`generating schedule for league: ${lid}`)
  log(`drawn team order: ${team_order.join(',')}`)
  const inserts = await generateSchedule({ lid, team_order })
  log(`wrote ${inserts.length} matchups`)
  return inserts
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    debug.enable('generate-schedule')

    const lid = argv.lid
    if (!lid) {
      throw new Error('missing --lid')
    }

    // The schedule is a published draw result, not a private roll. `--team_order`
    // is the order the league's verifiable draw produced; the record for it lives
    // in user-base under data/league/draws/.
    if (!argv.team_order) {
      throw new Error(
        'missing --team_order (comma-separated team uids in drawn order)'
      )
    }

    const team_order = String(argv.team_order)
      .split(',')
      .map((value) => Number(value.trim()))

    if (team_order.some((uid) => !Number.isInteger(uid))) {
      throw new Error(
        `--team_order is not a list of integers: ${argv.team_order}`
      )
    }

    await run({ lid, team_order })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_SCHEDULE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
