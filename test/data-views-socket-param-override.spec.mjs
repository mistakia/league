/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The invariant moved with the queue: the executor
// (libs-server/data-views/execute-data-view-request.mjs) is now the single
// place a data-view query is executed, so the server-owned keys live there.
const executor_path = path.join(
  __dirname,
  '../libs-server/data-views/execute-data-view-request.mjs'
)

chai.should()
const expect = chai.expect

// The executor builds the run_query argument by spreading the client's table
// state (`...params`) into an object literal. Every server-owned key in that
// literal therefore has to sit AFTER the spread, because a later key wins -- a
// key written before it is a default the client can overwrite.
//
// `timeout` was written before the spread in the old queue and reached Postgres
// as SET LOCAL statement_timeout verbatim, so an anonymous caller could send
// params.timeout and run for as long as it liked against a 40s policy.
// Confirmed by execution against production on 2026-08-19: params.timeout=1 and
// params.timeout=400 each errored at exactly the injected deadline. Because
// DataViewQueue.processing was one process-wide boolean and remove_request only
// dropped entries with no user_id, that also pinned the head of the serial
// queue against every other user, and survived the abusing socket closing.
//
// `user_id` was already placed correctly, with a comment explaining why -- the
// reasoning existed and had been applied to one key and not the other.
//
// A behavioral spec is not available at the pre-fix revision: the executor
// module does not exist there, so a behavioral spec would fail on module-not-
// found rather than on the defect. So this reads the source, in the manner of
// test/app.api-service-verb-contract.spec.mjs.
//
// It discriminates on POSITION, not presence: the broken form contains the word
// `timeout` in the same call, so any grep for the token passes over the defect.

// Every key the server owns and the client must not be able to name. Add to
// this list when the executor starts passing another server-decided value.
const SERVER_OWNED_KEYS = ['timeout', 'user_id', 'calculate_total_count']

// `resolved_run_query`, not `run_query`: the executor now resolves which
// executor to call per request -- run_query_backed_view when the params carry a
// query_id, get_data_view_results otherwise -- and an explicitly passed
// run_query still wins. The rename was caught by the located-the-call assertion
// below rather than by review, which is what that assertion is for.
const read_call_argument = (source) => {
  const call_start = source.indexOf('await resolved_run_query({')
  if (call_start === -1) return null

  const open_brace = source.indexOf('{', call_start)
  let depth = 0
  for (let i = open_brace; i < source.length; i++) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open_brace, i + 1)
    }
  }
  return null
}

describe('data view executor cannot let a client override server policy', function () {
  const source = fs.readFileSync(executor_path, 'utf8')
  const call_argument = read_call_argument(source)

  it('finds the run_query call it is asserting about', function () {
    // Without this the whole file passes vacuously if the call is ever renamed
    // or reshaped -- a matcher that stops matching must not read as compliance.
    expect(call_argument, 'executor run_query call argument located').to.be.a(
      'string'
    )
    expect(call_argument).to.include('...params')
  })

  it('spreads the client table state before any server-owned key', function () {
    const spread_index = call_argument.indexOf('...params')

    for (const key of SERVER_OWNED_KEYS) {
      const key_index = call_argument.search(new RegExp(`(^|[{\\s,])${key}\\b`))
      expect(key_index, `${key} is present in the call`).to.be.above(-1)
      expect(
        key_index,
        `${key} must be written AFTER ...params, or the client's table state overwrites it`
      ).to.be.above(spread_index)
    }
  })
})
