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
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import {
  format_nomination_message,
  format_nomination_complete_message
} from '#libs-server/format-slow-mode-discord-message.mjs'
import {
  initialize_slow_mode_nomination,
  record_team_pass,
  update_current_bid,
  check_nomination_complete,
  complete_slow_mode_nomination,
  clear_slow_mode_nomination,
  get_slow_mode_nomination_state
} from '#libs-server/auction-slow-mode-redis.mjs'
import debug from 'debug'

export default class Auction {
  constructor({ wss, lid }) {
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
    this._slow_mode = false

    // Slow mode Redis operations
    this._slow_mode_redis = {
      initialize_slow_mode_nomination,
      record_team_pass,
      update_current_bid,
      check_nomination_complete,
      complete_slow_mode_nomination,
      clear_slow_mode_nomination,
      get_slow_mode_nomination_state
    }

    this.logger = debug(`auction:league:${lid}`)
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  has(tid) {
    return this._tids.includes(tid)
  }

  async join({ ws, tid, user_id, onclose, client_id }) {
    // Prevent duplicate client connections
    if (this._connected_client_ids[client_id]) {
      this.logger(`client_id ${client_id} already connected`)
      return
    }

    // Track user connections
    if (this._connected[tid]) {
      this._connected[tid].push(user_id)
    } else {
      this._connected[tid] = [user_id]
    }
    this._connected_client_ids[client_id] = user_id

    this.logger(`user_id ${user_id} joined`)

    // Set up message handlers
    this._setup_message_handlers(ws, user_id)

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

  pause() {
    if (this._paused) return

    this.logger('pausing auction')
    this._clear_timers()
    this._paused = true
    this.broadcast({ type: 'AUCTION_PAUSED' })
  }

  // ============================================================================
  // AUCTION LOGIC METHODS
  // ============================================================================

  async sold() {
    this._locked = true
    const bid = this._transactions[0]
    const { tid, pid, player_salary: value } = bid

    this.logger(`processing ${pid} bid`)

    try {
      // Validate player
      const player_info = await this._validate_player(pid)
      if (!player_info) return

      // Validate team can acquire player
      const roster = await getRoster({ tid })
      const roster_obj = new Roster({ roster, league: this._league })

      if (
        !this._validate_team_can_acquire_player(roster_obj, player_info, value)
      ) {
        return
      }

      // Add player to roster
      await this._add_player_to_roster(roster_obj, player_info, tid, value)

      // Update team capacity
      await this._update_team_capacity(tid, value)

      // Record transaction
      await this._record_auction_transaction(bid)

      const nominating_team_id = this.nominating_team_id
      if (!nominating_team_id) {
        await db('seasons').where('lid', this._lid).update({
          free_agency_live_auction_end: new Date()
        })

        this._league = await getLeague({ lid: this._lid })
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
      this.reply(bid.user_id, 'processing error')
      return false
    } finally {
      this._locked = false
    }
  }

  async bid(message) {
    if (await this._refresh_league_pause()) return
    if (this._locked) return
    this._locked = true

    try {
      const { tid, pid, value } = message
      const current = this._transactions[0]

      // Validate bid
      if (!this._validate_bid(message, current)) {
        return
      }

      // Create and record bid
      const bid = await this._create_bid_record(message)
      this._transactions.unshift(bid)

      // Handle slow mode updates if enabled
      if (this._slow_mode) {
        await this._handle_slow_mode_bid_update(pid, value, tid)
      } else {
        this._start_bid_timer()
      }
      return true
    } catch (error) {
      this.logger('error in bid()', error)
      this._start_bid_timer()
      this.reply(message.user_id, 'bid error')
      return false
    } finally {
      this._locked = false
    }
  }

  async nominate(message = {}, { user_id, tid }) {
    if (await this._refresh_league_pause()) return

    const nominating_team_id = this.nominating_team_id
    // The socket-authenticated `user_id` above and the one the CLIENT sends in
    // the message are different identities, and this file has always printed
    // both. Binding the message field as `user_id` would shadow the
    // authenticated parameter, so it is aliased.
    let { user_id: message_user_id, value = 0 } = message
    const { pid } = message

    this.logger(
      `received nomination for ${pid} for $${value} (team_id ${tid}, socket user_id ${user_id}, account user_id ${message_user_id})`
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

    // Clear nomination timer and create bid (only in normal mode)
    if (!this._slow_mode) {
      this._clear_nomination_timer()

      if (user_id !== this._league.commissioner_user_id) {
        value = 0
      }
    }

    this.logger(`nominating ${pid}`)

    // Create and record nomination bid
    const bid = await this._create_nomination_bid(
      message,
      nominating_team_id,
      value
    )
    this._transactions.unshift(bid)

    // Handle slow mode initialization if enabled
    if (this._slow_mode) {
      await this._initialize_slow_mode_nomination(
        pid,
        value,
        nominating_team_id
      )
    }

    this._locked = false
    this._start_bid_timer()

    return true
  }

  async handle_pass_nomination(message, { user_id, tid }) {
    if (await this._refresh_league_pause()) return

    if (!this._slow_mode) {
      this.logger(`pass nomination rejected - not in slow mode`)
      return
    }

    const { pid } = message
    const current = this._transactions[0]

    // Validate pass nomination
    if (!this._validate_pass_nomination(message, current, tid)) {
      return
    }

    this.logger(`received pass for ${pid} from team_id ${tid}`)

    try {
      // Record pass in Redis state
      await this._slow_mode_redis.record_team_pass(this._lid, pid, tid)

      // Check completion and handle accordingly
      return await this._handle_pass_completion_check(pid)
    } catch (error) {
      this.logger('error handling pass nomination', error)
      return false
    }
  }

  // ============================================================================
  // SLOW MODE METHODS
  // ============================================================================

  async _get_current_slow_mode_state() {
    if (!this._slow_mode) return null

    const current = this._transactions[0]
    if (!current || current.type !== transaction_types.AUCTION_BID) {
      return null
    }

    try {
      return await this._slow_mode_redis.get_slow_mode_nomination_state({
        lid: this._lid,
        pid: current.pid
      })
    } catch (error) {
      this.logger('error getting slow mode state:', error)
      return null
    }
  }

  async _broadcast_slow_mode_state_update() {
    if (!this._slow_mode) return

    try {
      const state = await this._get_current_slow_mode_state()
      if (state) {
        this._wss.clients.forEach((client) => {
          if (
            client.league_id === this._lid &&
            client.readyState === WebSocket.OPEN
          ) {
            client.send(
              JSON.stringify({
                type: 'AUCTION_SLOW_MODE_STATE_UPDATE',
                payload: {
                  slow_mode_state: state
                }
              })
            )
          }
        })
      }
      return true
    } catch (error) {
      this.logger('error broadcasting slow mode state update:', error)
      return false
    }
  }

  async _handle_slow_mode_bid_update(pid, value, tid) {
    this.logger(
      `updating slow mode state for bid ${value} on ${pid} from team ${tid}`
    )

    try {
      // Get player info for position checking
      const players = await db('player').where('pid', pid)
      const player_info = players[0]

      // Calculate eligible teams after bid placement
      const eligible_team_ids = await this._calculate_eligible_teams(
        value,
        player_info.primary_position,
        tid
      )

      // Update Redis state - this resets all passes on new bid
      await this._slow_mode_redis.update_current_bid(
        this._lid,
        pid,
        value,
        tid,
        eligible_team_ids
      )

      // Check if nomination is complete
      const completion_check =
        await this._slow_mode_redis.check_nomination_complete({
          lid: this._lid,
          pid
        })

      if (completion_check.complete) {
        this.logger(
          `nomination complete for ${pid} - reason: ${completion_check.reason}`
        )
        await this._complete_slow_mode_nomination(pid)
      } else {
        await this._send_bid_update_notification(
          pid,
          value,
          eligible_team_ids,
          tid
        )
        await this._broadcast_slow_mode_state_update()
      }
      return true
    } catch (error) {
      this.logger('error updating slow mode state for bid', error)
      return false
    }
  }

  async _initialize_slow_mode_nomination(pid, value, nominating_team_id) {
    this.logger(`initializing slow mode nomination for ${pid}`)

    try {
      // Calculate eligible teams
      const players = await db('player').where('pid', pid)
      const player_info = players[0]
      const eligible_team_ids = await this._calculate_eligible_teams(
        value,
        player_info.primary_position,
        nominating_team_id
      )

      // Initialize Redis state
      await this._slow_mode_redis.initialize_slow_mode_nomination({
        lid: this._lid,
        pid,
        initial_bid: value,
        eligible_teams: eligible_team_ids,
        nominating_team_id
      })

      const completion_check =
        await this._slow_mode_redis.check_nomination_complete({
          lid: this._lid,
          pid
        })

      if (completion_check.complete) {
        this.logger(
          `nomination complete for ${pid} - reason: ${completion_check.reason}`
        )
        await this._complete_slow_mode_nomination(pid)
        return true
      }

      // Send Discord notification
      await this._send_nomination_notification({
        player_id: pid,
        bid_amount: value,
        eligible_team_ids,
        nominating_team_id
      })

      // Broadcast initial state
      await this._broadcast_slow_mode_state_update()
      return true
    } catch (error) {
      this.logger('error initializing slow mode nomination', error)
      // Fall back to normal mode on error
      this._start_bid_timer()
      return false
    }
  }

  async _complete_slow_mode_nomination(pid) {
    try {
      this.logger(`completing slow mode nomination for ${pid}`)

      await this.sold()

      // Clean up Redis state
      await this._slow_mode_redis.complete_slow_mode_nomination(this._lid, pid)

      // Send Discord notification
      await this._send_completion_notification(pid)

      return true
    } catch (error) {
      this.logger('error completing slow mode nomination', error)
      return false
    }
  }

  async _handle_pass_completion_check(pid) {
    const completion_check =
      await this._slow_mode_redis.check_nomination_complete({
        lid: this._lid,
        pid
      })

    if (completion_check.complete) {
      this.logger(
        `nomination complete for ${pid} - reason: ${completion_check.reason}`
      )
      return await this._complete_slow_mode_nomination(pid)
    } else {
      await this._broadcast_slow_mode_state_update()
      return false
    }
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  _validate_bid(message, current) {
    const { user_id, tid, pid, value } = message

    // Check team capacity
    const team = this._teams.find((t) => t.team_id === tid)
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

  async _validate_nomination(message, nominating_team_id, tid, user_id) {
    // `user_id` is the SOCKET-AUTHENTICATED identity and is what the two
    // commissioner checks below must compare against; the message field is only
    // the address the client asked replies to go to. Binding the message field
    // as `user_id` would shadow the parameter and let any client claim the
    // commissioner's id to nominate out of turn, so it is aliased.
    const { pid, user_id: message_user_id } = message

    if (!pid) {
      this.logger('no player to nominate')
      return false
    }

    // In slow mode, allow commish to nominate at any time
    if (this._slow_mode && user_id === this._league.commissioner_user_id) {
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
      this.reply(message_user_id, 'invalid nomination')
      return false
    }

    // Validate player exists and is not already rostered
    const players = await db('player').where('pid', pid)
    const player_info = players[0]
    if (!player_info) {
      this.reply(message_user_id, 'invalid nomination')
      this.logger(`can not nominate invalid player ${pid}`)
      return false
    }

    // Check if player is already rostered
    const roster_rows = await db('rosters_players')
      .where('lid', this._lid)
      .where('season_year', current_season.year)
      .where('pid', pid)
    if (roster_rows.length) {
      this.reply(message_user_id, 'invalid nomination')
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
      this.reply(message_user_id, 'exceeds roster limits')
      return false
    }

    if (message.value > roster_obj.availableCap) {
      this.reply(message_user_id, 'exceeds salary limit')
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

  async _validate_player(pid) {
    const players = await db('player').where('pid', pid)
    const player_info = players[0]

    if (!player_info) {
      this.reply(this._transactions[0].user_id, 'invalid player')
      this.logger(`can not process invalid player ${pid}`)
      return null
    }

    return player_info
  }

  _validate_team_can_acquire_player(roster_obj, player_info, value) {
    // Check roster space
    if (
      !roster_obj.has_bench_space_for_position(player_info.primary_position)
    ) {
      this.logger(
        `no open slots available for ${player_info.pid} on team_id ${this._transactions[0].tid}`
      )
      this.reply(this._transactions[0].user_id, 'exceeds roster limits')
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

  async _create_bid_record(message) {
    const { user_id, tid, pid, value } = message

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

    const insert_query = await db('transactions').insert(bid).returning('uid')
    const bid_with_uid = {
      ...bid,
      uid: insert_query[0].uid
    }

    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid_with_uid
    })

    return bid_with_uid
  }

  async _create_nomination_bid(message, nominating_team_id, value) {
    const { user_id, pid } = message

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

    const insert_query = await db('transactions').insert(bid).returning('uid')
    const bid_with_uid = {
      ...bid,
      uid: insert_query[0].uid
    }

    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid_with_uid
    })

    return bid_with_uid
  }

  async _add_player_to_roster(roster_obj, player_info, tid, value) {
    try {
      await db('rosters_players').insert({
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
      this.reply(this._transactions[0].user_id, err.message)
      throw err
    }
  }

  async _update_team_capacity(tid, value) {
    const team = this._teams.find((t) => t.team_id === tid)
    team.availableSpace = team.availableSpace - 1
    const new_cap = (team.cap = team.cap - value)

    try {
      await db('teams')
        .where({ team_id: tid, season_year: current_season.year })
        .update('salary_cap', new_cap)
    } catch (err) {
      this.logger(err)
      this.logger('unable to update cap space')
      throw err
    }
  }

  async _record_auction_transaction(bid) {
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

    const insert_query = await db('transactions')
      .insert(transaction)
      .returning('uid')

    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: {
        rid: bid.rid || 0, // This might need to be passed from the roster object
        pos: bid.pos || '', // This might need to be passed from player_info
        uid: insert_query[0].uid,
        ...transaction
      }
    })

    this._transactions.unshift(transaction)
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

      if (
        team_roster_obj.availableCap > bid_value &&
        team_roster_obj.has_bench_space_for_position(player_pos)
      ) {
        eligible_team_ids.push(team.team_id)
      }
    }

    return eligible_team_ids
  }

  async _send_nomination_notification({
    player_id,
    bid_amount,
    eligible_team_ids,
    nominating_team_id
  }) {
    try {
      const nomination_message = await format_nomination_message({
        team_id: nominating_team_id,
        player_id,
        bid_amount,
        eligible_teams: eligible_team_ids,
        is_nomination: true
      })

      if (nomination_message) {
        this.logger(nomination_message)
        await sendNotifications({
          league: this._league,
          message: nomination_message,
          notifyLeague: true
        })
      }
      return true
    } catch (error) {
      this.logger(
        `Discord notification error for slow mode nomination: ${error.message}`
      )
      return false
    }
  }

  async _send_bid_update_notification(
    pid,
    value,
    eligible_team_ids,
    current_bidder_tid
  ) {
    try {
      const bid_update_message = await format_nomination_message({
        team_id: current_bidder_tid,
        player_id: pid,
        bid_amount: value,
        eligible_teams: eligible_team_ids,
        is_nomination: false
      })

      if (bid_update_message) {
        this.logger(bid_update_message)
        await sendNotifications({
          league: this._league,
          message: bid_update_message,
          notifyLeague: true
        })
      }
      return true
    } catch (error) {
      this.logger(`Discord notification error for bid update: ${error.message}`)
      return false
    }
  }

  async _send_completion_notification(pid) {
    const current = this._transactions[0]
    if (current && current.pid === pid) {
      try {
        const format_message = await format_nomination_complete_message({
          player_id: current.pid,
          winning_bid_amount: current.player_salary,
          winning_team_id: current.tid
        })

        if (format_message) {
          this.logger(format_message)
          await sendNotifications({
            league: this._league,
            message: format_message,
            notifyLeague: true
          })
        }
        return true
      } catch (error) {
        this.logger('error sending Discord notification for completion', error)
        return false
      }
    }
    return false
  }

  // ============================================================================
  // SETUP AND INITIALIZATION METHODS
  // ============================================================================

  _setup_message_handlers(ws, user_id) {
    ws.on('message', (msg) => {
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
          return this.bid(message.payload)

        case 'AUCTION_SUBMIT_NOMINATION':
          return this.nominate(message.payload, {
            user_id,
            tid: message.payload.tid
          })

        case 'AUCTION_PASS_NOMINATION':
          return this.handle_pass_nomination(message.payload, {
            user_id,
            tid: message.payload.tid
          })

        case 'KEEPALIVE':
          return

        default:
          return console.log(`invalid message: ${message.type}`)
      }
    })
  }

  _setup_close_handler(ws, tid, user_id, onclose, client_id) {
    ws.on('close', () => {
      // Remove user from connected list
      const index = this._connected[tid].indexOf(user_id)
      this._connected[tid].splice(index, 1)

      if (!this._connected[tid].length) {
        delete this._connected[tid]
        if (this._pause_on_team_disconnect) this.pause()
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
    const nominating_team_id = this.nominating_team_id

    // Get current slow mode state if applicable
    let slow_mode_state = null
    if (this._slow_mode) {
      slow_mode_state = await this._get_current_slow_mode_state()
    }

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
        nominating_team_id,
        complete:
          !nominating_team_id || this._league.free_agency_live_auction_end,
        pause_on_team_disconnect: this._pause_on_team_disconnect,
        slow_mode: this._slow_mode,
        slow_mode_state
      }
    })
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
      .orderBy('uid', 'desc')
  }

  async _load_league() {
    this._league = await getLeague({ lid: this._lid })
    this._slow_mode = this._league?.is_free_agency_auction_slow_mode || false
    if (this._slow_mode) {
      this._paused = false
    }
    this.logger(`slow mode enabled: ${this._slow_mode}`)

    await this._refresh_league_pause()
  }

  /**
   * Reads the league-wide pause into its OWN flag.
   *
   * `_paused` cannot carry this. Slow mode force-clears `_paused` on every
   * `_load_league` (three lines above), so a league pause stored there would be
   * silently dropped the moment slow mode is on -- which is precisely when the
   * auction runs unattended for days and a pause matters most.
   *
   * `_paused` is the auction's own clock; `_league_paused` is the league's. The
   * auction is additionally driven into its own paused state here so the timers
   * stop and every connected client sees AUCTION_PAUSED, but the two flags stay
   * separate because only one of them survives slow mode.
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
  }

  async _start_nomination_timer() {
    // Don't start nomination timer in slow mode
    if (this._slow_mode) {
      this.logger('nomination timer suspended in slow mode')
      return
    }

    this._nomination_timer_expired = false
    this._clear_nomination_timer()

    this._nomination_timer = setTimeout(() => {
      this._nomination_timer_expired = true
    }, config.nominationTimer)

    return true
  }

  _clear_nomination_timer() {
    if (this._nomination_timer) clearTimeout(this._nomination_timer)
  }

  _start_bid_timer() {
    // Don't start bid timer in slow mode
    if (this._slow_mode) {
      this.logger('bid timer suspended in slow mode')
      return
    }

    this._clear_bid_timer()
    // padded by one second for connection latency
    this._bid_timer = setTimeout(() => this.sold(), config.bidTimer + 1000)
  }

  _clear_bid_timer() {
    if (this._bid_timer) clearTimeout(this._bid_timer)
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  get nominating_team_id() {
    const last_tran = this._transactions[0]
    if (!last_tran) {
      return this._tids[0]
    }

    const last_nomination = this._transactions.find((tran, index) => {
      const prev = this._transactions[index + 1]
      return (
        tran.type === transaction_types.AUCTION_BID &&
        (!prev || prev.type === transaction_types.AUCTION_PROCESSED)
      )
    })

    this.logger(`last nominating team_id: ${last_nomination.tid}`)

    if (last_tran.type === transaction_types.AUCTION_BID) {
      return last_nomination.tid
    } else {
      // starting with the tid of the last nomination
      const idx = this._tids.indexOf(last_nomination.tid)
      const list = this._tids
        .slice(idx + 1)
        .concat(this._tids.slice(0, idx + 1))

      for (const tid of list) {
        const team = this._teams.find((t) => t.team_id === tid)
        if (team.availableSpace) {
          return team.team_id
        }
      }
    }

    return null
  }
}
