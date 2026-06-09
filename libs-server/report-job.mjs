import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

import db from '#db'

import report_error from './report-error.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const exec_file = promisify(execFile)

const build_job_type_to_id = () => {
  const map = {}
  for (const [name, value] of Object.entries(job_types)) {
    if (value in map) {
      throw new Error(
        `duplicate job_type value ${value} for ${name} (conflicts with existing entry)`
      )
    }
    map[value] = `league-${name.toLowerCase().replace(/_/g, '-')}`
  }
  return map
}

const job_type_to_id = build_job_type_to_id()

export default async function report_job({
  job_type,
  job_success = true,
  job_reason = null,
  error = null
}) {
  if (!job_type) {
    throw new Error('job_type is required')
  }

  if (error) {
    job_reason = error.message
    job_success = false
  }

  const job_report_timestamp = Math.round(Date.now() / 1000)

  await db('jobs').insert({
    type: job_type,
    succ: job_success,
    reason: job_reason,
    timestamp: job_report_timestamp
  })

  if (!job_success) {
    await report_error({ job_type, message: job_reason })
  }

  const job_id = job_type_to_id[job_type]
  if (!job_id) {
    return
  }

  const api_url = process.env.BASE_API_URL
  if (!api_url) {
    return
  }

  const source = process.env.JOB_SCHEDULE_ENTITY_URI || `service:${job_id}`
  const outcome = job_success ? 'success' : 'failure'

  try {
    const { stdout } = await exec_file('base', ['instance', 'sign-token'], {
      timeout: 3000
    })
    const token = stdout.trim()
    if (!token) {
      console.error('run report failed: empty machine token')
      return
    }

    const response = await fetch(`${api_url.replace(/\/$/, '')}/api/runs/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Machine ${token}`
      },
      body: JSON.stringify({
        source,
        host: os.hostname().split('.')[0],
        outcome,
        exit_code: job_success ? 0 : 1,
        reason: job_reason
      }),
      signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) {
      console.error(`run report failed: HTTP ${response.status}`)
    }
  } catch (err) {
    console.error(`run report failed: ${err.message}`)
  }
}
