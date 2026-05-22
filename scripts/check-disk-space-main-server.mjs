import { execSync } from 'child_process'
import debug from 'debug'

import { is_main, report_job } from '#libs-server'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('check-disk-space')
debug.enable('check-disk-space')

const signal_log = create_logger('check-disk-space', { service: 'league-host' })

const check_disk_space = async () => {
  const threshold = 1048576 // 1 GB in kilobytes

  log('Checking disk space...')

  const available_space = execSync("df / | grep / | awk '{ print $4 }'")
    .toString()
    .trim()

  log(`Available space: ${available_space} KB`)

  try {
    if (Number(available_space) < threshold) {
      log('Available space is below threshold. Emitting signal...')

      const emitted = signal_log.error(
        new Error(
          `Low disk space on main server: ${available_space} KB available (threshold ${threshold} KB)`
        ),
        {
          severity: 'high',
          context: {
            available_space_kb: Number(available_space),
            threshold_kb: threshold,
            mount: '/'
          }
        }
      )
      if (emitted?.promise) {
        await emitted.promise
      }
    } else {
      log('Disk space is sufficient.')
    }
  } catch (error) {
    log('Error checking disk space:', error)
  }
}

const main = async () => {
  let error
  try {
    await check_disk_space()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CHECK_DISK_SPACE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default check_disk_space
