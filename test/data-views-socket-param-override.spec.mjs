/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const socket_path = path.join(__dirname, '../api/sockets/data_view.mjs')

chai.should()
const expect = chai.expect

// `process_queue` builds the get_data_view_results argument by spreading the
// client's table state (`...params`) into an object literal. Every server-owned
// key in that literal therefore has to sit AFTER the spread, because a later key
// wins -- a key written before it is a default the client can overwrite.
//
// `timeout` was written before the spread and reaches Postgres as SET LOCAL
// statement_timeout verbatim, so an anonymous caller could send
// params.timeout and run for as long as it liked against a 40s policy.
// Confirmed by execution against production on 2026-08-19: params.timeout=1 and
// params.timeout=400 each errored at exactly the injected deadline. Because
// DataViewQueue.processing is one process-wide boolean and remove_request only
// drops entries with no user_id, that also pins the head of the serial queue
// against every other user, and survives the abusing socket closing.
//
// `user_id` was already placed correctly, with a comment explaining why -- the
// reasoning existed and had been applied to one key and not the other.
//
// A behavioral spec is not available: DataViewQueue is not exported and
// get_data_view_results is imported directly, so there is no seam to stub. Per
// league CLAUDE.md, extracting one would destroy the red-at-the-broken-revision
// proof, since the extracted module does not exist at the pre-fix commit. So
// this reads the source, in the manner of
// test/app.api-service-verb-contract.spec.mjs.
//
// It discriminates on POSITION, not presence: the broken form contains the word
// `timeout` in the same call, so any grep for the token passes over the defect.

// Every key the server owns and the client must not be able to name. Add to
// this list when process_queue starts passing another server-decided value.
const SERVER_OWNED_KEYS = ['timeout', 'user_id', 'calculate_total_count']

const read_call_argument = (source) => {
  const call_start = source.indexOf('await get_data_view_results({')
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

describe('data view socket cannot let a client override server policy', function () {
  const source = fs.readFileSync(socket_path, 'utf8')
  const call_argument = read_call_argument(source)

  it('finds the get_data_view_results call it is asserting about', function () {
    // Without this the whole file passes vacuously if the call is ever renamed
    // or reshaped -- a matcher that stops matching must not read as compliance.
    expect(call_argument, 'process_queue call argument located').to.be.a(
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
