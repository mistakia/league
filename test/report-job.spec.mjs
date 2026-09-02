/* global describe it */

import * as chai from 'chai'

import {
  should_emit_log_error,
  is_connection_error,
  with_connection_retry,
  resolve_log_forensic_link
} from '#libs-server/report-job.mjs'
import { should_report_run_to_ledger } from '#libs-server/should-report-run-to-ledger.mjs'

const expect = chai.expect

const make_error = ({ name, code, message } = {}) => {
  const err = new Error(message || 'boom')
  if (name) err.name = name
  if (code) err.code = code
  return err
}

describe('LIBS-SERVER report_job should_emit_log_error', function () {
  it('does not emit for a successful run', () => {
    expect(
      should_emit_log_error({
        job_success: true,
        job_id: 'league-import-pinnacle-odds',
        base_cli: '/root/.base/bin/base'
      })
    ).to.equal(false)
  })

  it('suppresses the log_error twin when a resolvable pipeline_failure is emitted', () => {
    // job_id + a runnable CLI -> `base run report` emits a resolvable
    // pipeline_failure that auto-resolves on recovery, so the emit-only
    // log_error twin would be permanently-open noise.
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: 'league-import-pinnacle-odds',
        base_cli: '/root/.base/bin/base'
      })
    ).to.equal(false)
  })

  it('still reports on the writer host, where BASE_API_URL is deliberately absent', () => {
    // The regression this replaced: the second condition was BASE_API_URL, and
    // base's job-wrapper STRIPS that variable on a host with a local base-api
    // UDS so `base run report` writes over the socket instead. Reading its
    // absence as "unreportable" is what made every league job scheduled on
    // base-storage report nowhere for eleven days -- and it suppressed the
    // log_error fallback too, so the failure had no channel at all. Nothing
    // about the environment here names an API url, which is the point.
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: 'league-import-nfl-pro-plays',
        base_cli: '/home/user/bin/base'
      })
    ).to.equal(false)
  })

  it('emits the log_error when no base CLI is runnable (no runs-primitive twin)', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: 'league-import-pinnacle-odds',
        base_cli: null
      })
    ).to.equal(true)
  })

  it('emits the log_error when the job_type is unmapped (no runs-primitive twin)', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: undefined,
        base_cli: '/root/.base/bin/base'
      })
    ).to.equal(true)
  })

  it('emits the log_error when neither a mapped job nor a runnable CLI is present', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: undefined,
        base_cli: null
      })
    ).to.equal(true)
  })
})

describe('LIBS-SERVER report_job should_report_run_to_ledger', function () {
  it('reports a production run, which is what every declared executor is', () => {
    // The live shape for all 106 node crontab lines (which set
    // NODE_ENV=production inline) and for the pm2 workers (reloaded with
    // --env production, which is what applies their env_production block).
    expect(should_report_run_to_ledger({ node_env: 'production' })).to.equal(
      true
    )
  })

  it('does NOT report a development run, the signal-127954 shape', () => {
    // The incident: an ad-hoc laptop run loaded config-development.json, whose
    // committed placeholder names a `league_development` role existing on no
    // host, and reported its config-load failure to the PRODUCTION ledger under
    // the same service: key the league host's crontab uses. That opened a real
    // pipeline_failure carrying a run_host with no executor.
    expect(should_report_run_to_ledger({ node_env: 'development' })).to.equal(
      false
    )
  })

  it('does NOT report a test run', () => {
    expect(should_report_run_to_ledger({ node_env: 'test' })).to.equal(false)
  })

  it('does NOT report when NODE_ENV is unset', () => {
    // A bare `node scripts/<name>.mjs` with no environment at all. This is the
    // easiest way to reach report_job by hand and must stay the safe direction:
    // absent means "not a declared pipeline", never "assume production".
    expect(should_report_run_to_ledger({ node_env: undefined })).to.equal(false)
  })

  it('does NOT report a value that merely CONTAINS production', () => {
    // Guards the predicate against being loosened to a substring or prefix
    // test, which would let `not-production` through.
    expect(
      should_report_run_to_ledger({ node_env: 'not-production' })
    ).to.equal(false)
    expect(
      should_report_run_to_ledger({ node_env: 'production-mirror' })
    ).to.equal(false)
  })
})

