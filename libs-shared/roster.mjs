import dayjs from 'dayjs'
import * as constants from './constants.mjs'
import getExtensionAmount from './get-extension-amount.mjs'
import getActiveRosterLimit from './get-active-roster-limit.mjs'
import isSlotActive from './is-slot-active.mjs'

const nonStarterSlots = [
  constants.slots.RESERVE_SHORT_TERM,
  constants.slots.RESERVE_LONG_TERM,
  constants.slots.BENCH,
  constants.slots.COV,
  ...constants.ps_slots
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
      (!constants.season.isRegularSeason && !league.ext_date) ||
      constants.season.now.isBefore(dayjs.unix(league.ext_date))

    const is_after_restricted_free_agency_end = constants.season.now.isAfter(
      dayjs.unix(league.tran_end)
    )
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
    return this.players.filter((p) => constants.ps_slots.includes(p.slot))
  }

  get practice_signed() {
    return this.players.filter(
      (p) => p.slot === constants.slots.PS || p.slot === constants.slots.PSP
    )
  }

  get practice_drafted() {
    return this.players.filter(
      (p) => p.slot === constants.slots.PSD || p.slot === constants.slots.PSDP
    )
  }

  get bench() {
    return this.players.filter((p) => p.slot === constants.slots.BENCH)
  }

  get reserve_short_term_players() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === constants.slots.RESERVE_SHORT_TERM
    )
  }

  get reserve_long_term_players() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === constants.slots.RESERVE_LONG_TERM
    )
  }

  get cov() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === constants.slots.COV
    )
  }

  get reserve() {
    const slots = [
      constants.slots.RESERVE_SHORT_TERM,
      constants.slots.COV,
      constants.slots.RESERVE_LONG_TERM
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
    restricted_free_agency_original_team = null
  }) {
    if (this.isFull) {
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
      restricted_free_agency_original_team
    })
  }

  isEligibleForSlot({ slot, pos }) {
    if (slot === constants.slots.RESERVE_SHORT_TERM) {
      return this.has_open_reserve_short_term_slot()
    } else if (slot === constants.slots.RESERVE_LONG_TERM) {
      return true
    } else if (slot === constants.slots.BENCH) {
      return this.hasOpenBenchSlot(pos)
    } else if (slot === constants.slots.PS || slot === constants.slots.PSP) {
      return this.hasOpenPracticeSquadSlot()
    } else {
      const slotName = Object.keys(constants.slots).find(
        (key) => constants.slots[key] === slot
      )
      if (!slotName.includes(pos)) {
        return false
      }

      const count = this.getCountBySlot(slot)
      return count < this._league[`s${slotName.toLowerCase()}`]
    }
  }

  hasOpenSlot(slot) {
    const slotName = Object.keys(constants.slots).find(
      (key) => constants.slots[key] === slot
    )
    const count = this.getCountBySlot(slot)
    return count < this._league[`s${slotName.toLowerCase()}`]
  }

  isStarter(pid) {
    const data = this.get(pid)
    return !nonStarterSlots.includes(data.slot)
  }

  isEligibleForTag({ tag }) {
    if (tag === constants.tags.REGULAR) {
      return true
    }

    // Only count players that are originally from this team for tag limits
    // For restricted free agency (RFA) tags, we only count players who originated from this team
    if (tag === constants.tags.RESTRICTED_FREE_AGENCY) {
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

  hasUnprocessedRestrictedTag() {
    const processed_restricted_free_agency_tags = this.all.filter(
      (player) =>
        player.tag === constants.tags.RESTRICTED_FREE_AGENCY &&
        player.restricted_free_agency_tag_processed &&
        (!player.restricted_free_agency_original_team ||
          player.restricted_free_agency_original_team === this.tid)
    ).length

    const originalTeamTagLimit =
      this._league[`tag${constants.tags.RESTRICTED_FREE_AGENCY}`]
    return processed_restricted_free_agency_tags !== originalTeamTagLimit
  }

  hasOpenBenchSlot(pos) {
    if (this.isFull) {
      return false
    }

    const count = this.active.filter((p) => p.pos === pos).length
    const limit = this._league[`m${pos.toLowerCase()}`]
    return !limit || count < limit
  }
}
