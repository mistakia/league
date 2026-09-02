/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import selectPlayer from './utils/select-player.mjs'
import make_recording_timers from './utils/recording-timers.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// The fixture gives user i team i for i in 1..12, and makes user 1 the
// commissioner. Both facts are asserted in `build_live_auction` rather than
// trusted, because every spec here turns on WHICH TEAM an authenticated user
// owns -- a fixture that renamed the mapping would leave these specs green
// while asserting nothing about resolution.
const COMMISSIONER_USER_ID = 1

// EVERY SPEC IN THIS FILE GOES THROUGH `_setup_message_handlers`, NOT THROUGH
// `bid` AND `nominate`.
//
// The acting team is bound to the socket at join time, and the switch in
// `_setup_message_handlers` is the line that hands it to each verb. A spec that
// calls `auction.bid(message, { user_id, tid })` supplies that binding itself,
// so it can only ever observe what it already passed in -- which is why the
// rest of the auction suite, all of which calls the methods directly, says
// nothing about where the acting team comes from. The dispatch is the subject.
const make_socket = () => {
  const handlers = {}
  return {
    on(event, fn) {
      handlers[event] = handlers[event] || []
      handlers[event].push(fn)
    },
    // The handler registered by `_setup_message_handlers` is synchronous and
    // returns the verb's promise, so awaiting it awaits the write.
    async dispatch(message) {
      const listeners = handlers.message || []
      expect(
        listeners.length,
        'the join registered a message handler; without one every dispatch ' +
          'below is a no-op and every "nothing was written" assertion passes ' +
          'for the wrong reason'
      ).to.be.above(0)
      for (const fn of listeners) {
        await fn(JSON.stringify(message))
      }
    }
  }
}

const make_recording_wss = (user_ids) => {
  const errors = []
  const clients = new Set(
    user_ids.map((user_id) => ({
      user_id,
      league_id,
      // `ws`'s WebSocket.OPEN, hardcoded so the stub does not depend on the
      // transport it stands in for.
      readyState: 1,
      send: (payload) => {
        const event = JSON.parse(payload)
        if (event.type === 'AUCTION_ERROR') {
          errors.push({ user_id, error: event.payload.error })
        }
      }
    }))
  )
  return { wss: { clients }, errors }
}

const count_auction_transactions = async () => {
  const rows = await knex('transactions')
    .where({ lid: league_id, season_year })
    .whereIn('type', [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ])
  return rows.length
}

const latest_bid_for = async (pid) => {
  const [row] = await knex('transactions')
    .where({
      lid: league_id,
      season_year,
      pid,
      type: transaction_types.AUCTION_BID
    })
    .orderBy('transaction_id', 'desc')
    .limit(1)
  return row
}

const build_live_auction = async ({ user_ids }) => {
  const { wss, errors } = make_recording_wss(user_ids)
  const auction = new Auction({
    wss,
    lid: league_id,
    timers: make_recording_timers()
  })
  await auction.setup()

  // LIVE mode explicitly. The fixture's mode is derived from the free agency
  // period rather than stated, and both the $0 clamp and the cached-capacity
  // refresh are gated on it.
  auction._election_mode = false
  auction.start()
  expect(auction._paused, 'the auction is running').to.equal(false)

  expect(
    auction._league.commissioner_user_id,
    'the fixture commissioner is user 1; if it moves, the commissioner specs ' +
      'below stop testing the bypass and the manager specs stop testing the ' +
      'ordinary path'
  ).to.equal(COMMISSIONER_USER_ID)

  return { auction, errors }
}

// The ownership mapping the resolution under test has to reproduce, read from
// the database rather than assumed from the loop that seeds it.
const owned_team_id = async (user_id) => {
  const [row] = await knex('users_teams').where({ user_id, season_year })
  expect(row, `user ${user_id} owns a team in the fixture`).to.exist
  return row.tid
}

// A joined socket. `tid` IS PASSED DELIBERATELY and is expected to be ignored:
// `api/sockets/index.mjs` reads whatever the client puts in the AUCTION_JOIN
// payload, so anything `join` accepts there is client input. Passing a wrong
// one here is what proves the resolution does not consult it.
const join_as = async ({ auction, user_id, tid, client_id }) => {
  const ws = make_socket()
  await auction.join({
    ws,
    tid,
    user_id,
    onclose: () => {},
    client_id: client_id || `client-${user_id}`
  })
  return ws
}

const open_a_nomination = async ({ auction }) => {
  const player = await selectPlayer({
    pos: 'RB',
    random: false,
    exclude_rostered_players: true
  })
  const nominating_team_id = auction.nominating_team_id
  await auction.nominate(
    { pid: player.pid, value: 0 },
    { user_id: await owner_of(nominating_team_id), tid: nominating_team_id }
  )
  const current = auction._transactions[0]
  expect(current, 'a nomination is open').to.exist
  expect(current.type).to.equal(transaction_types.AUCTION_BID)
  expect(current.pid).to.equal(player.pid)
  return player
}

