import dayjs from 'dayjs'
import {
  roster_slot_types,
  starting_lineup_slots,
  practice_squad_slots,
  player_tag_types,
  current_season
} from '#constants'
import getExtensionAmount from './get-extension-amount.mjs'
import getActiveRosterLimit from './get-active-roster-limit.mjs'
import isSlotActive from './is-slot-active.mjs'

const nonStarterSlots = [
  roster_slot_types.RESERVE_SHORT_TERM,
  roster_slot_types.RESERVE_LONG_TERM,
  roster_slot_types.BENCH,
  roster_slot_types.COV,
  ...practice_squad_slots
]

export default class Roster {
  constructor({ roster, league }) {
    this.uid = roster.uid
    this.tid = roster.tid
    this.week = roster.week
    this.year = roster.year
    this.lid = roster.lid
    this._league = league
    this._players = new Map()

    this.activeRosterLimit = getActiveRosterLimit(league)

    const is_before_extension_deadline =
      (!current_season.isRegularSeason && !league.ext_date) ||
      (league.ext_date &&
        current_season.now.isBefore(dayjs.unix(league.ext_date)))

    const is_after_restricted_free_agency_end =
      league.tran_end && current_season.now.isAfter(dayjs.unix(league.tran_end))
    for (const {
      slot,
      pid,
      pos,
      value,
      tag,
      extensions,
      bid,
      restricted_free_agency_tag_processed,
      restricted_free_agency_tag_nominated,
      restricted_free_agency_tag_announced,
      restricted_free_agency_original_team
    } of roster.players) {
      const salary = is_before_extension_deadline
        ? getExtensionAmount({
            pos,
            tag,
            extensions,
            league,
            value,
            bid
          })
        : is_after_restricted_free_agency_end
          ? value
          : bid || value

      this._players.set(pid, {
        slot,
        pid,
        pos,
        rid: roster.uid,
        value: salary,
        extensions,
        tag,
        restricted_free_agency_tag_processed,
        restricted_free_agency_tag_nominated,
        restricted_free_agency_tag_announced,
        restricted_free_agency_original_team
      })
    }
  }

  get isFull() {
    return this.active.length >= this.activeRosterLimit
  }

  get availableSpace() {
    return this.activeRosterLimit - this.active.length
  }

  get availableCap() {
    const used = this.active.reduce((a, b) => a + b.value, 0) || 0
    return this._league.cap - used
  }

  get availablePracticeSpace() {
    return this._league.ps - this.practice_signed.length
  }

  get availableReserveSpace() {
    return (
      this._league.reserve_short_term_limit -
      this.reserve_short_term_players.length
    )
  }

  get all() {
    return Array.from(this._players.values())
  }

  get players() {
    const arr = []
    for (const { slot, pid, pos, rid, tag, value } of this._players.values()) {
      arr.push({ slot, pid, pos, rid, tag, value })
    }
    return arr
  }

  // used for inserting into rosters_players table
  get rosters_players() {
    const arr = []
    const { tid, lid, year, week } = this
    for (const {
      slot,
      pid,
      pos,
      rid,
      tag,
      extensions
    } of this._players.values()) {
      arr.push({ slot, pid, pos, rid, tag, extensions, tid, lid, year, week })
    }
    return arr
  }

  get starters() {
    return Array.from(this._players.values()).filter(
      (p) => !nonStarterSlots.includes(p.slot)
    )
  }

  get active() {
    return Array.from(this._players.values()).filter((p) =>
      isSlotActive(p.slot)
    )
  }

  get practice() {
    return this.players.filter((p) => practice_squad_slots.includes(p.slot))
  }

  get practice_signed() {
    return this.players.filter(
      (p) => p.slot === roster_slot_types.PS || p.slot === roster_slot_types.PSP
    )
  }

  get practice_drafted() {
    return this.players.filter(
      (p) =>
        p.slot === roster_slot_types.PSD || p.slot === roster_slot_types.PSDP
    )
  }

  // Returns players that count toward position limits (active roster + signed practice squad)
  // Position limits (mdst, mqb, mrb, mwr, mte, mk) apply to:
  // - Active roster slots (bench, starter slots)
  // - Signed practice squad slots (PS, PSP)
  // Excludes drafted practice squad (PSD, PSDP) and reserve slots
  get roster_players_for_position_limits() {
    return [...this.active, ...this.practice_signed]
  }

  get bench() {
    return this.players.filter((p) => p.slot === roster_slot_types.BENCH)
  }

