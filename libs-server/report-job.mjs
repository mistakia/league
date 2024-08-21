import db from '#db'

import report_error from './report-error.mjs'

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
}
