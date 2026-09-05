import { Record, List, Map, fromJS } from 'immutable'

import {
  transaction_types,
  fantasy_positions,
  AUCTION_BLOCK_GRANULARITY_MINUTES
} from '#constants'
import { auction_actions } from './actions'

const initialState = new Record({
  // Whether this client has sent AUCTION_JOIN. The server tracks a join per
  // SOCKET, so a reconnect leaves the auction with no record of this manager:
  // no message handlers on the new socket, so every bid and nomination they
  // send is dropped without an error, and no AUCTION_INIT, so their board keeps
  // whatever it had when the connection went. This flag is what lets the
  // reconnect saga tell a manager who dropped out of a block from a visitor who
  // never opened the page.
  is_joined: false,
  // Whether AUCTION_INIT has landed, and therefore whether any field below is
  // the server's answer rather than this record's opening guess.
  //
  // `isPaused` CANNOT CARRY THIS, and that is the defect it existed as. It
  // defaults true so the controls stay hidden until the auction is known, which
  // is right -- but "nothing has told us yet" and "the commissioner paused the
  // auction" then render as the same screen, and that screen says `Auction is
  // paused` in the bid bar and the status rail. Every manager sees it for the
  // load, and a client that never gets its AUCTION_INIT -- a swapped socket, a
  // reconnect the server refused, a phone tab the browser discarded and
  // reloaded -- sees it for as long as the tab stays open, on an auction that is
  // running fine for everyone else. It is not a stale reading; it is a default
  // being reported as a fact.
  //
  // Cleared only by AUCTION_INIT, which is the one message that carries the
  // whole board. That message BROADCASTS rather than replies, so a client that
  // missed its own also recovers on the next manager to join.
  is_initialized: false,
  isPaused: true,
  isLocked: false,
  isComplete: false,
  selected_pid: null,
  nominated_pid: null,
  bid: null,
  connected: new List(),
  lineupPlayers: new List(),
  lineupFeasible: true,
  lineupPoints: null,
  lineupBudget: null,
  tids: new List(),
  transactions: new List(),
  positions: new List(fantasy_positions),
  bidTimer: null,
  nominationTimer: null,
  nominating_team_id: null,
  search: null,
  timer: null,
  muted: true,
  pause_on_team_disconnect: true,
  // 'election' or 'live'. Election mode carries no clock at all: a nominated
  // player settles when every eligible team has elected on it.
  auction_mode: 'live',
  // Team ids only, on the active nomination. A standing maximum is a sealed bid
  // -- no other team's amount ever reaches this client, the commissioner's
  // included, since the commissioner is a competing manager here.
  outstanding_election_tids: new List(),
  // Map<pid, Map> of THE VIEWING TEAM'S OWN live elections, and no others.
  // Bounded by the players one manager elected on rather than 395 by ten, and
  // sealed by construction: no other team's amount is ever sent to any client.
  //
  // fromJS maps rather than a Record, matching restricted-free-agency/reducer.js
  // -- app/core/auction/ has no record.js and adding one would pull the slice
  // under app.record-declares-reducer-key.spec.mjs for no gain.
  standing_elections: new Map(),
  // Map<block_at_unix, Map> carrying `opt_in_tids` and `is_finalized`. Opt-ins
  // are PUBLIC by design and named rather than counted: an election is a sealed
  // bid, an opt-in is an availability, and a manager cannot argue for a slot
  // against a bare count.
  live_blocks: new Map(),
  // Team ids holding an open active roster spot -- the unanimity denominator as
  // it stands right now. It shrinks as the auction fills rosters, which is why a
  // convened block records its own.
  block_eligible_tids: new List(),
  // Unix seconds. Recomputed server-side on every read from
  // `period_end - spots_remaining * pace - buffer`, never stored, so the client
  // holds whatever the server last said rather than deriving it.
  final_block_at: null,
  final_block_spots_remaining: null,
  free_agency_period_start: null,
  free_agency_period_end: null,
  auction_block_notice_minutes: null,
  // Set while a live block is running, so the bid bar can say when it ends.
  block_end_at: null,
  is_final_block: false
})

