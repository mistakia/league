/* global describe, it */

import * as chai from 'chai'

import {
  apply_envelope_redaction,
  read_generation_timeline,
  DEFAULT_TAKE_LAST,
  MAX_PAGE_SIZE
} from '#libs-server/data-views/generation/generation-timeline-backfill.mjs'

process.env.NODE_ENV = 'test'
// A base URL so the reader can build a URL, and an injected token so no test
// reaches for the generation identity's private key on disk.
process.env.BASE_API_URL = 'https://base.invalid'
const read_token = async () => 'test-token'

const expect = chai.expect

// The timeline backfill reader.
//
// THE HAZARD THIS FILE EXISTS FOR IS MASKING, NOT ERRORING. base's REST read
// answers a denied caller with a 200 whose structure, types, ordering, entry
// count and even content LENGTHS match the authorized response exactly --
// measured 2026-09-04 against a real generation thread, where the two responses
// differed in nothing but the characters themselves. So every assertion here is
// on CONTENT or on a flag, never on shape.

const json_response = (body, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body)
})

describe('data view generation timeline backfill', function () {
  describe('the envelope redaction mapping', function () {
    // base's is_redacted is an ENVELOPE-level marker: it lives on the top-level
    // thread object and is deliberately NOT set on nested sub-objects. The
    // shared timeline component renders an entry as masked only when the ENTRY
    // carries the flag, so without this mapping that branch is unreachable and a
    // permission failure paints block characters as though they were content.
    it('stamps the envelope flag onto EVERY entry when redacted', function () {
      const entries = apply_envelope_redaction(
        [
          { id: 'a', content: '████' },
          { id: 'b', content: '██' }
        ],
        true
      )
      expect(entries.map((entry) => entry.is_redacted)).to.deep.equal([
        true,
        true
      ])
    })

    // The control. Without it, a mapping that flagged unconditionally would
    // pass the test above and mark every honest run as masked.
    it('leaves entries untouched when NOT redacted', function () {
      const original = [{ id: 'a', content: 'searched columns' }]
      const entries = apply_envelope_redaction(original, false)
      expect(entries[0].is_redacted).to.equal(undefined)
      expect(entries[0].content).to.equal('searched columns')
    })
  })

  describe('the request', function () {
    it('takes a TAIL with take_last and never sends timeline_limit', async function () {
      // The defect this pins, measured against real base 2026-09-04: base
      // sorts slice parameters into three mutually exclusive groups and
      // refuses any request touching two with a 500. `timeline_limit` is
      // pagination and `take_last` is position-based, so sending both -- which
      // this reader did -- broke EVERY attach.
      //
      // The earlier version of this test asserted a non-zero `timeline_limit`,
      // which is why the breakage shipped: it pinned league's own request
      // against league's own fetch stub and never asked base whether the pair
      // was legal.
      //
      // `take_last` is also the only parameter that answers an attach's
      // question. `timeline_limit` alone returns the HEAD, so the collapsed
      // row would show a run's FIRST event labelled as its latest.
      let requested_url = null
      await read_generation_timeline({
        thread_id: 't1',
        read_token,
        fetch_impl: async (url) => {
          requested_url = url
          return json_response({ timeline: [] })
        }
      })

      const params = new URL(requested_url).searchParams
      expect(params.get('take_last')).to.equal(String(DEFAULT_TAKE_LAST))
      expect(params.get('timeline_limit')).to.equal(null)
    })

    it('pages BACKWARD with before_index instead of taking a tail', async function () {
      let requested_url = null
      await read_generation_timeline({
        thread_id: 't1',
        before_index: 40,
        read_token,
        fetch_impl: async (url) => {
          requested_url = url
          return json_response({ timeline: [] })
        }
      })

      const params = new URL(requested_url).searchParams
      expect(params.get('before_index')).to.equal('40')
      // before_index is a QUALIFIER on position-based slicing, not a slicing
      // method of its own, so it must arrive WITH take_last and never with
      // timeline_limit -- base rejects the latter pair on its own branch.
      // Verified against real base: `before_index=30&take_last=10` returns 200.
      expect(params.get('take_last')).to.equal(String(DEFAULT_TAKE_LAST))
      expect(params.get('timeline_limit')).to.equal(null)
    })

    it('caps a page at MAX_PAGE_SIZE rather than asking for everything', async function () {
      let requested_url = null
      await read_generation_timeline({
        thread_id: 't1',
        take_last: 100000,
        read_token,
        fetch_impl: async (url) => {
          requested_url = url
          return json_response({ timeline: [] })
        }
      })

      const params = new URL(requested_url).searchParams
      expect(params.get('take_last')).to.equal(String(MAX_PAGE_SIZE))
      expect(params.get('timeline_limit')).to.equal(null)
    })
  })

  describe('the response', function () {
    it('returns entry CONTENT, not merely a well-shaped envelope', async function () {
      const { entries, is_redacted } = await read_generation_timeline({
        thread_id: 't1',
        read_token,
        fetch_impl: async () =>
          json_response({
            timeline: [
              {
                id: 'e1',
                type: 'tool_call',
                content: 'search_columns for passing yards',
                ordering: { timeline_index: 0 }
              }
            ],
            timeline_window: { epoch: 3 }
          })
      })

      expect(entries[0].content).to.equal('search_columns for passing yards')
      expect(is_redacted).to.equal(false)
      expect(entries[0].is_redacted).to.equal(undefined)
    })

    it('propagates a MASKED read as redacted on the envelope AND the entries', async function () {
      const { entries, is_redacted } = await read_generation_timeline({
        thread_id: 't1',
        read_token,
        fetch_impl: async () =>
          json_response({
            is_redacted: true,
            timeline: [
              {
                id: 'e1',
                type: 'tool_call',
                content: '███████',
                ordering: { timeline_index: 0 }
              }
            ]
          })
      })

      expect(is_redacted).to.equal(true)
      expect(entries[0].is_redacted).to.equal(true)
    })

    it('answers an unknown thread with an empty read rather than throwing', async function () {
      // A 404 is ordinary: a job can carry a thread_id base has already reaped.
      const { entries, is_redacted } = await read_generation_timeline({
        thread_id: 'gone',
        read_token,
        fetch_impl: async () => json_response({}, { status: 404 })
      })
      expect(entries).to.deep.equal([])
      expect(is_redacted).to.equal(false)
    })

    it('throws by NAME on a refusal that is not a 404', async function () {
      let error = null
      try {
        await read_generation_timeline({
          thread_id: 't1',
          read_token,
          fetch_impl: async () => json_response({}, { status: 500 })
        })
      } catch (caught) {
        error = caught
      }
      expect(error, 'a 500 was swallowed').to.not.equal(null)
      expect(error.code).to.equal('base_timeline_unreadable')
    })
  })
})
