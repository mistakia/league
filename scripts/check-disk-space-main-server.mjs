import { execSync } from 'child_process'
import fetch from 'node-fetch'
import debug from 'debug'

import { is_main, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('check-disk-space')
debug.enable('check-disk-space')

const check_disk_space = async () => {
  const threshold = 1048576 // 1 GB in kilobytes

  log('Checking disk space...')

  const available_space = execSync("df / | grep / | awk '{ print $4 }'")
    .toString()
    .trim()

  log(`Available space: ${available_space} KB`)

  try {
    if (Number(available_space) < threshold) {
      log(
        'Available space is below threshold. Sending notification to Discord...'
      )

      const discord_webhook_url =
        config.discord_sysadmin_alerts_channel_webhook_url
      const message_data = {
        content: `Warning: Low disk space. Available space: ${available_space} KB`
      }

      try {
        const response = await fetch(discord_webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message_data)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        log('Notification sent.')
      } catch (error) {
        log('Error sending notification:', error)
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