// One shape for the schedule wherever it arrives -- the REST read, the opt-in
// write, and the broadcast that follows one. Three call sites building this by
// hand is how the two dead action types got in.
const merge_block_schedule = (state, payload) => {
  let blocks = new Map()
  for (const slot of payload.opt_ins || []) {
    blocks = blocks.set(
      slot.block_at,
      fromJS({
        block_at: slot.block_at,
        opt_in_tids: slot.opt_in_tids,
        is_finalized: slot.is_finalized
      })
    )
  }

  // A convened SESSION is a merged run of consecutive slots, so it can cover
  // slots nobody's opt-in row still names. Marking each covered slot finalized
  // is what lets the calendar draw the session as one band.
  for (const block of payload.blocks || []) {
    for (
      let at = block.block_at;
      at < block.end_at;
      at += AUCTION_BLOCK_GRANULARITY_MINUTES * 60
    ) {
      const existing =
        blocks.get(at) || fromJS({ block_at: at, opt_in_tids: [] })
      blocks = blocks.set(at, existing.set('is_finalized', true))
    }
  }

  return state.merge({
    live_blocks: blocks,
    block_eligible_tids: new List(payload.eligible_team_ids || []),
    final_block_at: payload.final_block_at,
    final_block_spots_remaining: payload.final_block_spots_remaining,
    free_agency_period_start: payload.period_start,
    free_agency_period_end: payload.period_end,
    auction_block_notice_minutes: payload.auction_block_notice_minutes
  })
}

/**
 * Draw the manager's own opt-in the moment they click it, before the round trip.
 *
 * THE ROUND TRIP IS NOT FAST HERE. The opt-in route re-evaluates finalization
 * for the whole league and rebuilds the entire schedule before it answers, so a
 * click had a visible dead interval in which the button still said `Opt in` and
 * the hour's density mark had not moved -- which reads as a click that did not
 * land, and the manager clicks again. This writes only the viewing team's own
 * tid, which is the one fact the client can predict; the server's reply
 * replaces the whole map with the real schedule, including the unanimity it may
 * have just convened.
 *
 * ROLLBACK IS A REFETCH rather than an inverse, in `sagas.js`. Inverting the
 * click would remove a tid that was already there for any slot the request did
 * not change -- an hour where one quarter was already taken is exactly the case
 * the hour-wide button creates.
 */
const apply_optimistic_opt_in = (state, { teamId, block_ats, is_opted_in }) => {
  if (!teamId || !block_ats || !block_ats.length) return state

  let blocks = state.live_blocks
  for (const block_at of block_ats) {
    const existing = blocks.get(block_at)
    const tids = existing
      ? existing.get('opt_in_tids') || new List()
      : new List()

    if (is_opted_in) {
      if (tids.includes(teamId)) continue
      const base =
        existing || fromJS({ block_at, opt_in_tids: [], is_finalized: false })
      blocks = blocks.set(block_at, base.set('opt_in_tids', tids.push(teamId)))
    } else {
      if (!existing || !tids.includes(teamId)) continue
      blocks = blocks.set(
        block_at,
        existing.set(
          'opt_in_tids',
          tids.filter((tid) => tid !== teamId)
        )
      )
    }
  }

  return state.set('live_blocks', blocks)
}