const owner_of = async (tid) => {
  const [row] = await knex('users_teams').where({ tid, season_year })
  expect(row, `team ${tid} has an owner in the fixture`).to.exist
  return row.user_id
}

describe('auction socket team resolution', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  describe('bidding', function () {
    it('records a bid for the team the authenticated user owns', async function () {
      // THE CONTROL, and it comes first because every refusal below is
      // worthless without it. A manager bidding on their own behalf through
      // the dispatch is accepted and recorded to their own team, so the
      // assertions that follow are about WHOSE team the bid lands on rather
      // than about a handler that has stopped accepting bids.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const player = await open_a_nomination({ auction })

      const bidder_user_id = 3
      const bidder_team_id = await owned_team_id(bidder_user_id)
      const ws = await join_as({
        auction,
        user_id: bidder_user_id,
        tid: bidder_team_id
      })

      const before = await count_auction_transactions()
      await ws.dispatch({
        type: 'AUCTION_BID',
        payload: { pid: player.pid, value: 7 }
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'a manager may bid for their own team').to.deep.equal([])

      const bid = await latest_bid_for(player.pid)
      expect(bid.tid, 'recorded for the bidder').to.equal(bidder_team_id)
      expect(bid.user_id, 'attributed to the bidder').to.equal(bidder_user_id)
    })

    it('records a bid for the joining user regardless of the tid in the payload', async function () {
      // THE PAYLOAD NAMES A TEAM THE BIDDER DOES NOT OWN, and the recorded bid
      // must still be theirs. Asserting `tid` on the ROW rather than merely
      // that a bid was accepted is what makes this fail on the shipped-through
      // behavior: a handler that passes the payload tid down writes the bid to
      // team 2 and the count assertion cannot tell the difference.
      //
      // `user_id` is forged alongside it, because `_create_bid_record` writes
      // both fields off the same object and a fix that resolved only the team
      // would still misattribute the transaction.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const player = await open_a_nomination({ auction })

      const bidder_user_id = 3
      const bidder_team_id = await owned_team_id(bidder_user_id)
      const other_user_id = 2
      const other_team_id = await owned_team_id(other_user_id)
      expect(
        other_team_id,
        'the payload names a team the bidder does not own'
      ).to.not.equal(bidder_team_id)

      const ws = await join_as({
        auction,
        user_id: bidder_user_id,
        tid: bidder_team_id
      })

      const before = await count_auction_transactions()
      await ws.dispatch({
        type: 'AUCTION_BID',
        payload: {
          user_id: other_user_id,
          tid: other_team_id,
          pid: player.pid,
          value: 7
        }
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors).to.deep.equal([])

      const bid = await latest_bid_for(player.pid)
      expect(
        bid.tid,
        'the acting team comes from the session, not from the payload'
      ).to.equal(bidder_team_id)
      expect(bid.tid, 'the named team was not charged').to.not.equal(
        other_team_id
      )
      expect(
        bid.user_id,
        'the transaction is attributed to the authenticated user'
      ).to.equal(bidder_user_id)
    })

    it('resolves the acting team from the session rather than the joined tid', async function () {
      // The AUCTION_JOIN payload is client input too -- `index.mjs` destructures
      // `tid` straight out of it -- so a join naming someone else's team must
      // not bind that team to the socket. Every subsequent bid on this
      // connection is the observable consequence, which is why this asserts on
      // a bid rather than on internal join state.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const player = await open_a_nomination({ auction })

      const bidder_user_id = 3
      const bidder_team_id = await owned_team_id(bidder_user_id)
      const other_team_id = await owned_team_id(2)

      const ws = await join_as({
        auction,
        user_id: bidder_user_id,
        // The forged join.
        tid: other_team_id
      })

      await ws.dispatch({
        type: 'AUCTION_BID',
        payload: { pid: player.pid, value: 7 }
      })

      expect(errors).to.deep.equal([])
      const bid = await latest_bid_for(player.pid)
      expect(bid.tid, 'the joined tid did not become the acting team').to.equal(
        bidder_team_id
      )
      expect(
        auction._connected[other_team_id],
        'nor did it mark the named team connected, which is what ' +
          'pause_on_team_disconnect reads'
      ).to.equal(undefined)
    })
  })

  describe('nominating', function () {
    // The commissioner bypass in `_validate_nomination` returns true before the
    // turn check whenever the nomination timer has expired, and user 1 is the
    // fixture commissioner. A nomination spec that did not pin this could pass
    // with no guard consulted at all.
    const expect_guards_are_reachable = (auction, user_id) => {
      expect(
        auction._nomination_timer_expired,
        'the commissioner bypass is inactive, so this exercises the turn ' +
          'check rather than skipping it'
      ).to.equal(false)
      expect(
        auction._election_mode,
        'the election-mode commissioner bypass is inactive too'
      ).to.equal(false)
      expect(
        user_id,
        'and this nomination is driven as a non-commissioner'
      ).to.not.equal(auction._league.commissioner_user_id)
    }

    it('accepts a nomination from the team on the clock', async function () {
      // The control for the refusal below. The rotation head is `_tids[0]`
      // while the transaction log is empty, and its owner nominates through the
      // dispatch with no tid in the payload at all.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const on_the_clock = auction.nominating_team_id
      const owner_user_id = await owner_of(on_the_clock)

      const ws = await join_as({
        auction,
        user_id: owner_user_id,
        tid: on_the_clock
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await ws.dispatch({
        type: 'AUCTION_SUBMIT_NOMINATION',
        payload: { pid: target.pid, value: 0 }
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(errors, 'the team on the clock may nominate').to.deep.equal([])

      const nomination = await latest_bid_for(target.pid)
      expect(nomination.tid, 'opened for the team on the clock').to.equal(
        on_the_clock
      )
    })

    it('refuses a nomination whose payload names the team on the clock', async function () {
      // The turn check compares the ACTING team against the rotation. Sourced
      // from the payload it compares client input against server state, which
      // any client satisfies by sending the value the board already shows --
      // so this spec's payload sends exactly that, and the refusal has to come
      // from the session instead.
      this.timeout(60 * 1000)
      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const on_the_clock = auction.nominating_team_id

      const nominator_user_id = 2
      const nominator_team_id = await owned_team_id(nominator_user_id)
      expect(
        nominator_team_id,
        'the nominator is not the team on the clock'
      ).to.not.equal(on_the_clock)
      expect_guards_are_reachable(auction, nominator_user_id)

      const ws = await join_as({
        auction,
        user_id: nominator_user_id,
        tid: nominator_team_id
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await ws.dispatch({
        type: 'AUCTION_SUBMIT_NOMINATION',
        payload: {
          user_id: await owner_of(on_the_clock),
          tid: on_the_clock,
          pid: target.pid,
          value: 0
        }
      })

      expect(
        await count_auction_transactions(),
        'no nomination was forced for the team on the clock'
      ).to.equal(before)
      // The refusal reaches the manager who actually sent it, not the account
      // named in the payload -- `_validate_nomination` used to address its
      // replies to the message field.
      expect(errors).to.deep.equal([
        { user_id: nominator_user_id, error: 'invalid nomination' }
      ])
    })

    it('lets the commissioner nominate for the team on the clock', async function () {
      // THE COMMISSIONER ACTS FOR OTHER TEAMS BY DESIGN AND THAT MUST SURVIVE.
      // It is the first thing done in a real auction when a manager's clock
      // runs out, so a fix that resolved the acting team and stopped there
      // would break the auction on its first stall.
      //
      // The commissioner needs no borrowed tid to do it: the bypass keys on the
      // authenticated user id, and `_create_nomination_bid` writes
      // `tid: nominating_team_id`. Team 2 is put on the clock by draft order so
      // that the commissioner's own team is demonstrably NOT the one being
      // nominated for -- with team 1 on the clock this spec would pass whether
      // the bypass worked or not.
      this.timeout(60 * 1000)
      await knex('teams')
        .where({ team_id: 2, season_year })
        .update({ draft_order: 0 })

      const { auction, errors } = await build_live_auction({
        user_ids: [1, 2, 3]
      })
      const on_the_clock = auction.nominating_team_id
      expect(on_the_clock, 'team 2 holds the clock').to.equal(2)
      expect(
        await owned_team_id(COMMISSIONER_USER_ID),
        'and the commissioner owns a different team'
      ).to.not.equal(on_the_clock)

      auction._nomination_timer_expired = true

      const ws = await join_as({
        auction,
        user_id: COMMISSIONER_USER_ID,
        tid: await owned_team_id(COMMISSIONER_USER_ID)
      })

      const target = await selectPlayer({
        pos: 'RB',
        random: false,
        exclude_rostered_players: true
      })

      const before = await count_auction_transactions()
      await ws.dispatch({
        type: 'AUCTION_SUBMIT_NOMINATION',
        payload: { pid: target.pid, value: 0 }
      })

      expect(await count_auction_transactions()).to.equal(before + 1)
      expect(
        errors,
        'the commissioner bypass survives session-resolved teams'
      ).to.deep.equal([])

      const nomination = await latest_bid_for(target.pid)
      expect(
        nomination.tid,
        'opened for the team on the clock, not the commissioner'
      ).to.equal(on_the_clock)
    })
  })
})
