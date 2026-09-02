import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('template')
enable_debug_namespaces('template')

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

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default script
