/* global describe it beforeEach */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import { enqueue, flush, clear, pending } from '@core/ws/send-queue'

const expect = chai.expect
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// A STALE BID MUST NOT REPLAY ONTO A NEW SOCKET.
//
// `send` buffered every message it could not write immediately into one
// module-level array that neither `closeWS` nor `openWS` emptied, so anything
// written against a socket that never opened was flushed by the NEXT socket's
// `onopen`. For AUCTION_JOIN that is harmless and is in fact what the buffer is
// for. For AUCTION_BID it places a bid the manager chose against a board that
// has since moved, at a price they did not pick, against a real cap.
//
// The fix is a distinction between message KINDS rather than a timeout:
// registrations may wait for a socket, commands may not, and nothing waits
// across a socket boundary. Age cannot express it -- the board moves per bid,
// not per second.
describe('websocket send queue', function () {
  beforeEach(function () {
    clear()
  })

  describe('the buffer', function () {
    it('holds what was enqueued', function () {
      enqueue({ type: 'AUCTION_JOIN' })

      expect(pending().map((m) => m.type)).to.deep.equal(['AUCTION_JOIN'])
    })

    it('is emptied by the flush that sends it', function () {
      // THE DEFECT, stated as an assertion. The old flush sent the array and
      // then reassigned it, which is correct on its own -- what was missing is
      // every OTHER path that ends a socket's life, below.
      const sent = []
      enqueue({ type: 'AUCTION_JOIN' })
      flush({ send: (payload) => sent.push(payload) })

      expect(sent).to.deep.equal(['{"type":"AUCTION_JOIN"}'])
      expect(pending()).to.deep.equal([])
    })

    it('does not deliver twice when a second socket flushes', function () {
      // The replay itself. Two sockets, one enqueue: the second must send
      // nothing. With the buffer left populated this is where a queued bid
      // reached the wire a second time.
      const first = []
      const second = []
      enqueue({ type: 'AUCTION_BID' })
      flush({ send: (payload) => first.push(payload) })
      flush({ send: (payload) => second.push(payload) })

      expect(first).to.have.lengthOf(1)
      expect(second).to.deep.equal([])
    })

    it('is emptied by clear, which is what a socket swap calls', function () {
      enqueue({ type: 'AUCTION_JOIN' })
      clear()

      expect(pending()).to.deep.equal([])
    })

    it('hands back a copy, so a caller cannot mutate it', function () {
      enqueue({ type: 'AUCTION_JOIN' })
      pending().push({ type: 'AUCTION_BID' })

      expect(pending()).to.have.lengthOf(1)
    })

    it('keeps only the latest message under a replace_key', function () {
      // The data-view results request is the one queued message a user can
      // write repeatedly inside the connect window -- every column add is
      // another one. Flushing all of them runs every intermediate query and
      // renders whichever ANSWER lands last, which need not be the state on
      // screen.
      enqueue({ type: 'DATA_VIEW_REQUEST', params: 1 }, { replace_key: 'dv' })
      enqueue({ type: 'DATA_VIEW_REQUEST', params: 2 }, { replace_key: 'dv' })

      expect(pending()).to.deep.equal([
        { type: 'DATA_VIEW_REQUEST', params: 2 }
      ])
    })

    it('does not let a replace_key displace another caller', function () {
      enqueue({ type: 'AUCTION_JOIN' })
      enqueue({ type: 'DATA_VIEW_REQUEST' }, { replace_key: 'dv' })

      expect(pending().map((m) => m.type)).to.deep.equal([
        'AUCTION_JOIN',
        'DATA_VIEW_REQUEST'
      ])
    })
  })

  // Source gates. `@core/ws/service` imports `@core/store`, which reads
  // `window.__INITIAL_STATE__` at module scope, and there is no jsdom here --
  // so neither `send` nor any saga that calls it can be driven from a spec. The
  // policy is which CALL SITES opt in, and these hold that line by reading it.
  describe('what may wait for a socket', function () {
    const read = (relative) =>
      fs.readFileSync(path.join(repo_root, relative), 'utf8')

    const auction_sagas = 'app/core/auction/sagas.js'

    // Bounded FORWARD from the declaration, never sliced to a token that also
    // appears earlier in the file: slicing backwards yields an empty string and
    // every negative below then passes against nothing.
    const saga_body = (source, name) => {
      const start = source.indexOf(`export function* ${name}(`)
      expect(start, `${name} is still declared by this name`).to.be.above(-1)
      const end = source.indexOf('\nexport ', start + 1)
      expect(end, `${name} is still followed by another export`).to.be.above(
        start
      )
      return source.slice(start, end)
    }

    it('is opted into in exactly three places in the tree', function () {
      // Enumerated from the code that defines the class, not from the names
      // this session happened to look at. A further call site opting in -- for
      // a bid, a nomination, a commissioner control -- fails here whatever it
      // is called.
      //
      // The data-view results request is the third member and the only one that
      // is not a registration. It qualifies on the same terms: a read, carrying
      // no board state, correct against whatever socket opens. It is here
      // because the data-views page issues its first query from a mount effect,
      // which routinely beats the socket open on a cold load -- and a dropped
      // frame there hangs the page at `pending` with nothing to end it.
      const files = []
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.js')) files.push(full)
        }
      }
      walk(path.join(repo_root, 'app'))

      const opted_in = files
        .filter((file) =>
          fs.readFileSync(file, 'utf8').includes('queue_until_open: true')
        )
        .map((file) => path.relative(repo_root, file))
        .sort()

      expect(opted_in).to.deep.equal([
        auction_sagas,
        'app/core/data-views/sagas.js',
        'app/core/scoreboard/sagas.js'
      ])
    })

    it('does not include the bid', function () {
      const body = saga_body(read(auction_sagas), 'submit_bid')

      // The positive first, so the negative cannot pass against a slice that
      // does not contain the call at all.
      expect(body).to.include('AUCTION_BID')
      expect(body).to.include('send(message)')
      expect(body).to.not.include('queue_until_open')
    })

    it('does not include the nomination', function () {
      const body = saga_body(read(auction_sagas), 'submit_nomination')

      expect(body).to.include('AUCTION_SUBMIT_NOMINATION')
      expect(body).to.include('send(message)')
      expect(body).to.not.include('queue_until_open')
    })

    it('does include the join, which is a registration', function () {
      // THE CONTROL. Dropping every unsendable message would satisfy the three
      // negatives above and silently break the first load it was written for --
      // the mount effect's join goes out while the socket is still CONNECTING,
      // and on a first load there is no close, so no WEBSOCKET_RECONNECTED and
      // no `rejoin_auction` to re-drive it.
      const body = saga_body(read(auction_sagas), 'join_auction')

      expect(body).to.include('queue_until_open: true')
    })
  })

  describe('the socket boundary', function () {
    const service = () =>
      fs.readFileSync(path.join(repo_root, 'app/core/ws/service.js'), 'utf8')

    const fn_body = (source, name) => {
      const start = source.indexOf(`export const ${name} = `)
      expect(start, `${name} is still declared by this name`).to.be.above(-1)
      const end = source.indexOf('\nexport ', start + 1)
      expect(end, `${name} is still followed by another export`).to.be.above(
        start
      )
      return source.slice(start, end)
    }

    it('clears when a socket is replaced', function () {
      const body = fn_body(service(), 'openWS')

      expect(body).to.include('discard_socket(ws)')
      expect(body).to.include('clear()')
    })

    it('clears when the socket is closed', function () {
      // The logout and sign-in swap path. Without this a join for the previous
      // league or the previous session's board state waits for whatever socket
      // opens next.
      const body = fn_body(service(), 'closeWS')

      expect(body).to.include('discard_socket(ws)')
      expect(body).to.include('clear()')
    })
  })
})
