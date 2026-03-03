import os from 'os'

import db from '#db'
import config from '#config'

import report_error from './report-error.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

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
  error = null,
  duration_ms = null,
  schedule = null,
  schedule_type = null
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

  const { api_url, api_key } = config.job_tracker || {}
  if (!api_url || !api_key) {
    return
  }

  const effective_duration_ms =
    duration_ms ?? Math.round(process.uptime() * 1000)

  try {
    const response = await fetch(`${api_url}/api/jobs/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api_key}`
      },
      body: JSON.stringify({
        job_id,
        success: job_success,
        reason: job_reason,
        duration_ms: effective_duration_ms,
        project: 'league',
        server: os.hostname(),
        schedule,
        schedule_type
      })
    })
    if (!response.ok) {
      console.error(`job tracker report failed: HTTP ${response.status}`)
    }
  } catch (err) {
    console.error(`job tracker report failed: ${err.message}`)
  }
}
