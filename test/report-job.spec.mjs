/* global describe it */

import * as chai from 'chai'

import { should_emit_log_error } from '#libs-server/report-job.mjs'

const expect = chai.expect

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
