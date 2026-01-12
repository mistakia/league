import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// Team-specific notifications for poaching claims were removed.
// This script previously sent 8-hour warnings to team owners.
const run = async () => {}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NOTIFICATIONS_POACH_8HR,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
