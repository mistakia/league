import dayjs from 'dayjs'
import * as constants from './constants.mjs'
import getExtensionAmount from './get-extension-amount.mjs'
import getActiveRosterLimit from './get-active-roster-limit.mjs'
import isSlotActive from './is-slot-active.mjs'

const nonStarterSlots = [
  constants.slots.IR,
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

    const isBeforeExtensionDeadline =
      (!constants.season.isRegularSeason && !league.ext_date) ||
      constants.season.now.isBefore(dayjs.unix(league.ext_date))
    for (const {
      slot,
      pid,
      pos,
      value,
      tag,
      extensions,
      bid,
      transition_tag_processed,
      transition_tag_nominated,
      transition_tag_announced
    } of roster.players) {
      const salary = isBeforeExtensionDeadline
        ? getExtensionAmount({
            pos,
            tag,
            extensions,
            league,
            value,
            bid
          })
        : bid || value

      this._players.set(pid, {
        slot,
        pid,
        pos,
        rid: roster.uid,
        value: salary,
        extensions,
        tag,
        transition_tag_processed,
        transition_tag_nominated,
        transition_tag_announced
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
    return this._league.ir - this.ir.length
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

  get ir() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === constants.slots.IR
    )
  }

  get cov() {
    return Array.from(this._players.values()).filter(
      (p) => p.slot === constants.slots.COV
    )
  }

  get reserve() {
    const slots = [constants.slots.IR, constants.slots.COV]
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

  addPlayer({ slot, pid, pos, value = 0, tag = 1 }) {
    if (this.isFull) {
      throw new Error('Roster is full')
    }

    const isEligible = this.isEligibleForSlot({ slot, pos })
    if (!isEligible) throw new Error('Player is not eligible')
    this._players.set(pid, { slot, pid, pos, rid: this.uid, value, tag })
  }

  isEligibleForSlot({ slot, pos }) {
    if (slot === constants.slots.IR) {
      return this.hasOpenInjuredReserveSlot()
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

    const count = this.getCountByTag(tag)
    return count < this._league[`tag${tag}`]
  }

  hasOpenInjuredReserveSlot() {
    return this.ir.length < this._league.ir
  }

  hasOpenPracticeSquadSlot() {
    return this.practice_signed.length < this._league.ps
  }

  hasUnprocessedRestrictedTag() {
    const processed_transition_tags = this.all.filter(
      (player) => player.transition_tag_processed
    ).length
    return (
      processed_transition_tags !==
      this._league[`tag${constants.tags.TRANSITION}`]
    )
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