  get reserve_short_term_players() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === roster_slot_types.RESERVE_SHORT_TERM
    )
  }

  get reserve_long_term_players() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === roster_slot_types.RESERVE_LONG_TERM
    )
  }

  get cov() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === roster_slot_types.COV
    )
  }

  get reserve() {
    const slots = [
      roster_slot_types.RESERVE_SHORT_TERM,
      roster_slot_types.COV,
      roster_slot_types.RESERVE_LONG_TERM
    ]
    return Array.from(this._players.values()).filter((p) =>
      slots.includes(p.slot)
    )
  }

  get(pid) {
    return this._players.get(pid)
  }

  has(pid) {
    return this._players.has(pid)
  }

  getCountByTag(tag) {
    return this.getPlayersByTag(tag).length
  }

  getCountBySlot(slot) {
    return this.getPlayersBySlot(slot).length
  }

  getPlayersByTag(tag) {
    return this.players.filter((p) => p.tag === tag)
  }

  getPlayersBySlot(slot) {
    return this.players.filter((p) => p.slot === slot)
  }

  updateValue(pid, value = 0) {
    const data = this.get(pid)
    this._players.set(pid, { ...data, value })
  }

  updateSlot(pid, slot) {
    const data = this.get(pid)
    this._players.set(pid, { ...data, slot })
  }

  removePlayer(pid) {
    this._players.delete(pid)
  }

  removeTag(pid) {
    const data = this.get(pid)
    this._players.set(pid, {
      ...data,
      tag: 1
    })
  }

  addPlayer({
    slot,
    pid,
    pos,
    value = 0,
    tag = 1,
    extensions = 0,
    restricted_free_agency_original_team = null
  }) {
    // Only check active roster limit for active slots (not reserve, practice squad, etc.)
    // Reserve and practice squad slots don't count against active roster limit
    const is_active_slot = isSlotActive(slot)
    if (is_active_slot && this.isFull) {
      throw new Error('Roster is full')
    }

    const isEligible = this.isEligibleForSlot({ slot, pos })
    if (!isEligible) throw new Error('Player is not eligible')
    this._players.set(pid, {
      slot,
      pid,
      pos,
      rid: this.uid,
      value,
      tag,
      extensions,
      restricted_free_agency_original_team
    })
  }

  isEligibleForSlot({ slot, pos }) {
    if (slot === roster_slot_types.RESERVE_SHORT_TERM) {
      return this.has_open_reserve_short_term_slot()
    } else if (slot === roster_slot_types.RESERVE_LONG_TERM) {
      return true
    } else if (slot === roster_slot_types.COV) {
      return true
    } else if (slot === roster_slot_types.BENCH) {
      return this.has_bench_space_for_position(pos)
    } else if (
      slot === roster_slot_types.PS ||
      slot === roster_slot_types.PSP
    ) {
      return this.has_practice_squad_space_for_position(pos)
    } else if (
      slot === roster_slot_types.PSD ||
      slot === roster_slot_types.PSDP
    ) {
      // Drafted practice squad has unlimited space
      return true
    } else {
      const slotName = Object.keys(roster_slot_types).find(
        (key) => roster_slot_types[key] === slot
      )
      if (!slotName.includes(pos)) {
        return false
      }

      const count = this.getCountBySlot(slot)
      return count < this._league[`s${slotName.toLowerCase()}`]
    }
  }

  hasOpenSlot(slot) {
    const slotName = Object.keys(roster_slot_types).find(
      (key) => roster_slot_types[key] === slot
    )
    const count = this.getCountBySlot(slot)
    return count < this._league[`s${slotName.toLowerCase()}`]
  }

  isStarter(pid) {
    const data = this.get(pid)
    return !nonStarterSlots.includes(data.slot)
  }

  isEligibleForTag({ tag }) {
    if (tag === player_tag_types.REGULAR) {
      return true
    }

    // Only count players that are originally from this team for tag limits
    // For restricted free agency (RFA) tags, we only count players who originated from this team
    if (tag === player_tag_types.RESTRICTED_FREE_AGENCY) {
      const originalTeamTaggedPlayers = this.all.filter(
        (player) =>
          player.tag === tag &&
          (!player.restricted_free_agency_original_team ||
            player.restricted_free_agency_original_team === this.tid)
      )
      return originalTeamTaggedPlayers.length < this._league[`tag${tag}`]
    }

    const count = this.getCountByTag(tag)
    return count < this._league[`tag${tag}`]
  }

  has_open_reserve_short_term_slot() {
    // Values >= 99 are treated as unlimited
    if (this._league.reserve_short_term_limit >= 99) {
      return true
    }
    return (
      this.reserve_short_term_players.length <
      this._league.reserve_short_term_limit
    )
  }

  hasOpenPracticeSquadSlot() {
    return this.practice_signed.length < this._league.ps
  }

  // Check if there's practice squad space for adding new players (includes position limit check)
  has_practice_squad_space_for_position(pos) {
    if (!this.hasOpenPracticeSquadSlot()) {
      return false
    }

    return this.has_position_capacity(pos)
  }

  hasUnprocessedRestrictedTag() {
    const processed_restricted_free_agency_tags = this.all.filter(
      (player) =>
        player.tag === player_tag_types.RESTRICTED_FREE_AGENCY &&
        player.restricted_free_agency_tag_processed &&
        (!player.restricted_free_agency_original_team ||
          player.restricted_free_agency_original_team === this.tid)
    ).length

    const originalTeamTagLimit =
      this._league[`tag${player_tag_types.RESTRICTED_FREE_AGENCY}`]
    return processed_restricted_free_agency_tags !== originalTeamTagLimit
  }

  has_position_capacity(pos) {
    // Position limits (mdst, mqb, etc.) apply to active roster + signed practice squad combined
    const count = this.roster_players_for_position_limits.filter(
      (p) => p.pos === pos
    ).length
    const limit = this._league[`m${pos.toLowerCase()}`]
    return !limit || count < limit
  }

  // Check if there's open bench space for activating existing players (no position limit check)
  has_bench_space() {
    return !this.isFull
  }

  // Check if there's an open bench slot for adding new players (includes position limit check)
  has_bench_space_for_position(pos) {
    if (this.isFull) {
      return false
    }

    return this.has_position_capacity(pos)
  }

  /**
   * Validate if a player can be assigned to a specific slot
   * @param {Object} player - Player object with pos property
   * @param {number} target_slot - Slot constant to validate
   * @returns {boolean} True if player can be assigned to the slot
   */
  validate_slot_for_player(player, target_slot) {
    // Check if slot is a practice squad slot (unlimited for PSD/PSDP)
    if (
      target_slot === roster_slot_types.PSD ||
      target_slot === roster_slot_types.PSDP
    ) {
      return true
    }

    // Check practice squad space for PS/PSP
    if (
      target_slot === roster_slot_types.PS ||
      target_slot === roster_slot_types.PSP
    ) {
      return this.has_practice_squad_space_for_position(player.pos)
    }

    // Check reserve slots
    if (target_slot === roster_slot_types.RESERVE_SHORT_TERM) {
      return this.has_open_reserve_short_term_slot()
    }

    if (
      target_slot === roster_slot_types.RESERVE_LONG_TERM ||
      target_slot === roster_slot_types.COV
    ) {
      return true
    }

    // Check bench slot
    if (target_slot === roster_slot_types.BENCH) {
      return this.has_bench_space_for_position(player.pos)
    }

    // Check starter slots
    if (starting_lineup_slots.includes(target_slot)) {
      const slot_name = Object.keys(roster_slot_types).find(
        (key) => roster_slot_types[key] === target_slot
      )
      // Check position eligibility
      if (!slot_name.includes(player.pos)) {
        return false
      }
      return this.hasOpenSlot(target_slot)
    }

    return false
  }

  /**
   * Get all available slots for a player based on position and roster space
   * @param {Object} player - Player object with pos property
   * @returns {Array<number>} Array of valid slot constants
   */
  get_available_slots_for_player(player) {
    const available_slots = []

    // Always include bench if there's space
    if (this.has_bench_space_for_position(player.pos)) {
      available_slots.push(roster_slot_types.BENCH)
    }

    // Include signed practice squad if space available
    if (this.has_practice_squad_space_for_position(player.pos)) {
      available_slots.push(roster_slot_types.PS)
    }

    // Always include drafted practice squad (unlimited)
    available_slots.push(roster_slot_types.PSD)

    // Include short-term reserve if space available
    if (this.has_open_reserve_short_term_slot()) {
      available_slots.push(roster_slot_types.RESERVE_SHORT_TERM)
    }

    // Check each starter slot for position eligibility
    for (const starter_slot of starting_lineup_slots) {
      const slot_name = Object.keys(roster_slot_types).find(
        (key) => roster_slot_types[key] === starter_slot
      )
      if (slot_name.includes(player.pos) && this.hasOpenSlot(starter_slot)) {
        available_slots.push(starter_slot)
      }
    }

    return available_slots
  }
}
