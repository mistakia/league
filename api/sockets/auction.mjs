import WebSocket from 'ws'
import config from '#config'
import db from '#db'
import { Roster } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import { getRoster, getLeague, sendNotifications } from '#libs-server'
import { on_socket_message } from './utils.mjs'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { format_nomination_message } from '#libs-server/format-auction-discord-message.mjs'
import {
  settle_auction_player_if_complete,
  lock_auction_for_league,
  get_active_auction_nomination,
  get_auction_team_capacities,
  get_outstanding_election_team_ids,
  broadcast_auction_settlement,
  build_auction_claims
} from '#libs-server/auction-settlement.mjs'
import { upsert_auction_election } from '#libs-server/auction-elections.mjs'
import { resolve_nominating_team_id } from '#libs-server/auction-completion.mjs'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'
import { get_auction_mode, AUCTION_MODES } from '#libs-server/auction-modes.mjs'
import { get_auction_nomination_order } from '#libs-server/auction-nomination-order.mjs'
import debug from 'debug'

// How often the socket asks whether a block has opened or closed.
//
// A block boundary is a wall-clock event with no write behind it -- nobody
// sends a message when 15:00 arrives -- so the only way the auction learns it
// is now live is to look. Fifteen seconds against a 15-minute granularity means
// a block is never more than a rounding error late, and the query is a read of
// a handful of finalized rows.
const AUCTION_MODE_POLL_MS = 15_000

// The real timers, and the default injection.
//
// Nothing in this repository fakes timers -- there is no sinon and no
// useFakeTimers in any spec -- and MockDate moves Date.now without moving
// setTimeout. So while these were called directly, NO bid-clock or
// nomination-clock behavior was testable at all, which is exactly why slow
// mode's timer suspension shipped unexercised. Taking them as an injected
// interface is what makes the clock addressable from a spec.
//
// Every call site also NAMES its clock, and production ignores the name. A spec
// cannot tell the three apart by DURATION: `config-test.json` puts bidTimer at
// 14,000, the socket pads it by 1,000, and AUCTION_MODE_POLL_MS is 15,000 -- so
// counting 15,000ms timers counts bid clocks and mode polls together, and the
// mode poll re-arms itself on every tick. "A proxy step does not reset the bid
// clock" is asserted as a COUNT, and it is the property that keeps a full final
// block tractable, so it has to be countable unambiguously.
export const AUCTION_TIMERS = {
  BID: 'bid',
  NOMINATION: 'nomination',
  MODE_POLL: 'mode_poll'
}

export const real_auction_timers = {
  set_timeout: (fn, ms) => setTimeout(fn, ms),
  clear_timeout: (handle) => clearTimeout(handle)
}

// THE SEAM FOR THE CLAIM ANNOUNCEMENT, and it exists for the same reason the
// timers one does: without it there is no way to assert that this socket SENDS.
//
// `sendNotifications` refuses outside `NODE_ENV=production`, so under the suite
// it silently does nothing -- and flipping the suite to production would
// disable the response validator in `api/swagger/response-validation.mjs`,
// which is a guard that has caught real defects. That leaves the delivery half
// of every auction announcement untestable, and this subsystem has now shipped
// a MISSING announcement twice: no Discord message on any election-mode
// settlement, and a convening block that announced nothing at all. Both times
// the builder was correct and nothing called it, which is precisely the half a
// content assertion cannot see.
//
// Injected the same way `timers` is, defaulting to the real sender, so
// production is unchanged and a spec can ask "were you called, and with what".
export const real_auction_announcer = async ({ league, message }) =>
  sendNotifications({ league, message, notifyLeague: true })

