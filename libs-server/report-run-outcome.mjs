import { execFile } from 'child_process'
import { promisify } from 'util'

const exec_file = promisify(execFile)

const BASE_CLI = process.env.BASE_CLI_PATH || '/root/.base/bin/base'

const VALID_OUTCOMES = new Set([
  'success',
  'failure',
  'awaiting_operator',
  'alive'
])

export default async function report_run_outcome({
  source,
  outcome,
  reason = null,
  exit_code = null
}) {
  if (!source) throw new Error('source is required')
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`outcome must be one of ${[...VALID_OUTCOMES].join(', ')}`)
  }

  const api_url = process.env.BASE_API_URL
  if (!api_url) return false

  // Single canonical client: `base run report` owns transport + machine-token
  // auth + host identity. Supports the mid-run `alive` outcome the live odds
  // and plays workers emit. See user:text/base/machine-token-auth.md.
  const args = ['run', 'report', '--source', source, '--outcome', outcome]
  if (exit_code != null) args.push('--exit-code', String(exit_code))
  if (reason) args.push('--reason', reason)

  try {
    await exec_file(BASE_CLI, args, { timeout: 10000 })
    return true
  } catch {
    return false
  }
}
