import { execFile } from 'child_process'
import { promisify } from 'util'

import { resolve_base_cli } from './resolve-base-cli.mjs'
import { should_report_run_to_ledger } from './should-report-run-to-ledger.mjs'

const exec_file = promisify(execFile)

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

  // Same rule as report_job, and for the same reason: the ledger records
  // declared pipeline executions, and the three long-running workers that call
  // this all run under NODE_ENV=production (verified live from `pm2 jlist` on
  // league and digitalocean-0). A hand-run worker on a laptop -- the ordinary
  // way to debug one -- would otherwise write `alive`/`success`/`failure` rows
  // to the production ledger under the worker's own source key. See
  // should-report-run-to-ledger.mjs for the incident and why the gate reads the
  // environment rather than an executor marker.
  if (!should_report_run_to_ledger({ node_env: process.env.NODE_ENV })) {
    return false
  }

  // Gate on a runnable CLI, NOT on BASE_API_URL. An absent BASE_API_URL does
  // not mean "unreportable" -- on the writer host base's job-wrapper STRIPS it
  // so `base run report` writes over the local base-api UDS instead. Transport
  // selection belongs to the CLI; this only decides whether there is one.
  const base_cli = resolve_base_cli()
  if (!base_cli) return false

  // Single canonical client: `base run report` owns transport + machine-token
  // auth + host identity. Supports the mid-run `alive` outcome the live odds
  // and plays workers emit. See user:text/base/machine-token-auth.md.
  const args = ['run', 'report', '--source', source, '--outcome', outcome]
  if (exit_code != null) args.push('--exit-code', String(exit_code))
  if (reason) args.push('--reason', reason)

  try {
    await exec_file(base_cli, args, { timeout: 10000 })
    return true
  } catch {
    return false
  }
}
