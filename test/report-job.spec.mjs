/* global describe it */

import * as chai from 'chai'

import {
  should_emit_log_error,
  is_connection_error,
  with_connection_retry
} from '#libs-server/report-job.mjs'

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
        api_url: 'https://signals.example'
      })
    ).to.equal(false)
  })

  it('suppresses the log_error twin when a resolvable pipeline_failure is emitted', () => {
    // job_id + api_url both present -> `base run report` emits a resolvable
    // pipeline_failure that auto-resolves on recovery, so the emit-only
    // log_error twin would be permanently-open noise.
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: 'league-import-pinnacle-odds',
        api_url: 'https://signals.example'
      })
    ).to.equal(false)
  })

  it('emits the log_error when the API URL is unconfigured (no runs-primitive twin)', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: 'league-import-pinnacle-odds',
        api_url: undefined
      })
    ).to.equal(true)
  })

  it('emits the log_error when the job_type is unmapped (no runs-primitive twin)', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: undefined,
        api_url: 'https://signals.example'
      })
    ).to.equal(true)
  })

  it('emits the log_error when neither a mapped job nor an API URL is present', () => {
    expect(
      should_emit_log_error({
        job_success: false,
        job_id: undefined,
        api_url: undefined
      })
    ).to.equal(true)
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
