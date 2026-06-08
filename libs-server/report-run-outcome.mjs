import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'

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

  const sign_env = {
    ...process.env,
    USER_BASE_DIRECTORY:
      process.env.USER_BASE_DIRECTORY ||
      `${process.env.HOME || '/root'}/.base-stub`
  }

  let token
  try {
    const { stdout } = await exec_file(
      BASE_CLI,
      ['instance', 'sign-token'],
      { env: sign_env, timeout: 5000 }
    )
    token = stdout.trim().split('\n').pop().trim()
  } catch {
    return false
  }
  if (!token) return false

  const body = {
    source,
    host: os.hostname().split('.')[0],
    outcome,
    exit_code
  }
  if (reason) body.reason = reason

  try {
    const res = await fetch(`${api_url.replace(/\/$/, '')}/api/runs/report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Machine ${token}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })
    return res.ok
  } catch {
    return false
  }
}
