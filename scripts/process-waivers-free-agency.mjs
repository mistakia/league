import { Errors } from '#libs-shared'
import { waiver_types } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { report_job, get_waiver_by_id } from '#libs-server'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import processActiveWaivers from './process-waivers-free-agency-active.mjs'
import processPracticeWaivers from './process-waivers-free-agency-practice.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('wid', {
      alias: 'waiver-id',
      describe: 'Process a specific waiver by ID',
      type: 'string'
    })
    .option('daily', {
      describe: 'Run daily waivers',
      type: 'boolean'
    }).argv
}

const run_active = async ({ daily = false }) => {
  let error
  try {
    await processActiveWaivers({ daily })
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error ||
      error instanceof Errors.EmptyFreeAgencyWaivers ||
      error instanceof Errors.NotRegularSeason
  )

  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_ACTIVE,
    job_success,
    job_reason: error ? error.message : null
  })
}

const run_practice = async ({ daily = false }) => {
  let error = null
  try {
    await processPracticeWaivers({ daily })
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error || error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
  )

  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_PRACTICE,
    job_success,
    job_reason: error ? error.message : null
  })
}

const process_specific_waiver = async (waiver_id) => {
  let error
  try {
    const waiver = await get_waiver_by_id(waiver_id)

    if (waiver.waiver_type === waiver_types.FREE_AGENCY) {
      await processActiveWaivers({ daily: false, wid: waiver_id })
    } else if (waiver.waiver_type === waiver_types.FREE_AGENCY_PRACTICE) {
      await processPracticeWaivers({ daily: false, wid: waiver_id })
    } else {
      throw new Error(`Unsupported waiver type: ${waiver.waiver_type}`)
    }
  } catch (err) {
    error = err
  }

  const job_success = Boolean(!error)
  if (!job_success) {
    console.log(error)
  }

  const job_type = error
    ? null
    : error instanceof Error && error.message.includes('FREE_AGENCY_PRACTICE')
      ? job_types.CLAIMS_WAIVERS_PRACTICE
      : job_types.CLAIMS_WAIVERS_ACTIVE

  if (job_type) {
    await report_job({
      job_type,
      job_success,
      job_reason: error ? error.message : null
    })
  }
}

const main = async () => {
  const argv = initialize_cli()
  if (argv.wid) {
    await process_specific_waiver(argv.wid)
  } else {
    const daily = argv.daily
    await run_active({ daily })
    await run_practice({ daily })
  }

  process.exit()
}

main()
