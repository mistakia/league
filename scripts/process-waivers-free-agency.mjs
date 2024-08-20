import db from '#db'
import { Errors } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

import processActiveWaivers from './process-waivers-free-agency-active.mjs'
import processPracticeWaivers from './process-waivers-free-agency-practice.mjs'

const runActive = async () => {
  let error
  try {
    await processActiveWaivers()
  } catch (err) {
    error = err
  }

  const succ =
    !error ||
    error instanceof Errors.EmptyFreeAgencyWaivers ||
    error instanceof Errors.NotRegularSeason
      ? 1
      : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: job_types.CLAIMS_WAIVERS_ACTIVE,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })
}

const runPractice = async () => {
  let error = null
  try {
    await processPracticeWaivers()
  } catch (err) {
    error = err
  }

  const succ =
    !error || error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
      ? 1
      : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: job_types.CLAIMS_WAIVERS_PRACTICE,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })
}

const main = async () => {
  await runActive()
  await runPractice()

  process.exit()
}

main()
