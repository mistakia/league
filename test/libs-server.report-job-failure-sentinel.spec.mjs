/* global describe it */
import * as chai from 'chai'

import { emit_failure_sentinel } from '#libs-server/report-job.mjs'

const expect = chai.expect

/*
  This sentinel is a CROSS-REPO contract, which is why it is worth a spec of
  its own: the producer is here, and the only consumer is
  `shared/binfiles/job-wrapper.sh` in the bootstrap repo, which finds the line
  by `grep -m1 'JOB_FAILURE_REASON:'` and takes everything after the colon.
  Nothing in either repo's build sees both halves, so a change to the prefix or
  to the single-line property breaks the wrapper silently -- the reason field
  quietly reverts to the positional stderr tail, which is the exact defect this
  exists to fix (signals 128346 and 128347, 2026-09-04) and which looks like a
  populated field rather than a broken one.

  The two properties asserted below are the two the wrapper actually depends
  on. Everything else about the line is free to change.
*/
describe('report_job failure sentinel', function () {
  const capture = (reason) => {
    let line = null
    const returned = emit_failure_sentinel(reason, {
      write: (value) => {
        line = value
      }
    })
    return { line, returned }
  }

  it('prefixes the reason with the token the wrapper greps for', function () {
    const { line } = capture('connect ECONNREFUSED 127.0.0.1:5432')
    expect(line).to.equal(
      'JOB_FAILURE_REASON: connect ECONNREFUSED 127.0.0.1:5432'
    )
  })

  it('collapses a multi-line error onto one line, keeping the tail', function () {
    // A postgres error puts the part that names the defect AFTER the bind
    // list, so a sentinel truncated at the first newline would drop precisely
    // the half worth reading.
    const { line } = capture(
      'insert into "jobs" - error\ncolumn "foo" does not exist\n  at Parser.parse'
    )
    expect(line).to.not.include('\n')
    expect(line).to.include('column "foo" does not exist')
  })

  it('emits nothing when there is no reason to state', function () {
    // An empty sentinel would beat the stderr tail while saying less than it,
    // so the wrapper must not find one at all in this case.
    for (const empty of [null, undefined, '', '   \n  ']) {
      const { line, returned } = capture(empty)
      expect(returned, `for ${JSON.stringify(empty)}`).to.equal(null)
      expect(line, `for ${JSON.stringify(empty)}`).to.equal(null)
    }
  })

  it('bounds a runaway reason', function () {
    // knex renders every bind parameter into error.message, so a failed batch
    // insert produces a megabytes-long message.
    const { line } = capture('x'.repeat(100000))
    expect(line.length).to.be.below(1100)
    expect(line).to.include('[truncated]')
  })
})