export default class Auction {
  constructor({
    wss,
    lid,
    timers = real_auction_timers,
    announce = real_auction_announcer
  }) {
    this._wss = wss
    this._lid = lid
    this._league = null
    this._paused = true
    this._league_paused = false
    this._pause_on_team_disconnect = false
    this._locked = false
    this._nomination_timer_expired = false
    this._tids = []
    this._teams = []
    this._transactions = []
    this._connected = {}
    this._connected_client_ids = {}
    // Election mode carries NO clock of any kind: a nominated player settles
    // when every eligible team has elected on it, however long that takes. Live
    // mode is the open-outcry path on the bid clock. This flag says which is in
    // force; the timers below are suspended entirely in election mode.
    this._election_mode = false
    // Which auction SYSTEM this league-season runs: this design, or the
    // 2021-2025 timer-driven open outcry it rolls back to. Distinct from
    // `_election_mode`, which is which MODE is in force right now inside this
    // design and is a function of the block schedule and the clock. Collapsing
    // the two would make a season boolean a second source of truth for mode, and
    // the two would disagree the moment a block convened.
    this._system_election_mode = false
    // A block ending while a player is open lets that nomination FINISH under
    // live clocks and reverts afterward: reverting mid-player would strand a
    // half-resolved open outcry with no clock to conclude it.
    this._pending_election_mode = false
    // `_election_mode` starts false, which is a real mode rather than "unknown",
    // so the first resolve must transition even when it agrees with the default.
    // Without this a socket that BOOTS inside a block sits in live mode with
    // neither clock armed: nothing auto-nominates and the block does nothing at
    // all until a manager acts, which is the block failing exactly when it is
    // supposed to be carrying the auction.
    this._mode_resolved = false
    this._block_end_at = null
    this._is_final_block = false
    // Per-player, cleared on every nomination. A manual bid SUPERSEDES that
    // team's standing maximum for the rest of the player, so the engine stops
    // proxying for them at their ceiling and treats the amount they typed as
    // their claim. It is socket state rather than a transactions column because
    // an engine bid and a human bid are indistinguishable on the wire by
    // design -- proxy provenance is deliberately not recorded -- and this is the
    // one place that has to tell them apart.
    this._manual_bids = new Map()
    // WHEN THE RUNNING CLOCK EXPIRES, in epoch milliseconds, or null when no
    // clock is armed. The SERVER owns this. The client used to rebuild it from a
    // duration on every AUCTION_BID, which is wrong in the two places it matters
    // most: a PROXY step does not reset the bid clock but does broadcast a bid,
    // so a manager saw a fresh countdown while the sale was seconds away; and a
    // reconnecting client got no countdown at all, because AUCTION_INIT carried
    // durations and no expiry.
    this._timer_expires_at = null
    this._timers = timers
    this._announce = announce

    this.logger = debug(`auction:league:${lid}`)
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  has(tid) {
    return this._tids.includes(tid)
  }

  /**
   * Join the auction as the team the authenticated user owns.
   *
   * THE ACTING TEAM IS RESOLVED HERE, ONCE, AND BOUND TO THE SOCKET. Everything
   * downstream -- the bid, the nomination, the connected-team list -- reads it
   * from that binding rather than from anything the client sends, so `tid`
   * deliberately is NOT a parameter: the AUCTION_JOIN payload is client input
   * and `api/sockets/index.mjs` has no more authority over the acting team than
   * the message body does.
   *
   * OWNERSHIP, NOT `verify_user_team`. That helper passes a league's
   * commissioner for every team in it, which is right for the roster and trade
   * routes it was written for and wrong here: in this league the commissioner is
   * a competing manager, so accepting a commissioner-supplied team would leave
   * the one identity that matters most able to name any team on the board. The
   * commissioner's designed power over other teams does not run through this
   * value anyway -- `_validate_nomination` keys its bypass on the authenticated
   * user id, and `_create_nomination_bid` writes the team the ROTATION has on
   * the clock.
   */
  async join({ ws, user_id, onclose, client_id }) {
    // A RECONNECT REUSES THE CLIENT ID, AND THAT IS NOT A DUPLICATE.
    //
    // `clientId` is a uuid minted once per page load, so every socket the tab
    // opens over its life carries the same one. This branch used to return on
    // any repeat, which is the whole of a manager locked out of a live auction:
    // there is no protocol heartbeat behind a browser socket, so a phone
    // changing networks leaves the old connection ESTABLISHED on this side for
    // as long as TCP takes to notice, while the client reconnects in about a
    // second and rejoins with the id the corpse still holds. The refusal costs
    // the new socket its message handlers and its AUCTION_INIT, so the board
    // keeps arriving on broadcasts -- those filter on the league id in the
    // query string -- while every bid and nomination is dropped in silence and
    // the client sits at its `isPaused` default reading `Auction is paused`.
    //
    // So a repeat from the SAME user supersedes rather than refuses. A repeat
    // from a different user is still refused: a client id is not a credential
    // and two users sharing one is a defect, not a reconnect.
    const superseded = this._connected_client_ids[client_id]
    if (superseded && superseded.user_id !== user_id) {
      this.logger(
        `client_id ${client_id} is held by user_id ${superseded.user_id}; refusing user_id ${user_id}`
      )
      return
    }

    // THE SAME SOCKET JOINING TWICE IS THE ONE REPEAT THAT MUST STILL REFUSE.
    // Both the mount effect and the reconnect saga can send AUCTION_JOIN for
    // one socket, and `_setup_message_handlers` adds a listener per call -- so
    // a second pass here would double every bid and nomination that socket
    // sends rather than merely re-initialising it.
    if (superseded && superseded.ws === ws) {
      this.logger(`client_id ${client_id} already joined on this socket`)
      return
    }

    // CLAIMED SYNCHRONOUSLY, BEFORE THE FIRST AWAIT, and this ordering is the
    // whole of the guard above.
    //
    // `ws.on('message', async ...)` in `api/sockets/index.mjs` does not
    // serialize: the handler is invoked per frame and its promise is never
    // awaited, so two AUCTION_JOIN frames on one socket interleave freely. With
    // the claim written after `_resolve_acting_team_id` -- a database round trip
    // -- both frames read the same empty slot, both passed the same-socket
    // check, and both went on to call `_setup_message_handlers`. That registers
    // a listener per call, so the socket then bid TWICE for every bid its
    // manager placed, at two different prices, against their own cap. The client
    // sends exactly this pair: AuctionControls' mount effect and the reconnect
    // saga both fire on the same socket.
    //
    // Rolled back on the one refusal below, so a claim never outlives the join
    // that made it.
    this._connected_client_ids[client_id] = { user_id, ws }

    const tid = await this._resolve_acting_team_id(user_id)

    // A commissioner who manages no team in this league still runs the auction
    // -- pausing it, resuming it, and nominating for a team whose clock ran out
    // -- so they join with no acting team rather than being refused. They can
    // place no bid, because there is no team to charge.
    if (!tid && user_id !== this._league.commissioner_user_id) {
      this.logger(`user_id ${user_id} manages no team in league ${this._lid}`)
      if (superseded) this._connected_client_ids[client_id] = superseded
      else delete this._connected_client_ids[client_id]
      this.reply(user_id, 'invalid team')
      return
    }

    // Track user connections. Keyed by team, so a commissioner with no team in
    // the league is deliberately absent from it: `pause_on_team_disconnect`
    // counts TEAMS present, and an entry under no team would hold the league.
    //
    // A SUPERSEDING JOIN ADDS NOTHING HERE. The entry the previous socket made
    // is still standing and its close is guarded out below, so pushing again
    // would leave this team two presences and one socket -- and the team would
    // then read as connected for the whole auction after the manager closed the
    // tab, which is the auto-pause denominator silently wrong in the direction
    // that never fires.
    if (tid && !superseded) {
      if (this._connected[tid]) {
        this._connected[tid].push(user_id)
      } else {
        this._connected[tid] = [user_id]
      }
    }

    // The claim above already points at this socket, which is what the close
    // handler reads to decide whether it still owns the client id -- so the
    // replaced socket can be torn down without its handler deregistering the
    // one that replaced it.
    if (superseded) {
      this.logger(`client_id ${client_id} superseded by a new socket`)
      // `terminate` rather than `close`: the socket being replaced is one this
      // side has no reason to believe is still reachable, and a close handshake
      // waits for a peer that is frequently gone.
      //
      // Called outright rather than behind a `typeof` check. The guard that was
      // here existed only so a spec stub without `terminate` would not throw,
      // which is production code shaped by a test double -- and it would have
      // silently skipped the terminate against a real socket that had somehow
      // lost the method, which is the failure it looks like it prevents.
      superseded.ws.terminate()
    }

    this.logger(`user_id ${user_id} joined as team_id ${tid}`)

    // Set up message handlers
    this._setup_message_handlers(ws, user_id, tid)

    // Set up connection close handler
    this._setup_close_handler(ws, tid, user_id, onclose, client_id)

    // Send initial auction state
    await this._send_auction_init(user_id)
  }

  reply(user_id, message) {
    const event = {
      type: 'AUCTION_ERROR',
      payload: { error: message }
    }
    this._wss.clients.forEach((client) => {
      if (client.user_id === user_id && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event))
      }
    })
  }

  broadcast(message) {
    this._wss.clients.forEach((client) => {
      if (
        client.league_id === this._lid &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(JSON.stringify(message))
      }
    })
  }

  async setup() {
    await this._load_teams()
    await this._load_transactions()
    await this._load_league()
    await this._calculate_team_capacities()
    this._schedule_mode_poll()
  }

  start() {
    // A league pause outranks the auction's own resume control: the
    // commissioner must lift the league pause first, or the timers would
    // restart and the next bid would be refused anyway.
    if (this._league_paused) {
      this.logger('refusing to start auction -- league is paused')
      return
    }

    if (!this._paused) return

    this.logger('starting auction')
    this._paused = false

    this.broadcast({ type: 'AUCTION_START' })

    const latest = this._transactions[0]
    if (latest && latest.type === transaction_types.AUCTION_BID) {
      this._start_bid_timer()
    } else {
      this._start_nomination_timer()
    }
  }

  /**
   * Stop the auction's own clock.
   *
   * ELECTION MODE HAS NO CLOCK TO PAUSE, AND THIS REFUSES RATHER THAN PRETENDS.
   * `_load_league` force-clears `_paused` for exactly that reason, but it runs
   * once at socket setup while this runs whenever a team drops, a commissioner
   * taps Pause, or a league pause is read -- so `_paused` went back to true
   * afterwards and nothing in election mode ever cleared it again. There is no
   * bid clock to restart, so `start()` is not reached on any normal path; the
   * auction simply stopped accepting nominations and bids with `auction is
   * paused`, and every client in the league rendered that string over a board
   * that was still settling elections over REST.
   *
   * The league-wide pause is NOT weakened by refusing here. `_league_paused` is
   * its own flag, `bid` and `nominate` consult it ahead of this one, and
   * LeaguePauseNotice already states it on every route -- so the pause still
   * refuses every write it always did, without the auction claiming a state it
   * has no clock to be in.
   */
  pause() {
    if (this._election_mode) {
      this.logger('refusing to pause -- election mode has no clock to pause')
      return
    }

    if (this._paused) return

    this.logger('pausing auction')
    this._clear_timers()
    this._paused = true
    this.broadcast({ type: 'AUCTION_PAUSED' })
  }

  // ============================================================================
  // AUCTION LOGIC METHODS
  // ============================================================================

  /**
   * Close the open player at the price on the board, when the bid clock expires.
   *
   * THE BID CLOCK IS NOT THE ONLY WRITER ON THE OPEN PLAYER. Inside a live block
   * a manager can still complete the eligible set over REST, and a trade or a
   * commissioner-override release reaches `settle_auction_player_if_complete`
   * through `reevaluate_auction_after_roster_change` -- so two writers race for
   * one nomination. They resolve to DIFFERENT TEAMS when they disagree:
   * supersession binds a claim downward in `_manual_bids`, which is socket state
   * `build_auction_claims` is deliberately blind to, so the engine can read an
   * un-superseded ceiling and name a winner the board does not show. Left
   * unserialised that put one player on two rosters and charged both teams.
   *
   * So this takes the same per-league advisory lock every settlement path takes,
   * and re-reads the nomination UNDER it. `_transactions` is a cache of state
   * REST moves; signing from it after a settlement committed is exactly the
   * staleness this subsystem has now produced three times.
   */
  async sold() {
    this._locked = true

    let result
    try {
      result = await db.transaction(async (trx) => {
        await lock_auction_for_league({ trx, lid: this._lid })

        const nomination = await get_active_auction_nomination({
          lid: this._lid,
          db_client: trx
        })
        // An AUCTION_PROCESSED on top means the player this clock was running
        // for is already signed. Not an error and not a refusal -- the auction
        // advanced, just not here.
        if (!nomination) return { settled_elsewhere: true }

        const bid = nomination.bids[nomination.bids.length - 1]
        const { tid, pid, player_salary: value } = bid

        this.logger(`processing ${pid} bid`)

        const player_info = await this._validate_player(bid, trx)
        if (!player_info) return { refused: true }

        const roster = await getRoster({ tid })
        const roster_obj = new Roster({ roster, league: this._league })

        if (
          !this._validate_team_can_acquire_player(
            roster_obj,
            player_info,
            value,
            bid
          )
        ) {
          return { refused: true }
        }

        await this._add_player_to_roster(roster_obj, player_info, tid, bid, trx)
        await this._update_team_capacity(tid, value, trx)

        return {
          transaction: await this._record_auction_transaction(bid, trx)
        }
      })

      if (result.refused) return

      if (result.settled_elsewhere) {
        // Catch the socket up to the settlement it lost to, or the rotation
        // stays parked on a player that is gone and nothing can be nominated.
        await this._reload_after_settlement()
        const nominating_team_id = this.nominating_team_id
        if (!nominating_team_id) {
          this.broadcast({ type: 'AUCTION_COMPLETE' })
          return false
        }
        this.broadcast({
          type: 'AUCTION_NOMINATION_INFO',
          payload: { nominating_team_id }
        })
        this._start_nomination_timer()
        return false
      }

      // Broadcast AFTER the commit. Announcing a sale from inside its own
      // transaction tells every client about a row that can still roll back.
      this._announce_auction_transaction(result.transaction)

      this._manual_bids.clear()

      // The player that held the block open is placed, so a revert deferred at
      // the block boundary can happen now. Checked BEFORE the rotation broadcast
      // so the next nomination is validated in the mode it will actually run in.
      if (this._pending_election_mode) {
        await this._leave_live_mode()
      }

      const nominating_team_id = this.nominating_team_id
      if (!nominating_team_id) {
        // An exhausted nomination rotation IS the auction-complete condition:
        // every team signs exactly as many players as it has open active spots,
        // so no team having roster space means the auction has placed everyone
        // it had to. Nothing is stamped on `seasons` -- the auction runs the
        // whole free agency period and ends when the period does, so there is
        // no separate auction-end instant to record.
        return this.broadcast({ type: 'AUCTION_COMPLETE' })
      }

      this.broadcast({
        type: 'AUCTION_NOMINATION_INFO',
        payload: { nominating_team_id }
      })

      // Start next phase
      this._start_nomination_timer()
      return true
    } catch (error) {
      this.logger('error in sold()', error)
      this._start_bid_timer()
      // The acting user is read off the cache rather than the transaction that
      // just rolled back, and it is only ever used to address an error reply.
      const latest = this._transactions[0]
      if (latest) this.reply(latest.user_id, 'processing error')
      return false
    } finally {
      this._locked = false
    }
  }

  /**
   * @param {object} message - the ACTION only: which player, and how much
   * @param {object} actor - the socket-authenticated identity and its team
   * @param {number} actor.user_id
   * @param {number|null} actor.tid
   *
   * THE ACTOR IS A SEPARATE ARGUMENT BECAUSE IT IS NOT CLIENT INPUT, which is
   * the same reason `nominate` has taken one all along. A bid spends a team's
   * cap and awards it the player when the clock expires, so the team doing the
   * bidding is exactly the field a payload must not be able to name.
   */
  async bid(message, { user_id, tid }) {
    if (await this._refresh_league_pause()) return
    if (this._refuse_while_paused('bid', user_id)) return

    // A commissioner who manages no team in this league has no cap to spend.
    if (!tid) {
      this.logger(`refusing a bid from user_id ${user_id} with no acting team`)
      this.reply(user_id, 'invalid team')
      return
    }

    if (this._locked) return
    this._locked = true

    // Same staleness as `nominate`: a bid is validated against
    // `_transactions[0]`, which a REST settlement moves without telling this
    // instance.
    await this._load_transactions()

    try {
      const current = this._transactions[0]

      // Validate bid
      if (!this._validate_bid(message, current, { user_id, tid })) {
        return
      }

      // Create and record bid
      const bid = await this._create_bid_record(message, { user_id, tid })
      this._transactions.unshift(bid)

      // A BID BINDS THE BIDDER BUT DOES NOT DISCHARGE IT. The bid raises the
      // team's claim if it is above their standing ceiling
      // (`build_auction_claims` is raise-only), so they owe what they bid --
      // but it leaves them in the outstanding set, because a bid states a
      // position at ONE price and completeness needs a position at every price.
      // A bidder who wants out of the outstanding set elects; see
      // `get_outstanding_election_team_ids`.
      //
      // SUPERSESSION IS LIVE-MODE ONLY and does not run here. Binding a claim
      // DOWNWARD -- a team typing $3 while holding a $30 ceiling meaning they
      // meant $3 -- needs `_manual_bids`, which only the live branch below
      // populates, because from the transaction log alone an engine bid and a
      // human bid are the same row. In election mode the $30 ceiling still
      // stands and the team lowers it by revising its election.
      if (this._election_mode) {
        // A BID OUTSIDE A LIVE BLOCK IS ANNOUNCED; one inside a block is not.
        // Operator ruling, 2026-09-02. Outside a block a bid is a rare,
        // deliberate act against a sealed field and the league wants to hear
        // it; inside a block bidding is rapid open outcry and announcing every
        // one would bury the channel. `_election_mode` is exactly "not inside a
        // live block", so the gate is the mode and nothing else.
        //
        // The message names the claim and nothing else. Whom the auction is
        // still waiting on is the client's surface -- the
        // `AUCTION_SETTLEMENT_STATUS` broadcast and the settlement-status
        // component -- never Discord.
        await this._send_claim_notification({
          player_id: message.pid,
          bid_amount: message.value,
          claiming_team_id: tid,
          is_nomination: false
        })

        await this._settle_if_complete()
        return true
      }

      // A HUMAN BID RESETS THE CLOCK; the engine's answer to it does not. That
      // asymmetry is the standard proxy-auction contract and it is what gives a
      // present manager a full bid clock to respond to being outbid by a ceiling
      // they cannot see.
      this._manual_bids.set(tid, message.value)
      this._start_bid_timer()
      await this._apply_proxy_bids()
      return true
    } catch (error) {
      this.logger('error in bid()', error)
      this._start_bid_timer()
      this.reply(user_id, 'bid error')
      return false
    } finally {
      this._locked = false
    }
  }

  /**
   * @param {object} message - the ACTION only: which player, and for how much
   * @param {object} actor
   * @param {number} actor.user_id - the socket-authenticated user; every guard
   *   and every refusal reply below uses this and nothing from the message
   * @param {number|null} actor.tid - the team that user manages
   * @param {number} [actor.attributed_user_id] - whom the recorded transaction
   *   belongs to, when that differs from who authorized it. Only
   *   `_auto_nominate` sets it; a socket message cannot.
   */
  async nominate(message = {}, { user_id, tid, attributed_user_id = user_id }) {
    if (await this._refresh_league_pause()) return
    if (this._refuse_while_paused('nomination', user_id)) return

    // ELECTIONS SETTLE OVER REST, so this instance's transaction cache can be
    // stale by a whole player. `nominating_team_id` reads that cache, and a
    // stale one still shows the settled player's AUCTION_BID on top -- so the
    // turn never advances and the next nomination is validated against the
    // wrong team. Refresh before reading the rotation.
    await this._load_transactions()

    // THE CACHED CAPACITY IS REFRESHED PER PLAYER IN LIVE MODE. `_teams` is
    // computed once at setup and then adjusted only for what the auction itself
    // does, so a trade or a commissioner-override release during a block leaves
    // the engine proxying for a team that can no longer roster anyone. Election
    // mode reads capacity from the database at settlement and does not need
    // this; live mode is the path that acts on the cache.
    if (!this._election_mode) {
      await this._calculate_team_capacities()
    }

    const nominating_team_id = this.nominating_team_id
    let { value = 0 } = message
    const { pid, maximum_bid = null } = message

    this.logger(
      `received nomination for ${pid} for $${value} (team_id ${tid}, user_id ${user_id})`
    )

    // Validate nomination
    if (
      !(await this._validate_nomination(
        message,
        nominating_team_id,
        tid,
        user_id
      ))
    ) {
      return
    }

    // In LIVE mode a nomination opens at $0 unless the commissioner set an
    // amount. In election mode the nominating team states its own opening bid,
    // because nominating is bidding and that bid is the team's claim -- forcing
    // it to $0 would strip the nominator of the position the tie rule awards
    // them.
    if (!this._election_mode) {
      this._clear_nomination_timer()

      if (user_id !== this._league.commissioner_user_id) {
        value = 0
      }
    }

    this.logger(`nominating ${pid}`)

    // Supersession is per player: a manual bid binds a team's claim for the rest
    // of THAT player and says nothing about the next one.
    this._manual_bids.clear()

    // THE CEILING IS ELECTION-MODE ONLY. Inside a live block the engine already
    // proxies every standing maximum and the bid clock closes the player, so a
    // ceiling attached to a nomination there would be a second way to say what
    // the election control already says. Outside one it is the nominator's only
    // way to discharge itself in the same action.
    const nomination_maximum_bid = this._election_mode ? maximum_bid : null

    // A CEILING BINDS ONLY THE TEAM THAT STATED IT, so only that team may state
    // it. `_create_nomination_bid` writes the nomination for whichever team the
    // ROTATION has on the clock, never for the team named in the request -- so
    // the commissioner, who may nominate out of turn, would otherwise be writing
    // an `auction_elections` row for ANOTHER team: discharging it from the
    // outstanding set on a number it never chose, and binding it to pay up to
    // that number. Nominating on another team's behalf was inert while a
    // nomination was only a bid; a ceiling makes it a private instruction, and
    // in this league the commissioner is a competing manager. See
    // `get_team_auction_elections`, which refuses a commissioner variant for the
    // same reason.
    //
    // REFUSED, not silently dropped. A manager who typed a ceiling and was told
    // nothing would believe they had set one.
    if (nomination_maximum_bid !== null && tid !== nominating_team_id) {
      this.reply(user_id, 'cannot set a maximum bid for another team')
      this.logger(
        `refused a nomination ceiling from team ${tid} for team ${nominating_team_id}`
      )
      return
    }

    // Validated HERE rather than inside `_validate_nomination`, which returns
    // true early for the commissioner, and against the DEFAULTED `value` rather
    // than the raw field. Only a ceiling that will actually be written is
    // checked, so a discarded live-mode one cannot refuse a valid nomination.
    if (
      nomination_maximum_bid !== null &&
      !(await this._validate_nomination_maximum_bid({
        maximum_bid: nomination_maximum_bid,
        opening_bid: value,
        nominating_team_id,
        user_id
      }))
    ) {
      return
    }

    const bid = await this._create_nomination_bid({
      pid,
      nominating_team_id,
      value,
      user_id: attributed_user_id,
      maximum_bid: nomination_maximum_bid
    })
    this._transactions.unshift(bid)

    if (this._election_mode) {
      // The claim message names the nomination and nothing else; whom the
      // auction still waits on is the client's surface, not Discord.
      await this._send_claim_notification({
        player_id: pid,
        bid_amount: value,
        claiming_team_id: nominating_team_id,
        is_nomination: true
      })
      // An uncontested nomination can be complete the instant it opens: if
      // every other team is ineligible or has already elected -- days ago,
      // possibly -- the player sells immediately to its nominator.
      await this._settle_if_complete()
    }

    this._locked = false
    this._start_bid_timer()

    // Every standing maximum on this player is a live proxy the moment it opens,
    // so the price jumps to the equilibrium immediately rather than waiting for
    // a human to move first.
    if (!this._election_mode) {
      await this._apply_proxy_bids()
    }

    return true
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  // `user_id` and `tid` are the AUTHENTICATED actor, not message fields. The
  // message carries the action; every guard below is about the team being
  // charged, so reading the team from the message would make each of these a
  // check against a value the bidder chose.
  _validate_bid(message, current, { user_id, tid }) {
    const { pid, value } = message

    // Check team capacity
    const team = this._teams.find((t) => t.team_id === tid)
    if (!team) {
      this.logger(`bid rejected - team ${tid} is not in this auction`)
      this.reply(user_id, 'invalid team')
      return false
    }

    if (team.cap - value < 0) {
      this.reply(user_id, 'exceeds salary limit')
      this._start_bid_timer()
      this.logger(
        `team ${tid} does not have enough available cap ${team.cap} for a bid of ${value}`
      )
      return false
    }

    if (!team.availableSpace) {
      this.reply(user_id, 'exceeds roster limits')
      this._start_bid_timer()
      this.logger(
        `team ${tid} does not have enough available space ${team.availableSpace}`
      )
      return false
    }

    // Check bid validity
    if (current.pid !== pid) {
      this.logger(
        `received bid for player ${pid} is not the current player of ${current.pid}`
      )
      this.reply(user_id, 'invalid bid')
      this._start_bid_timer()
      return false
    }

    if (value <= current.player_salary) {
      this.logger(
        `received bid of ${value} is not greater than current value of ${current.player_salary}`
      )
      this.reply(user_id, 'invalid bid')
      this._start_bid_timer()
      return false
    }

    return true
  }

  /**
   * The optional nomination ceiling, checked on its own.
   *
   * SEPARATE FROM `_validate_nomination`, and that is the whole point. That
   * method returns TRUE EARLY for the commissioner -- twice, once for election
   * mode and once for an expired nomination clock -- so a check living after
   * those returns is skipped on the most ordinary path there is. It also reads
   * `message.value` raw while `nominate` defaults it to 0 separately, so a frame
   * that omits `value` compares every ceiling against `undefined` and every
   * comparison is false.
   *
   * Both of those made a NEGATIVE ceiling reachable, which `submit_auction_election`
   * refuses outright. Splitting the election upsert out of that verb moved the
   * nomination path around its guard, so the guard is restated here rather than
   * assumed.
   *
   * @param {object} params
   * @param {number} params.maximum_bid - already known to be non-null
   * @param {number} params.opening_bid - the DEFAULTED opening bid, never the raw field
   */
  async _validate_nomination_maximum_bid({
    maximum_bid,
    opening_bid,
    nominating_team_id,
    user_id
  }) {
    if (!Number.isInteger(maximum_bid) || maximum_bid < 0) {
      this.reply(user_id, 'invalid maximum bid')
      this.logger(`nomination maximum ${maximum_bid} is not a whole dollar`)
      return false
    }

    // Refused BELOW the opening bid rather than quietly raised. The nomination
    // binds the nominator to its opening bid regardless, so `build_auction_claims`
    // would raise a lower ceiling back up and the manager would be charged a
    // number they had explicitly capped under -- a silent disagreement with what
    // they typed.
    if (maximum_bid < opening_bid) {
      this.reply(user_id, 'invalid maximum bid')
      this.logger(
        `nomination maximum ${maximum_bid} is below the opening bid ${opening_bid}`
      )
      return false
    }

    const roster = await getRoster({ tid: nominating_team_id })
    const roster_obj = new Roster({ roster, league: this._league })
    if (maximum_bid > roster_obj.availableCap) {
      this.reply(user_id, 'exceeds salary limit')
      return false
    }

    return true
  }

  // `user_id` is the SOCKET-AUTHENTICATED identity: what the commissioner
  // checks compare against, and where every refusal below is sent. The message
  // carries no identity at all, so there is nothing here for a client to claim.
  async _validate_nomination(message, nominating_team_id, tid, user_id) {
    const { pid } = message

    if (!pid) {
      this.logger('no player to nominate')
      return false
    }

    // In election mode there is no nomination clock, so the commissioner can
    // nominate at any time rather than only after a timer expires.
    if (this._election_mode && user_id === this._league.commissioner_user_id) {
      return true
    }

    // Allow commish to nominate when timer has expired (normal mode)
    if (
      this._nomination_timer_expired &&
      user_id === this._league.commissioner_user_id
    ) {
      return true
    }

    // Check if it's the team's turn to nominate
    if (nominating_team_id !== tid) {
      this.logger('received nomination from a team out of turn')
      this.reply(user_id, 'invalid nomination')
      return false
    }

    // Validate player exists and is not already rostered
    const players = await db('player').where('pid', pid)
    const player_info = players[0]
    if (!player_info) {
      this.reply(user_id, 'invalid nomination')
      this.logger(`can not nominate invalid player ${pid}`)
      return false
    }

    // Check if player is already rostered
    const roster_rows = await db('rosters_players')
      .where('lid', this._lid)
      .where('season_year', current_season.year)
      .where('pid', pid)
    if (roster_rows.length) {
      this.reply(user_id, 'invalid nomination')
      this.logger(`can not nominate already rostered player ${pid}`)
      return false
    }

    // Validate team has roster space and cap space
    const roster = await getRoster({ tid: nominating_team_id })
    const roster_obj = new Roster({ roster, league: this._league })

    if (
      !roster_obj.has_bench_space_for_position(player_info.primary_position)
    ) {
      this.logger(
        `no open slots available for ${pid} on team_id ${nominating_team_id}`
      )
      this.reply(user_id, 'exceeds roster limits')
      return false
    }

    if (message.value > roster_obj.availableCap) {
      this.reply(user_id, 'exceeds salary limit')
      return false
    }

    return true
  }

  _validate_pass_nomination(message, current, tid) {
    const { pid } = message

    // Validate that there's an active nomination
    if (!current || current.type !== transaction_types.AUCTION_BID) {
      this.logger(`pass nomination rejected - no active nomination`)
      return false
    }

    // Validate that the pass is for the current nomination
    if (current.pid !== pid) {
      this.logger(
        `pass nomination rejected - pid mismatch: ${current.pid} vs ${pid}`
      )
      return false
    }

    // Validate team exists
    const team = this._teams.find((t) => t.team_id === tid)
    if (!team) {
      this.logger(`pass nomination rejected - team not found: ${tid}`)
      return false
    }

    // Validate that the passing team is not the current bid team
    if (current.tid === tid) {
      this.logger(
        `pass nomination rejected - team ${tid} cannot pass their own bid`
      )
      return false
    }

    // Validate team eligibility
    if (team.cap - current.player_salary < 1 || !team.availableSpace) {
      this.logger(
        `pass nomination rejected - team ${tid} not eligible (cap: ${team.cap}, bid: ${current.player_salary}, space: ${team.availableSpace})`
      )
      return false
    }

    return true
  }

  // `bid` is passed rather than read off `_transactions[0]`: `sold` re-reads the
  // nomination under the advisory lock, so the cache and the row being settled
  // can legitimately differ and the reply has to address the right manager.
  async _validate_player(bid, db_client = db) {
    const players = await db_client('player').where('pid', bid.pid)
    const player_info = players[0]

    if (!player_info) {
      this.reply(bid.user_id, 'invalid player')
      this.logger(`can not process invalid player ${bid.pid}`)
      return null
    }

    return player_info
  }

  _validate_team_can_acquire_player(roster_obj, player_info, value, bid) {
    // Check roster space
    if (
      !roster_obj.has_bench_space_for_position(player_info.primary_position)
    ) {
      this.logger(
        `no open slots available for ${player_info.pid} on team_id ${bid.tid}`
      )
      this.reply(bid.user_id, 'exceeds roster limits')
      return false
    }

    // Check cap space
    if (roster_obj.availableCap - value < 0) {
      this.logger('no available cap space')
      this.reply(this._transactions[0].user_id, 'exceeds salary limit')
      return false
    }

    return true
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  async _create_bid_record(message, { user_id, tid }) {
    const { pid, value } = message

    const bid = {
      user_id,
      tid,
      pid,
      lid: this._lid,
      type: transaction_types.AUCTION_BID,
      player_salary: value,
      week: 0,
      season_year: current_season.year,
      occurred_at: new Date()
    }

    const insert_query = await db('transactions')
      .insert(bid)
      .returning('transaction_id')
    const bid_with_uid = {
      ...bid,
      transaction_id: insert_query[0].transaction_id
    }

    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid_with_uid
    })

    return bid_with_uid
  }

  /**
   * Open a nomination, and record the nominator's ceiling when they named one.
   *
   * ONE TRANSACTION, because a nomination no longer discharges its nominator.
   * If the bid committed and the election did not, the player would open and
   * then wait on the very team that nominated it, with the manager believing
   * they had already stated a maximum -- a stall that looks like the auction
   * ignoring them.
   *
   * THE ADVISORY LOCK IS HELD FOR A DIFFERENT REASON THAN `submit_auction_election`
   * HOLDS IT, and saying otherwise would be an invariant documented against the
   * wrong mechanism. That verb holds it across its write AND the completeness
   * check it then runs in the same transaction. This one CANNOT: the lock is
   * `pg_advisory_xact_lock`, so it releases at COMMIT, and `_settle_if_complete`
   * runs afterwards in a transaction of its own that re-acquires it.
   *
   * What the lock does here is protect a concurrent SETTLEMENT from this write.
   * `get_active_auction_nomination` resolves the open player from the newest
   * AUCTION_BID row, so a nomination landing mid-settlement could otherwise move
   * the open player out from under a settlement already resolving the previous
   * one.
   *
   * `maximum_bid` is OPTIONAL and null means "not stated", NOT a decline. A
   * nominator cannot decline the player it nominated, so there is no decline to
   * express here; omitting it simply leaves the nominator outstanding, free to
   * elect later once they have seen the field react.
   */
  async _create_nomination_bid({
    pid,
    nominating_team_id,
    value,
    user_id,
    maximum_bid = null
  }) {
    const bid = {
      user_id,
      tid: nominating_team_id,
      pid,
      type: transaction_types.AUCTION_BID,
      player_salary: value,
      lid: this._lid,
      week: 0,
      season_year: current_season.year,
      occurred_at: new Date()
    }

    const transaction_id = await db.transaction(async (trx) => {
      await lock_auction_for_league({ trx, lid: this._lid })

      const insert_query = await trx('transactions')
        .insert(bid)
        .returning('transaction_id')

      if (maximum_bid !== null) {
        await upsert_auction_election({
          trx,
          lid: this._lid,
          season_year: current_season.year,
          pid,
          tid: nominating_team_id,
          user_id,
          maximum_bid
        })
      }

      return insert_query[0].transaction_id
    })

    const bid_with_uid = { ...bid, transaction_id }

    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid_with_uid
    })

    return bid_with_uid
  }

  async _add_player_to_roster(roster_obj, player_info, tid, bid, db_client) {
    try {
      await db_client('rosters_players').insert({
        roster_id: roster_obj.roster_id,
        slot: roster_slot_types.BENCH,
        player_position: player_info.primary_position,
        pid: player_info.pid,
        extensions: 0,
        tid,
        lid: this._lid,
        season_year: current_season.year,
        week: 0
      })
    } catch (err) {
      this.logger(err)
      this.logger(
        `unable to add player ${player_info.pid} to roster of team_id ${tid}`
      )
      this.reply(bid.user_id, err.message)
      throw err
    }
  }

  // The DATABASE write only. The cached `_teams` entry is adjusted in
  // `_announce_auction_transaction`, after the commit -- a cache decremented
  // inside a transaction that then rolls back leaves the engine proxying against
  // capacity the league does not have, and nothing reads it back to notice.
  async _update_team_capacity(tid, value, db_client) {
    const team = this._teams.find((t) => t.team_id === tid)

    try {
      await db_client('teams')
        .where({ team_id: tid, season_year: current_season.year })
        .update('salary_cap', team.cap - value)
    } catch (err) {
      this.logger(err)
      this.logger('unable to update cap space')
      throw err
    }
  }

  async _record_auction_transaction(bid, db_client) {
    const transaction = {
      user_id: bid.user_id,
      tid: bid.tid,
      pid: bid.pid,
      lid: this._lid,
      type: transaction_types.AUCTION_PROCESSED,
      player_salary: bid.player_salary,
      week: 0,
      season_year: bid.season_year,
      occurred_at: new Date()
    }

    const insert_query = await db_client('transactions')
      .insert(transaction)
      .returning('transaction_id')

    return { ...transaction, transaction_id: insert_query[0].transaction_id }
  }

  // Everything a sale does OUTSIDE its transaction: tell the league, and move
  // the two caches the auction reads between database round trips.
  _announce_auction_transaction(transaction) {
    const team = this._teams.find((t) => t.team_id === transaction.tid)
    if (team) {
      team.availableSpace = team.availableSpace - 1
      team.cap = team.cap - transaction.player_salary
    }

    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: { rid: 0, pos: '', ...transaction }
    })

    this._transactions.unshift(transaction)
  }

  // ============================================================================
  // ELECTION MODE
  // ============================================================================

  /**
   * Teams the auction is still waiting on for the open player.
   *
   * Delegates to the settlement module rather than re-deriving the predicate.
   * The eligible-set rule advances the entire auction in election mode, so a
   * second implementation of it here is the exact shape of the disagreement
   * this redesign removed -- three comparisons of the same budget term lived in
   * this file, and only one of them was right.
   */
  async _get_outstanding_election_tids() {
    const nomination = await get_active_auction_nomination({ lid: this._lid })
    if (!nomination) return []

    const players = await db('player').where('pid', nomination.pid)
    if (!players.length) return []

    const capacities = await get_auction_team_capacities({
      team_ids: this._tids,
      league: this._league,
      player_position: players[0].primary_position,
      current_price: nomination.current_price
    })

    const elections = await db('auction_elections')
      .where({
        lid: this._lid,
        season_year: current_season.year,
        pid: nomination.pid
      })
      .whereNull('withdrawn_at')
      .whereNull('settled_at')

    return get_outstanding_election_team_ids({
      capacities,
      elections
    })
  }

  /**
   * Ask the settlement engine whether the open player is done.
   *
   * The socket never settles anything itself. Elections arrive over REST and
   * bids arrive over this socket, but both land in the one service module that
   * owns validation, completeness and settlement -- two write paths into the
   * same state is how the original atomicity bug got in.
   */
  async _settle_if_complete() {
    try {
      const settlement = await settle_auction_player_if_complete({
        lid: this._lid,
        league: this._league
      })

      if (!settlement) {
        return this._broadcast_settlement_status()
      }

      await this._reload_after_settlement()

      // The same fan-out the REST paths use: notification, the sale, and the
      // advanced turn. Announcing a settlement is one act with four effects and
      // the socket owning its own copy is what let the REST path ship with two
      // of them missing.
      return broadcast_auction_settlement({
        broadcast: (lid, message) => this.broadcast(message),
        lid: this._lid,
        settlement,
        league: this._league,
        logger: this.logger
      })
    } catch (error) {
      this.logger('error settling election', error)
      return false
    }
  }

  // ============================================================================
  // LIVE MODE -- PROXY BIDDING AND AUTO-NOMINATION
  // ============================================================================

  /**
   * Restore the price equilibrium on the open player in ONE step.
   *
   * THIS IS THE SAME RULE THE SETTLEMENT ENGINE USES, run against the live board
   * rather than at completeness: rank every claim, the price is the second
   * highest plus one increment capped at the highest, and the highest claim
   * leads. `resolve_auction_player` is that rule and it is called here rather
   * than reimplemented, which is why proxy bidding costs an engine step rather
   * than a second pricing model.
   *
   * A PROXY SPENDS ONLY WHAT IT TAKES TO LEAD. An absent team holding $30 beats a
   * $10 human bid at $11 and wins there; its ceiling is never revealed and never
   * charged unless a rival pushes the price to it. That property is what makes
   * non-attendance costless, and therefore what makes the whole design
   * acceptable to the league.
   *
   * ONE BID, NOT FORTY. Incrementing a dollar at a time would put dozens of rows
   * on the wire in a second, exhaust both ceilings in a blur, and race the block
   * past players the attending managers never saw.
   *
   * A PROXY STEP DOES NOT RESET THE BID CLOCK. Only a human bid does, which is
   * what keeps a fully-proxied player settling one bid clock after nomination
   * however many teams wanted them -- and what makes a 69-player final block
   * tractable at the historical pace.
   */
  async _apply_proxy_bids() {
    if (this._election_mode) return false

    const nomination = await get_active_auction_nomination({ lid: this._lid })
    if (!nomination) return false

    const players = await db('player').where('pid', nomination.pid)
    const player_row = players[0]
    if (!player_row) return false

    const capacities = await get_auction_team_capacities({
      team_ids: this._tids,
      league: this._league,
      player_position: player_row.primary_position,
      current_price: nomination.current_price
    })

    const elections = await db('auction_elections')
      .where({
        lid: this._lid,
        season_year: current_season.year,
        pid: nomination.pid
      })
      .whereNull('withdrawn_at')
      .whereNull('settled_at')

    const claims = build_auction_claims({
      elections,
      bids: nomination.bids,
      opening_bid: nomination.opening_bid,
      nominating_team_id: nomination.nominating_team_id
    })

    // SUPERSESSION, and it only binds DOWNWARD here. `build_auction_claims`
    // raises a claim to a placed bid because a placed bid is binding; it cannot
    // lower one, because from the transaction log alone an engine bid and a
    // human bid are the same row. This instance knows which is which, so a team
    // that typed $3 while holding a $30 ceiling is bound to $3 and the engine
    // stops proxying for them -- bidding below your own ceiling means you meant
    // that amount.
    for (const claim of claims) {
      if (!this._manual_bids.has(claim.tid)) continue
      claim.maximum_bid = this._manual_bids.get(claim.tid)
    }

    const { winner_tid, price } = resolve_auction_player({
      claims,
      rosters: capacities,
      nominating_team_id: nomination.nominating_team_id,
      opening_bid: nomination.current_price
    })

    if (!winner_tid) return false

    const is_equilibrium =
      winner_tid === nomination.leading_team_id &&
      price <= nomination.current_price
    if (is_equilibrium) return false

    const winning_claim = claims.find((claim) => claim.tid === winner_tid)

    const bid = {
      user_id: winning_claim.user_id || nomination.bids[0].user_id,
      tid: winner_tid,
      pid: nomination.pid,
      lid: this._lid,
      type: transaction_types.AUCTION_BID,
      player_salary: price,
      week: 0,
      season_year: current_season.year,
      occurred_at: new Date()
    }

    const insert_query = await db('transactions')
      .insert(bid)
      .returning('transaction_id')
    const bid_with_uid = {
      ...bid,
      transaction_id: insert_query[0].transaction_id
    }

    this._transactions.unshift(bid_with_uid)
    this.broadcast({ type: 'AUCTION_BID', payload: bid_with_uid })
    this.logger(
      `proxy bid: team ${winner_tid} to $${price} on ${nomination.pid}`
    )

    return true
  }

  /**
   * Nominate the best available player when the nomination clock expires.
   *
   * LIVE MODE ONLY. Nomination is manual in election mode by design and nothing
   * forces the turn there. Today the expired timer only unlocks a commissioner
   * override and advances the auction not at all, which inside a block would
   * stall it for the length of the block.
   *
   * The order is league-wide and comes from `auction-nomination-order.mjs`, but
   * the first entry the team ON THE CLOCK can actually roster is what gets
   * nominated: nominating a fourth defense for a team already at the position
   * cap would be refused by the validator and the timer would expire into
   * nothing all over again.
   */
  async _auto_nominate() {
    if (this._election_mode) return false

    await this._load_transactions()
    const nominating_team_id = this.nominating_team_id
    if (!nominating_team_id) {
      this.broadcast({ type: 'AUCTION_COMPLETE' })
      return false
    }

    const { tier, players } = await get_auction_nomination_order({
      lid: this._lid,
      league: this._league
    })

    const roster = new Roster({
      roster: await getRoster({ tid: nominating_team_id }),
      league: this._league
    })

    const next = players.find((player) =>
      roster.has_bench_space_for_position(player.primary_position)
    )

    if (!next) {
      this.logger(
        `no nominatable player for team ${nominating_team_id} in the ${tier} order`
      )
      return false
    }

    const [owner] = await db('users_teams').where({ tid: nominating_team_id })
    const user_id = owner ? owner.user_id : this._league.commissioner_user_id

    this.logger(
      `auto-nominating ${next.pid} for team ${nominating_team_id} from the ${tier} order`
    )

    // TWO IDENTITIES, AND THEY ARE DIFFERENT ON PURPOSE. The auto-nomination
    // acts under COMMISSIONER authority -- that is what carries it past the turn
    // check for a team whose clock ran out -- but the row it writes is the
    // team's own nomination and has always been attributed to that team's
    // manager. Collapsing the two would either stall the rotation or rewrite
    // whose nomination the transaction log says it was.
    return this.nominate(
      { pid: next.pid, value: 0 },
      {
        user_id: this._league.commissioner_user_id,
        tid: nominating_team_id,
        attributed_user_id: user_id
      }
    )
  }

  async _reload_after_settlement() {
    await this._load_transactions()
    await this._calculate_team_capacities()
  }

  async _broadcast_settlement_status() {
    this.broadcast({
      type: 'AUCTION_SETTLEMENT_STATUS',
      payload: {
        outstanding_election_tids: await this._get_outstanding_election_tids()
      }
    })
    return true
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  async _calculate_eligible_teams(
    bid_value,
    player_pos,
    exclude_team_id = null
  ) {
    const eligible_team_ids = []

    for (const team of this._teams) {
      // Skip the excluded team
      if (exclude_team_id && team.team_id === exclude_team_id) {
        continue
      }

      const team_roster = await getRoster({ tid: team.team_id })
      const team_roster_obj = new Roster({
        roster: team_roster,
        league: this._league
      })

      // `>=`, not `>`. min_bid is $0 and 36% of historical wins went for
      // exactly $0, so a team with an open roster spot participates at $0
      // regardless of remaining budget -- the strict form silently excluded a
      // $0-cap team from every free player, which matching $0 can win under the
      // nomination tiebreak. `has_bench_space_for_position` already subsumes
      // both the roster-space and position-limit terms.
      if (
        team_roster_obj.availableCap >= bid_value &&
        team_roster_obj.has_bench_space_for_position(player_pos)
      ) {
        eligible_team_ids.push(team.team_id)
      }
    }

    return eligible_team_ids
  }

  /**
   * Announce a CLAIM on the open player -- a nomination or a bid.
   *
   * One method for both because they are the same announcement: a team has
   * staked a claim at an amount. `is_nomination` picks the verb and nothing
   * else.
   *
   * OUTSIDE A LIVE BLOCK ONLY. Both call sites are gated on `_election_mode`,
   * which is the operator's rule of 2026-09-02: a bid outside a block is a
   * rare, deliberate act the league wants to hear about, while inside a block
   * bidding is rapid open outcry and announcing each one would bury the channel.
   *
   * THE MESSAGE CARRIES THE CLAIM AND NOTHING ELSE. Whom the auction is still
   * waiting on lives in the `AUCTION_SETTLEMENT_STATUS` broadcast and the
   * settlement-status component -- the client is that surface, not Discord.
   *
   * @param {object} params
   * @param {string} params.player_id
   * @param {number} params.bid_amount
   * @param {number} params.claiming_team_id - who nominated or bid
   * @param {boolean} params.is_nomination
   */
  async _send_claim_notification({
    player_id,
    bid_amount,
    claiming_team_id,
    is_nomination
  }) {
    try {
      const claim_message = await format_nomination_message({
        team_id: claiming_team_id,
        player_id,
        bid_amount,
        is_nomination
      })

      if (claim_message) {
        this.logger(claim_message)
        await this._announce({
          league: this._league,
          message: claim_message
        })
      }
      return true
    } catch (error) {
      this.logger(
        `Discord notification error for auction nomination: ${error.message}`
      )
      return false
    }
  }

  // ============================================================================
  // SETUP AND INITIALIZATION METHODS
  // ============================================================================

  /**
   * @param {object} ws - the connected socket
   * @param {number} user_id - the SOCKET-AUTHENTICATED user, from `request.auth`
   * @param {number|null} tid - the team that user manages, resolved in `join`
   *
   * `user_id` and `tid` are the trust boundary. Every verb below takes both
   * from this closure and none of them reads either from `message.payload`,
   * which is why the payload destructuring here names only the fields that
   * describe the ACTION -- the player, the amount -- and never the actor.
   */
  _setup_message_handlers(ws, user_id, tid) {
    // Registered through `on_socket_message` because every arm below RETURNS a
    // promise -- `bid`, `nominate`, `pause`, `start` all reach the database --
    // and an EventEmitter discards what its listener returns. A rejection from
    // any of them was an unhandled rejection, which `install_process_handlers`
    // exits on, so one failing bid took down the whole API rather than that
    // bid. A sync listener returning promises is the same defect as an `async`
    // one and is easier to miss, since it carries no `async` keyword to grep.
    on_socket_message(
      ws,
      (msg) => {
        let message
        try {
          message = JSON.parse(msg)
        } catch (error) {
          this.logger('Failed to parse message', error.toString())
          return
        }

        switch (message.type) {
          case 'AUCTION_PAUSE':
            if (user_id !== this._league.commissioner_user_id) return
            return this.pause()

          case 'AUCTION_RESUME':
            if (user_id !== this._league.commissioner_user_id) return
            return this.start()

          case 'AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT':
            if (user_id !== this._league.commissioner_user_id) return
            this._pause_on_team_disconnect = !this._pause_on_team_disconnect
            return this.broadcast({
              type: 'AUCTION_CONFIG',
              payload: {
                pause_on_team_disconnect: this._pause_on_team_disconnect
              }
            })

          case 'AUCTION_BID':
            return this.bid(message.payload, { user_id, tid })

          case 'AUCTION_SUBMIT_NOMINATION':
            return this.nominate(message.payload, { user_id, tid })

          case 'KEEPALIVE':
            return

          default:
            return console.log(`invalid message: ${message.type}`)
        }
      },
      `auction:league:${this._lid}`
    )
  }

  _setup_close_handler(ws, tid, user_id, onclose, client_id) {
    ws.on('close', () => {
      // A SUPERSEDED SOCKET OWNS NOTHING AND MUST DEREGISTER NOTHING.
      //
      // The socket a reconnect replaced closes late and out of order -- that
      // lateness is the whole reason the supersession in `join` exists -- and
      // its close would otherwise remove the presence the LIVE socket is
      // standing on: the team drops out of `_connected`, auto-pause fires on a
      // manager who is sitting right there, and the client id the live socket
      // registered under is deleted. `onclose` is skipped with it, because the
      // auction is plainly still in use by the socket that took this one's
      // place.
      // `!current` counts as not owning it, not as owning it. The entry is
      // deleted only by this handler, so its absence means the teardown for this
      // client id has already run -- and falling through would run it a second
      // time, calling `onclose` again (which can drop the auction out of the
      // `auctions` map while a socket is still joined) and broadcasting a
      // duplicate AUCTION_CONNECTED. Reachable when a supersession's live socket
      // closes before the socket it replaced does.
      const current = this._connected_client_ids[client_id]
      if (!current || current.ws !== ws) {
        this.logger(`ignoring close of a superseded socket for ${client_id}`)
        return
      }

      // Remove user from connected list. A commissioner who manages no team in
      // this league was never added to it -- see `join` -- so there is nothing
      // to remove and no team whose disconnect could pause the league.
      if (tid && this._connected[tid]) {
        const index = this._connected[tid].indexOf(user_id)
        if (index !== -1) this._connected[tid].splice(index, 1)

        if (!this._connected[tid].length) {
          delete this._connected[tid]
          if (this._pause_on_team_disconnect) this.pause()
        }
      }

      delete this._connected_client_ids[client_id]
      onclose()

      // Broadcast updated connection status
      this.broadcast({
        type: 'AUCTION_CONNECTED',
        payload: {
          connected: Object.keys(this._connected).map((k) => Number(k))
        }
      })
    })
  }

  async _send_auction_init(user_id) {
    // A client joining mid-auction must not be handed a board that a REST
    // settlement has already moved past.
    await this._load_transactions()
    const nominating_team_id = this.nominating_team_id
    const outstanding_election_tids = this._election_mode
      ? await this._get_outstanding_election_tids()
      : []

    this.broadcast({
      type: 'AUCTION_INIT',
      payload: {
        transactions: this._transactions,
        paused: this._paused,
        tids: this._tids,
        teams: this._teams,
        connected: Object.keys(this._connected).map((k) => parseInt(k, 10)),
        bidTimer: config.bidTimer,
        nominationTimer: config.nominationTimer,
        // The instant the running clock expires, so a client joining or
        // RECONNECTING mid-block gets the time actually remaining rather than a
        // fresh duration -- or, as before, no countdown at all.
        timer_expires_at: this._timer_expires_at
          ? Math.round(this._timer_expires_at / 1000)
          : null,
        nominating_team_id,
        complete: !nominating_team_id,
        pause_on_team_disconnect: this._pause_on_team_disconnect,
        auction_mode: this._election_mode
          ? AUCTION_MODES.ELECTION
          : AUCTION_MODES.LIVE,
        block_end_at: this._block_end_at ? this._block_end_at.unix() : null,
        is_final_block: this._is_final_block,
        // Team ids only. A standing maximum is a sealed bid and no client ever
        // receives another team's amount -- the commissioner's included, since
        // in this league the commissioner is a competing manager.
        outstanding_election_tids
      }
    })
  }

  /**
   * The team this user manages in this league, or null.
   *
   * Read from `users_teams` rather than from `_teams`, because ownership is
   * what is being established and `_teams` is a capacity cache that carries no
   * owner. Scoped to the league AND the season: `users_teams` is keyed by team
   * and season, so a user who managed a different team in a prior year has more
   * than one row.
   */
  async _resolve_acting_team_id(user_id) {
    if (!user_id) return null

    const rows = await db('users_teams')
      .join('teams', function () {
        this.on('teams.team_id', '=', 'users_teams.tid').andOn(
          'teams.season_year',
          '=',
          'users_teams.season_year'
        )
      })
      .where('users_teams.user_id', user_id)
      .where('users_teams.season_year', current_season.year)
      .where('teams.lid', this._lid)
      .select('teams.team_id')

    if (!rows.length) return null

    // One team per user per league-season. More than one is a data defect
    // rather than a state to pick a winner from, so it is named here instead of
    // being resolved silently into whichever row sorted first.
    if (rows.length > 1) {
      this.logger(
        `user_id ${user_id} manages ${rows.length} teams in league ${this._lid}; refusing to guess`
      )
      return null
    }

    return rows[0].team_id
  }

  async _load_teams() {
    const teams = await db('teams').where({
      lid: this._lid,
      season_year: current_season.year
    })
    this._teams = teams.sort((a, b) => a.draft_order - b.draft_order)
    this._tids = this._teams.map((t) => t.team_id)
  }

  async _load_transactions() {
    this._transactions = await db('transactions')
      .whereIn('tid', this._tids)
      .where('season_year', current_season.year)
      .whereIn('type', [
        transaction_types.AUCTION_BID,
        transaction_types.AUCTION_PROCESSED
      ])
      .orderBy('occurred_at', 'desc')
      .orderBy('transaction_id', 'desc')
  }

  async _load_league() {
    this._league = await getLeague({ lid: this._lid })

    // THE CUTOVER IS NOT THE DEPLOY. The bundle can land days before the free
    // agency period opens and sit inert -- every auction surface gates on
    // `free_agency_period_start` -- and turning election mode on is then a
    // second, reversible act rather than a consequence of shipping.
    //
    // `false` selects the timer-driven open-outcry auction, which is a REAL
    // path and not a phantom: deleting slow mode left it fully intact, because
    // it is what a live block runs on. Under `false` the auction additionally
    // stays PAUSED -- `_paused` defaults true in the constructor and only
    // election mode clears it -- so a rollback is inert until the commissioner
    // sends AUCTION_RESUME rather than immediately live on a 14-second clock.
    //
    // The flag chooses whether the block schedule is consulted at all. Under
    // `true` the mode is a query against the finalized blocks and the computed
    // final block for `now`, which `auction-modes.mjs` owns; under `false` this
    // is the pre-redesign auction and there is no election mode to be in.
    this._system_election_mode =
      this._league?.is_auction_election_mode_enabled || false

    if (this._system_election_mode) {
      // Election mode has no clock to pause. The auction advances on elections
      // arriving over REST, so a socket-level pause would stop nothing and
      // would only hide the board from whoever is connected.
      this._paused = false
      await this._refresh_mode()
    } else {
      this._election_mode = false
    }
    this.logger(
      `election-mode system: ${this._system_election_mode}, mode now: ${this._election_mode ? 'election' : 'live'}`
    )

    await this._refresh_league_pause()
  }

  // ============================================================================
  // MODE TRANSITIONS
  // ============================================================================

  /**
   * Ask the block schedule which mode is in force, and move if it has changed.
   *
   * THE SOCKET NEVER DECIDES THE MODE. `auction-modes.mjs` resolves it from the
   * finalized sessions and the computed final block, and this applies the
   * answer. A second derivation here is the shape of the defect this subsystem
   * has already produced twice.
   */
  async _refresh_mode() {
    if (!this._system_election_mode) return

    let resolved
    try {
      resolved = await get_auction_mode({
        lid: this._lid,
        league: this._league
      })
    } catch (error) {
      // A mode lookup that throws must not take the auction with it: staying in
      // whichever mode is already in force is the degraded outcome, and the next
      // poll retries.
      this.logger('error resolving auction mode', error)
      return
    }

    this._block_end_at = resolved.block_end_at
    this._is_final_block = resolved.is_final_block

    const should_be_election = resolved.auction_mode === AUCTION_MODES.ELECTION
    const is_first_resolve = !this._mode_resolved
    this._mode_resolved = true

    if (!is_first_resolve && should_be_election === this._election_mode) return

    if (!should_be_election) return this._enter_live_mode()

    // The finish-under-live-clocks deferral belongs to a BOUNDARY CROSSING, not
    // to a fresh instance. A socket booting in election mode with a player open
    // never ran that player under a clock, so deferring here would leave it in
    // live mode with a bid timer that settles a nomination the eligible set is
    // supposed to decide.
    if (is_first_resolve) {
      this._election_mode = true
      return
    }

    return this._leave_live_mode()
  }

  async _enter_live_mode() {
    this.logger(
      `entering live mode${this._is_final_block ? ' (final block)' : ''}`
    )
    this._election_mode = false
    this._pending_election_mode = false

    // A block is where the ENGINE starts acting on rosters it cached at setup,
    // so the cached capacity has to be current before the first proxy step: a
    // stale one proxies for a team that can no longer roster the player.
    await this._calculate_team_capacities()

    this._broadcast_mode()

    await this._load_transactions()
    const latest = this._transactions[0]
    if (latest && latest.type === transaction_types.AUCTION_BID) {
      // A player that sat unsettled through election mode is now contested on a
      // clock, and every standing maximum on it becomes a live proxy.
      await this._apply_proxy_bids()
      this._start_bid_timer()
    } else {
      this._start_nomination_timer()
    }
  }

  async _leave_live_mode() {
    await this._load_transactions()
    const latest = this._transactions[0]
    if (latest && latest.type === transaction_types.AUCTION_BID) {
      // THE OPEN PLAYER FINISHES UNDER LIVE CLOCKS. Reverting here would leave
      // an open outcry with no clock to conclude it, which is the one way a
      // block can strand a player rather than place one.
      if (!this._pending_election_mode) {
        this.logger(
          'block ended with a player open -- finishing under live clocks'
        )
      }
      this._pending_election_mode = true
      return
    }

    this.logger('leaving live mode')
    this._clear_timers()
    this._election_mode = true

    // ELECTION MODE IS ALWAYS UNPAUSED, and this is the second of the two
    // places that has to establish it -- `_load_league` is the other, and it
    // runs once at setup, so entering election mode at a BLOCK BOUNDARY was
    // reaching it by a path that cleared nothing.
    //
    // A pause taken inside a live block is legitimate: there is a bid clock and
    // stopping it is what the control is for. But the block then ends, this
    // flips the mode, and `_paused` stays true with nothing able to clear it --
    // `start()` is the only other writer and only AUCTION_RESUME reaches it,
    // which the commissioner controls no longer offer in election mode because
    // `pause()` refuses there. The auction refuses every socket write with
    // `auction is paused` and every client renders that string until the last
    // manager disconnects and the instance is discarded.
    this._paused = false
    this._pending_election_mode = false
    this._broadcast_mode()
  }

  _broadcast_mode() {
    this.broadcast({
      type: 'AUCTION_MODE',
      payload: {
        auction_mode: this._election_mode
          ? AUCTION_MODES.ELECTION
          : AUCTION_MODES.LIVE,
        block_end_at: this._block_end_at ? this._block_end_at.unix() : null,
        is_final_block: this._is_final_block
      }
    })
  }

  _schedule_mode_poll() {
    if (!this._system_election_mode) return
    this._mode_timer = this._timers.set_timeout(
      async () => {
        await this._refresh_mode()
        this._schedule_mode_poll()
      },
      AUCTION_MODE_POLL_MS,
      AUCTION_TIMERS.MODE_POLL
    )
  }

  /**
   * Stop every timer this instance owns.
   *
   * The mode poll re-arms itself, so a spec that constructs an Auction and does
   * not stop it leaves a timer running for the life of the process.
   */
  stop() {
    this._clear_timers()
    if (this._mode_timer) this._timers.clear_timeout(this._mode_timer)
    this._mode_timer = null
  }

  /**
   * Refuse a write while the auction is paused.
   *
   * PAUSED HAS TO MEAN A REFUSAL, not merely an absence. Before this, `_paused`
   * stopped the timers and the client hid its controls, but neither write path
   * consulted it -- so a raw socket message could nominate or bid on a paused
   * auction and a nomination would start a bid clock, which is the one thing a
   * pause is supposed to prevent.
   *
   * That matters because pausing is the rollback lever. `is_auction_election_mode_enabled`
   * false leaves the auction paused (`_paused` defaults true and only election
   * mode force-clears it), so "nothing happens until the commissioner resumes"
   * is the property the whole lever rests on. A property that holds only because
   * the UI declines to offer a button is not a property.
   *
   * Inert on the mainline, and `pause()` is what makes that true rather than
   * `_load_league`. The force-clear at setup only ever established the state
   * once; refusing to pause at all in election mode is what keeps it.
   */
  _refuse_while_paused(action, user_id) {
    if (!this._paused) return false

    this.logger(`refusing ${action} -- auction is paused`)
    if (user_id) this.reply(user_id, 'auction is paused')
    return true
  }

  /**
   * Reads the league-wide pause into its OWN flag.
   *
   * `_paused` cannot carry this. Election mode force-clears `_paused` on every
   * `_load_league` (three lines above), so a league pause stored there would be
   * silently dropped the moment election mode is on -- which is precisely when
   * the auction runs unattended for days and a pause matters most.
   *
   * `_paused` is the auction's own clock; `_league_paused` is the league's. The
   * auction is additionally driven into its own paused state here so the timers
   * stop and every connected client sees AUCTION_PAUSED -- in LIVE mode, where
   * there are timers to stop. `pause()` refuses in election mode, and the
   * refusal costs this nothing: the return value below is what `bid` and
   * `nominate` consult, ahead of `_refuse_while_paused`, and LeaguePauseNotice
   * states the pause on every route without the auction claiming a clock state.
   *
   * Re-read rather than cached at the three write paths below: the commissioner
   * pauses over HTTP, in a different process, so a flag set at connect time
   * would go stale exactly when it matters.
   */
  async _refresh_league_pause() {
    const open_pause = await get_open_league_pause({ league_id: this._lid })
    this._league_paused = Boolean(open_pause)

    if (this._league_paused) {
      this.logger('league is paused -- refusing auction writes')
      this.pause()
    }

    return this._league_paused
  }

  async _calculate_team_capacities() {
    for (const team of this._teams) {
      const roster = await getRoster({ tid: team.team_id })
      const r = new Roster({ roster, league: this._league })
      team.availableSpace = r.availableSpace
      team.cap = r.availableCap
    }
  }

  // ============================================================================
  // TIMER METHODS
  // ============================================================================

  _clear_timers() {
    this._clear_nomination_timer()
    this._clear_bid_timer()
    this._timer_expires_at = null
    this._broadcast_timer()
  }

  // Sent whenever the running clock CHANGES, and never inferred from anything
  // else. A bid broadcast is not a clock event -- that conflation is what put a
  // full countdown on screen after a proxy step -- so the two are separate
  // messages and this is the only one the client reads a countdown from.
  _broadcast_timer() {
    this.broadcast({
      type: 'AUCTION_TIMER',
      payload: {
        timer_expires_at: this._timer_expires_at
          ? Math.round(this._timer_expires_at / 1000)
          : null
      }
    })
  }

  async _start_nomination_timer() {
    if (this._election_mode) {
      this.logger('nomination timer suspended in election mode')
      return
    }

    this._nomination_timer_expired = false
    this._clear_nomination_timer()

    this._timer_expires_at = Date.now() + config.nominationTimer
    this._broadcast_timer()

    this._nomination_timer = this._timers.set_timeout(
      async () => {
        this._nomination_timer_expired = true
        // AUTO-NOMINATION IS THE WHOLE POINT OF THE EXPIRY IN LIVE MODE. Before
        // this the expired timer only unlocked a commissioner override and
        // advanced nothing, so a block with a quiet team on the clock stalled for
        // the length of the block. The override survives -- the commissioner can
        // still nominate out of turn once the timer has run -- and it is now the
        // fallback rather than the mechanism.
        try {
          await this._auto_nominate()
        } catch (error) {
          this.logger('error auto-nominating', error)
        }
      },
      config.nominationTimer,
      AUCTION_TIMERS.NOMINATION
    )

    return true
  }

  _clear_nomination_timer() {
    if (this._nomination_timer) {
      this._timers.clear_timeout(this._nomination_timer)
    }
  }

  _start_bid_timer() {
    if (this._election_mode) {
      this.logger('bid timer suspended in election mode')
      return
    }

    this._clear_bid_timer()
    // padded by one second for connection latency
    this._timer_expires_at = Date.now() + config.bidTimer + 1000
    this._broadcast_timer()
    this._bid_timer = this._timers.set_timeout(
      () => this.sold(),
      config.bidTimer + 1000,
      AUCTION_TIMERS.BID
    )
  }

  _clear_bid_timer() {
    if (this._bid_timer) this._timers.clear_timeout(this._bid_timer)
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  // Delegates rather than deciding. The rotation rule also has to be answerable
  // from the REST paths that settle a player in election mode, where there is no
  // socket instance to ask, so it lives in `auction-completion.mjs` and this is
  // the cached-input caller. A second copy here is the shape of the defect this
  // subsystem has now produced twice -- three disagreeing budget comparisons,
  // and three salary-in-force rules of which one was repaired.
  get nominating_team_id() {
    return resolve_nominating_team_id({
      transactions: this._transactions,
      tids: this._tids,
      teams: this._teams
    })
  }
}
