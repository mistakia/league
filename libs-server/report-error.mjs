import { job_title_by_id } from '#libs-shared/job-constants.mjs'
import { create_logger } from '#libs-shared/log.mjs'

const log = create_logger('report-error', { service: 'league-server' })

export default async function report_error({ job_type, error, message }) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const job_title = job_type ? job_title_by_id[job_type] : null
  const error_for_emit =
    error instanceof Error
      ? error
      : new Error(job_title ? `${job_title}: ${message}` : message)

  log.error(error_for_emit, {
    severity: 'high',
    context: {
      job_type: job_type || null,
      job_title,
      reported_message: message,
      error_message: error?.message || null,
      stack: error?.stack || null
    }
  })
}
