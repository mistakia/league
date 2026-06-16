import { execFile } from 'child_process'
import { promisify } from 'util'

import db from '#db'

import report_error from './report-error.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const exec_file = promisify(execFile)

// Resolve base by absolute path, not bare `base` on PATH: the pm2 worker process
// env does not include ~/.base/bin, so a bare `base` spawn ENOENTs and every run
// report is silently lost. Mirrors report-run-outcome.mjs and the base
// job-wrapper.sh absolute-path resolution. See user:text/base/machine-token-auth.md.
const BASE_CLI = process.env.BASE_CLI_PATH || '/root/.base/bin/base'

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

  // Single canonical client: `base run report` owns transport + machine-token
  // auth + host identity. The local jobs-table insert and Slack error report
  // above are league-specific side effects and stay. No hand-rolled
  // sign-token+curl. See user:text/base/machine-token-auth.md.
  const args = [
    'run',
    'report',
    '--source',
    source,
    '--outcome',
    outcome,
    '--exit-code',
    job_success ? '0' : '1'
  ]
  if (job_reason) args.push('--reason', job_reason)

  try {
    await exec_file(BASE_CLI, args, { timeout: 5000 })
  } catch (err) {
    console.error(`run report failed: ${err.message}`)
  }
}
