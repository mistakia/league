import { Errors } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'
import { report_job } from '#libs-server'

import processActiveWaivers from './process-waivers-free-agency-active.mjs'
import processPracticeWaivers from './process-waivers-free-agency-practice.mjs'

const runActive = async () => {
  let error
  try {
    await processActiveWaivers()
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

const runPractice = async () => {
  let error = null
  try {
    await processPracticeWaivers()
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

const main = async () => {
  await runActive()
  await runPractice()

  process.exit()
}

main()
