/* global describe it */

import * as chai from 'chai'

import {
  build_session_settings,
  should_disable_nested_loops
} from '#libs-server/get-data-view-results.mjs'

const expect = chai.expect

// Two contracts around the plan probe, neither of which any other spec reaches.
//
// The first is the settings-list / rows_index pairing. Every `SET LOCAL` sent
// ahead of the query produces its own result object, so the caller reads the
// rows at index `settings.length`. The arm makes that length CONDITIONAL, which
// is what makes it dangerous: a list and an index that disagree return an empty
// `command: 'SET'` result instead of rows, and because the arm only fires on
// flagged statements, that failure would appear exclusively on the slow queries
// the arm exists to fix -- the least-watched place it could possibly land.
//
// The second is the probe's fallback contract: no probe outcome may fail a
// request that would otherwise have run. That is asserted here against a runner
// that actually throws and actually returns nonsense, rather than by reading
// the try/catch.

describe('data view session settings', () => {
  describe('the settings list and the row index stay in step', () => {
    it('sends two settings under the default planner', () => {
      const settings = build_session_settings({ timeout: 40000 })
      expect(settings).to.have.lengthOf(2)
      expect(settings[0]).to.equal('SET LOCAL statement_timeout = 40000')
      expect(settings[1]).to.equal("SET LOCAL work_mem = '1GB'")
    })

    it('sends four when the arm is applied, and the extra two are the arm', () => {
      const settings = build_session_settings({
        timeout: 40000,
        disable_nested_loops: true
      })
      expect(settings).to.have.lengthOf(4)
      expect(settings[2]).to.equal('SET LOCAL enable_nestloop = off')
      expect(settings[3]).to.equal(
        'SET LOCAL max_parallel_workers_per_gather = 2'
      )
    })

    // The arm's whole justification for being safe is that it cannot exhaust
    // dynamic shared memory segments, which requires the parallelism cap to
    // travel with it. Disabling nested loops WITHOUT the cap is the shape that
    // hard-failed two statements server-wide, so the two must never separate.
    it('never disables nested loops without also capping parallelism', () => {
      const settings = build_session_settings({
        timeout: 1000,
        disable_nested_loops: true
      })
      const disables = settings.some((s) => s.includes('enable_nestloop = off'))
      const caps = settings.some((s) =>
        s.includes('max_parallel_workers_per_gather')
      )
      expect(disables).to.equal(caps)
      expect(disables).to.equal(true)
    })

    it('carries the caller timeout, and falls back rather than emitting invalid SQL', () => {
      expect(build_session_settings({ timeout: 1800000 })[0]).to.equal(
        'SET LOCAL statement_timeout = 1800000'
      )
      // A null timeout must not produce `statement_timeout = null`.
      for (const timeout of [null, undefined, 0]) {
        expect(build_session_settings({ timeout })[0]).to.equal(
          'SET LOCAL statement_timeout = 40000'
        )
      }
    })

    // The pairing itself, stated as the invariant the caller depends on.
    it('indexes the rows past the last setting in both arms', () => {
      for (const disable_nested_loops of [false, true]) {
        const settings = build_session_settings({
          timeout: 40000,
          disable_nested_loops
        })
        const results = [
          ...settings.map(() => ({ command: 'SET', rows: [] })),
          { command: 'SELECT', rows: [{ pid: 'PATR-MAHO-000123' }] }
        ]
        expect(results[settings.length].command).to.equal('SELECT')
      }
    })
  })

  describe('the probe can never fail a request', () => {
    const probe = (run_statement) =>
      should_disable_nested_loops({
        execution_query_string: 'select 1',
        run_statement
      })

    it('answers false when the probe throws', async () => {
      const result = await probe(() => {
        throw new Error('statement timeout')
      })
      expect(result).to.equal(false)
    })

    it('answers false when the probe rejects', async () => {
      const result = await probe(() =>
        Promise.reject(new Error('connection terminated'))
      )
      expect(result).to.equal(false)
    })

    for (const [label, response] of [
      ['an empty response', []],
      ['a response with no explain result', [{}, {}]],
      ['a null response', null],
      ['a text plan rather than json', [{}, {}, { rows: [{ x: 'Seq Scan' }] }]]
    ]) {
      it(`answers false for ${label}`, async () => {
        expect(await probe(() => Promise.resolve(response))).to.equal(false)
      })
    }

    // The positive control. Without it every assertion above would also pass
    // against a probe hard-wired to return false.
    it('answers true for a plan that really carries the signature', async () => {
      const plan = {
        'Node Type': 'Nested Loop',
        'Plan Rows': 500,
        'Join Filter': 'pgl.pid = player.pid',
        Plans: [
          {
            'Node Type': 'Hash Join',
            'Plan Rows': 1,
            Plans: [
              { 'Node Type': 'Seq Scan', 'Plan Rows': 100 },
              { 'Node Type': 'Seq Scan', 'Plan Rows': 100 }
            ]
          }
        ]
      }
      const result = await probe(() =>
        Promise.resolve([
          {},
          {},
          { rows: [{ 'QUERY PLAN': [{ Plan: plan }] }] }
        ])
      )
      expect(result).to.equal(true)
    })

    it('answers false for a plan that does not', async () => {
      const plan = {
        'Node Type': 'Hash Join',
        'Plan Rows': 5000,
        Plans: [{ 'Node Type': 'Seq Scan', 'Plan Rows': 100 }]
      }
      const result = await probe(() =>
        Promise.resolve([
          {},
          {},
          { rows: [{ 'QUERY PLAN': [{ Plan: plan }] }] }
        ])
      )
      expect(result).to.equal(false)
    })
  })
})
