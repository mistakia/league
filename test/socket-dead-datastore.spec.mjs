/* global describe it */
import EventEmitter from 'events'
import * as chai from 'chai'

import { on_socket_message } from '../api/sockets/utils.mjs'
import { is_datastore_unreachable } from '#libs-server/install-process-handlers.mjs'

const expect = chai.expect

// The defect these cover, measured during the 2026-09-04 hosting cutover: with
// Postgres unreachable, the API died 446 times in a PM2 restart loop and the
// edge served 521 for every route, including the ones that never touch a
// database.
//
// The mechanism was NOT a missing pool `error` listener -- a knex pool emits no
// such event, so registering one is a control that cannot fire. It was that a
// WebSocket message listener's return value is discarded by the EventEmitter:
// a rejection inside it reaches the process as an unhandled rejection, and
// `install_process_handlers` exits on those.
//
// Note the failure mode being asserted. A DEAD PORT and a WRONG PASSWORD are
// different errors and only the first is this bug, so the classifier tests
// below pin the discrimination rather than merely showing one case passing.

const make_socket = () => {
  const ws = new EventEmitter()
  ws.client_id = 'test-client'
  return ws
}

// Captures whether an unhandled rejection fires while `run` settles. Mocha's
// own listener would otherwise fail the run, which is the state under test.
const observe_unhandled_rejections = async (run) => {
  const existing = process.listeners('unhandledRejection')
  const seen = []
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason) => seen.push(reason))
  try {
    await run()
    // An unhandled rejection is reported at the end of a turn of the event
    // loop, so a same-tick assertion would read empty whether or not the bug is
    // present -- the exact shape of a vacuous check.
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    process.removeAllListeners('unhandledRejection')
    for (const listener of existing) process.on('unhandledRejection', listener)
  }
  return seen
}

describe('a dead datastore degrades instead of killing the process', function () {
  describe('on_socket_message', function () {
    it('contains a rejection from an async handler', async () => {
      const ws = make_socket()
      const error = new Error('connect ECONNREFUSED')
      error.code = 'ECONNREFUSED'
      error.syscall = 'connect'

      on_socket_message(ws, async () => {
        throw error
      })

      const seen = await observe_unhandled_rejections(async () => {
        ws.emit('message', '{}')
      })

      expect(seen).to.deep.equal([])
    })

    it('contains a rejection from a SYNC handler that returns a promise', async () => {
      // The auction handler's shape. It carries no `async` keyword, so a grep
      // for async listeners does not find it, and it was the busiest failing
      // path during a live auction.
      const ws = make_socket()

      on_socket_message(ws, () => Promise.reject(new Error('bid failed')))

      const seen = await observe_unhandled_rejections(async () => {
        ws.emit('message', '{}')
      })

      expect(seen).to.deep.equal([])
    })

    it('contains a synchronous throw', async () => {
      const ws = make_socket()

      on_socket_message(ws, () => {
        throw new Error('parse exploded')
      })

      expect(() => ws.emit('message', '{}')).to.not.throw()
    })

    it('returns the handler promise so a caller can await completion', async () => {
      // The socket test fixtures drive the entry point directly and `await` the
      // listener to sequence an AUCTION_JOIN before asserting on it. A wrapper
      // that returned nothing left those assertions racing a join that had not
      // finished -- silent de-sequencing, which reads as an unrelated auction
      // regression rather than as a change to this function.
      const ws = make_socket()
      let finished = false

      on_socket_message(ws, async () => {
        await new Promise((resolve) => setImmediate(resolve))
        finished = true
      })

      const listener = ws.listeners('message')[0]
      await listener('{}')

      expect(finished).to.equal(true)
    })

    it('still delivers the frame to the handler', async () => {
      // Negative control for the three above: a wrapper that never invoked the
      // handler would pass every one of them.
      const ws = make_socket()
      const received = []

      on_socket_message(ws, (msg) => {
        received.push(msg)
      })

      ws.emit('message', 'frame-one')

      expect(received).to.deep.equal(['frame-one'])
    })
  })

  describe('is_datastore_unreachable', function () {
    it('classifies a refused connection as survivable', () => {
      const error = new Error('connect ECONNREFUSED')
      error.code = 'ECONNREFUSED'
      error.syscall = 'connect'
      expect(is_datastore_unreachable(error)).to.equal(true)
    })

    it('does NOT classify a Postgres query error as survivable', () => {
      // The discriminating case. A relation-does-not-exist error carries a code
      // but no syscall, and must still exit -- otherwise the exemption
      // swallows ordinary bugs and leaves a process alive in an undefined
      // state, which is what the exit-by-default rule exists to prevent.
      const error = new Error('relation does not exist')
      error.code = '42P01'
      expect(is_datastore_unreachable(error)).to.equal(false)
    })

    it('does NOT classify an authentication failure as survivable', () => {
      // A wrong password is a deployment mistake, and it should be loud and
      // immediate. Unreachability is not misconfiguration.
      const error = new Error('password authentication failed')
      error.code = '28P01'
      expect(is_datastore_unreachable(error)).to.equal(false)
    })

    it('does NOT classify an ordinary error as survivable', () => {
      expect(
        is_datastore_unreachable(new TypeError('undefined is not a fn'))
      ).to.equal(false)
      expect(is_datastore_unreachable(null)).to.equal(false)
    })
  })
})