export function auction_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case auction_actions.AUCTION_SEARCH_PLAYERS:
      return state.merge({
        search: payload.value
      })

    case auction_actions.AUCTION_CONNECTED:
      return state.merge({
        connected: new List(payload.connected)
      })

    // THIS CLIENT ASKED TO JOIN, which is the only thing that entitles it to
    // rejoin on a websocket reconnect. It is not read off AUCTION_INIT:
    // `_send_auction_init` BROADCASTS, so every client in the league receives
    // one whenever anybody joins, and keying on it would have the whole league
    // rejoining an auction most of them never opened.
    case auction_actions.AUCTION_JOIN:
      return state.merge({ is_joined: true })

    case auction_actions.AUCTION_TOGGLE_MUTED:
      return state.merge({ muted: !state.muted })

    case auction_actions.AUCTION_RELEASE_LOCK:
      return state.merge({ isLocked: false })

    case auction_actions.AUCTION_FILTER:
      return state.merge({ [payload.type]: new List(payload.values) })

    // THE SERVER OWNS THE CLOCK, and `AUCTION_TIMER` is the only message that
    // moves it. Rebuilding it here from a duration was wrong in the two places
    // it mattered: a PROXY step broadcasts a bid without resetting the bid
    // clock, so a manager saw a fresh countdown while the sale was seconds away
    // and let a player they wanted go; and a reconnecting client rebuilt nothing
    // at all, because AUCTION_INIT carried durations and no expiry.
    case auction_actions.AUCTION_TIMER:
      return state.merge({ timer: payload.timer_expires_at })

    case auction_actions.AUCTION_START:
      return state.merge({ isPaused: false })

    case auction_actions.AUCTION_SELECT_PLAYER:
      return state.merge({
        selected_pid: payload.pid,
        bid: 0
      })

    case auction_actions.AUCTION_BID:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        transactions: state.transactions.unshift(payload),
        bid: payload.player_salary,
        nominated_pid: payload.pid,
        isLocked: true
      })

    case auction_actions.AUCTION_SUBMIT_BID:
      return state.merge({
        isLocked: true
      })

    // THE TYPE IS STAMPED HERE BECAUSE THE ELECTION-MODE BROADCAST OMITS IT.
    // `broadcast_auction_settlement` sends `{ pid, tid, player_salary }` and no
    // `type`, while the socket's own settle path sends the whole transaction
    // row -- so the two fan-outs put differently shaped records into the same
    // list, and a reader that switches on `type` sees the election-mode sale as
    // neither a bid nor a sale. Stamping is the narrow fix: the payload's own
    // type, where it has one, is already this value.
    case auction_actions.AUCTION_PROCESSED:
      return state.merge({
        selected_pid: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift({
          ...payload,
          type: transaction_types.AUCTION_PROCESSED
        }),
        nominated_pid: null,
        // The outstanding set belongs to the player that just sold. Carrying it
        // into the next nomination would name teams against a player they have
        // not been asked about yet.
        outstanding_election_tids: new List()
      })

    case auction_actions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auction_actions.AUCTION_NOMINATION_INFO: {
      const { nominating_team_id } = payload
      return state.merge({ nominating_team_id })
    }

    case auction_actions.AUCTION_INIT: {
      const latest = payload.transactions[0]
      return state.merge({
        is_initialized: true,
        bid:
          latest && latest.type === transaction_types.AUCTION_BID
            ? latest.player_salary
            : null,
        nominated_pid:
          latest && latest.type === transaction_types.AUCTION_BID
            ? latest.pid
            : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids),
        isPaused: payload.paused,
        bidTimer: payload.bidTimer,
        connected: new List(payload.connected),
        nominationTimer: payload.nominationTimer,
        nominating_team_id: payload.nominating_team_id,
        isComplete: payload.complete,
        pause_on_team_disconnect: payload.pause_on_team_disconnect,
        auction_mode: payload.auction_mode || 'live',
        block_end_at: payload.block_end_at || null,
        is_final_block: Boolean(payload.is_final_block),
        outstanding_election_tids: new List(
          payload.outstanding_election_tids || []
        ),
        timer: payload.timer_expires_at || null
      })
    }

    case auction_actions.AUCTION_CONFIG:
      return state.merge({
        pause_on_team_disconnect: payload.pause_on_team_disconnect
      })

    case auction_actions.AUCTION_COMPLETE:
      return state.merge({ isComplete: true })

    case auction_actions.SET_OPTIMAL_LINEUP:
      return state.merge({
        lineupPlayers: new List(payload.feasible ? payload.pids : []),
        lineupPoints: payload.result,
        lineupFeasible: payload.feasible
      })

    case auction_actions.SET_AUCTION_BUDGET:
      return state.merge({
        lineupBudget: payload.budget
      })

    case auction_actions.GET_AUCTION_ELECTIONS_FULFILLED: {
      let elections = new Map()
      for (const election of payload.data) {
        elections = elections.set(election.pid, fromJS(election))
      }
      return state.merge({ standing_elections: elections })
    }

    case auction_actions.SET_AUCTION_BLOCK_OPT_IN:
      return apply_optimistic_opt_in(state, payload)

    case auction_actions.GET_AUCTION_BLOCKS_FULFILLED:
    case auction_actions.POST_AUCTION_BLOCK_OPT_IN_FULFILLED:
      return merge_block_schedule(state, payload.data)

    case auction_actions.AUCTION_BLOCK_SCHEDULE:
      return merge_block_schedule(state, payload)

    // The mode flips at a wall-clock boundary with no message behind it, so the
    // server announces it. A client deriving it from its own clock would run the
    // bid bar against a block the server has already closed.
    // ENTERING ELECTION MODE CLEARS THE PAUSE HERE TOO, mirroring the server.
    //
    // `_leave_live_mode` clears `_paused` on the server, but the client cannot
    // learn that from this message alone: in election mode nothing broadcasts
    // AUCTION_START, and the only other cases that clear `isPaused` are
    // AUCTION_BID and AUCTION_PROCESSED. So a client that received one
    // AUCTION_PAUSED during a live block kept rendering `Auction is paused` for
    // the whole election window that followed -- with `is_initialized` true, so
    // the load gate does not cover it -- while the server was accepting every
    // election it was refusing to offer a control for.
    case auction_actions.AUCTION_MODE:
      return state.merge({
        auction_mode: payload.auction_mode,
        block_end_at: payload.block_end_at,
        is_final_block: payload.is_final_block,
        isPaused:
          payload.auction_mode === 'election' ? false : state.get('isPaused')
      })

    case auction_actions.AUCTION_SETTLEMENT_STATUS:
      return state.merge({
        outstanding_election_tids: new List(
          payload.outstanding_election_tids || []
        )
      })

    default:
      return state
  }
}
