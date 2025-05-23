import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

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

  await report_job({
    job_type: job_types.EXAMPLE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default script
