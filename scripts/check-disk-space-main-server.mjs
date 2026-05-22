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

  const available_space_raw = execSync("df / | grep / | awk '{ print $4 }'")
    .toString()
    .trim()

  // Oracle: assert df produced a positive integer KB reading. "Ran without
  // throwing" is otherwise indistinguishable from df silently returning empty
  // output (e.g., grep pattern miss after a mount-table reshape), which would
  // make the threshold comparison always pass.
  const available_space_kb = Number(available_space_raw)
  if (!Number.isInteger(available_space_kb) || available_space_kb <= 0) {
    throw new Error(
      `df returned invalid disk space reading: ${JSON.stringify(available_space_raw)} (parsed as ${available_space_kb})`
    )
  }

  log(`Available space: ${available_space_kb} KB`)

  if (available_space_kb < threshold) {
    log('Available space is below threshold. Emitting signal...')

    const emitted = signal_log.error(
      new Error(
        `Low disk space on main server: ${available_space_kb} KB available (threshold ${threshold} KB)`
      ),
      {
        severity: 'high',
        context: {
          available_space_kb,
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