describe('LIBS-SERVER report_job resolve_log_forensic_link', function () {
  // The reader is injected because an ESM namespace object is frozen, so a test
  // that monkeypatches fs.readlinkSync silently does nothing and reports a green
  // it never earned -- the same reason the gate scanners take their readers as
  // parameters.
  const with_link = (target) =>
    resolve_log_forensic_link({
      read_link: () => {
        if (target instanceof Error) throw target
        return target
      }
    })

  it('resolves a cron-redirected stdout to its log file', () => {
    // The live shape. Verified against digitalocean-0: a crontab line ending in
    // `>> /var/log/league/<name>.log 2>&1` makes /proc/self/fd/1 readlink to
    // exactly that path.
    expect(with_link('/var/log/league/import-plays-preseason.log')).to.equal(
      'file:///var/log/league/import-plays-preseason.log'
    )
  })

  it('drops a pipe, which is not evidence anyone can retrieve later', () => {
    // Also verified on digitalocean-0: an un-redirected run resolves here.
    expect(with_link('pipe:[345995878]')).to.equal(null)
  })

  it('drops a socket', () => {
    expect(with_link('socket:[123456]')).to.equal(null)
  })

  it('drops a tty', () => {
    expect(with_link('/dev/pts/0')).to.equal(null)
  })

  it('drops /dev/null, which is an absolute path holding nothing', () => {
    // This is the one an "is it absolute" test alone gets wrong: /dev/null
    // passes that check and points at no evidence whatsoever.
    expect(with_link('/dev/null')).to.equal(null)
  })

  it('returns null rather than throwing where there is no procfs', () => {
    // macOS and any container without /proc. A report_job that threw here would
    // lose the outcome entirely over a missing nicety.
    const err = new Error('ENOENT: no such file or directory')
    err.code = 'ENOENT'
    expect(with_link(err)).to.equal(null)
  })
})

describe('LIBS-SERVER report_job is_connection_error', function () {
  it('classifies a KnexTimeoutError (pool acquisition) as connection-class', () => {
    // This is the signal-120514 shape: pool could not hand out a live
    // connection, so the error carries no sql/bindings.
    expect(
      is_connection_error(make_error({ name: 'KnexTimeoutError' }))
    ).to.equal(true)
  })

  it('classifies a pg connection-reset code as connection-class', () => {
    expect(is_connection_error(make_error({ code: 'ECONNRESET' }))).to.equal(
      true
    )
  })

  it('classifies a pg admin_shutdown (57P01) as connection-class', () => {
    expect(is_connection_error(make_error({ code: '57P01' }))).to.equal(true)
  })

  it('classifies a "Connection terminated unexpectedly" message as connection-class', () => {
    expect(
      is_connection_error(
        make_error({ message: 'Connection terminated unexpectedly' })
      )
    ).to.equal(true)
  })

  it('does NOT classify a genuine query error as connection-class', () => {
    // A constraint violation must surface, not be retried and swallowed.
    expect(
      is_connection_error(
        make_error({
          code: '23505',
          message: 'duplicate key value violates unique constraint'
        })
      )
    ).to.equal(false)
  })

  it('returns false for a null error', () => {
    expect(is_connection_error(null)).to.equal(false)
  })
})

describe('LIBS-SERVER report_job with_connection_retry', function () {
  const opts = { attempts: 3, delay_ms: 0 }

  it('returns the result without retrying when the operation succeeds', async () => {
    let calls = 0
    const result = await with_connection_retry(async () => {
      calls += 1
      return 'ok'
    }, opts)
    expect(result).to.equal('ok')
    expect(calls).to.equal(1)
  })

  it('retries on a connection-class error then succeeds on a fresh connection', async () => {
    let calls = 0
    const result = await with_connection_retry(async () => {
      calls += 1
      if (calls < 2) throw make_error({ name: 'KnexTimeoutError' })
      return 'ok'
    }, opts)
    expect(result).to.equal('ok')
    expect(calls).to.equal(2)
  })

  it('throws immediately on a non-connection error (no retry, no masking)', async () => {
    let calls = 0
    let thrown
    try {
      await with_connection_retry(async () => {
        calls += 1
        throw make_error({ code: '23505', message: 'unique violation' })
      }, opts)
    } catch (err) {
      thrown = err
    }
    expect(thrown).to.exist
    expect(thrown.code).to.equal('23505')
    expect(calls).to.equal(1)
  })

  it('gives up after the attempt bound on a persistent connection outage', async () => {
    let calls = 0
    let thrown
    try {
      await with_connection_retry(async () => {
        calls += 1
        throw make_error({ code: 'ECONNRESET' })
      }, opts)
    } catch (err) {
      thrown = err
    }
    expect(thrown).to.exist
    expect(thrown.code).to.equal('ECONNRESET')
    expect(calls).to.equal(3)
  })
})
