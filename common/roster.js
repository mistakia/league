import * as constants from './constants'

export default class Roster {
  constructor({ roster, league }) {
    this.uid = roster.uid
    this.tid = roster.tid
    this._league = league
    this._players = new Map()

    this.activeRosterLimit =
      league.sqb +
      league.srb +
      league.swr +
      league.ste +
      league.srbwr +
      league.srbwrte +
      league.sqbrbwrte +
      league.swrte +
      league.sdst +
      league.sk +
      league.bench

    for (const { slot, player, pos, value, tag } of roster.players) {
      this._players.set(player, {
        slot,
        player,
        pos,
        rid: roster.uid,
        value,
        tag
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

  get all() {
    return Array.from(this._players.values())
  }

  get players() {
    const arr = []
    for (const { slot, player, pos, rid, tag } of this._players.values()) {
      arr.push({ slot, player, pos, rid, tag })
    }
    return arr
  }

  get starters() {
    const exclude = [
      constants.slots.IR,
      constants.slots.PS,
      constants.slots.PSP,
      constants.slots.BENCH,
      constants.slots.COV
    ]
    return Array.from(this._players.values()).filter(
      (p) => !exclude.includes(p.slot)
    )
  }

  get active() {
    const exclude = [
      constants.slots.IR,
      constants.slots.PS,
      constants.slots.PSP,
      constants.slots.COV
    ]
    return Array.from(this._players.values()).filter(
      (p) => !exclude.includes(p.slot)
    )
  }

  get practice() {
    return this.players.filter(
      (p) => p.slot === constants.slots.PS || p.slot === constants.slots.PSP
    )
  }

  get bench() {
    return this.players.filter((p) => p.slot === constants.slots.BENCH)
  }

  get ir() {
    return this.players.filter((p) => p.slot === constants.slots.IR)
  }

  get cov() {
    return this.players.filter((p) => p.slot === constants.slots.COV)
  }

  get reserve() {
    const slots = [constants.slots.IR, constants.slots.COV]
    return Array.from(this._players.values()).filter((p) =>
      slots.includes(p.slot)
    )
  }

  get(player) {
    return this._players.get(player)
  }

  has(player) {
    return this._players.has(player)
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

  removePlayer(player) {
    this._players.delete(player)
  }

  removeTag(player) {
    const p = this.get(player)
    this._players.set(player, {
      ...p,
      tag: 1
    })
  }

  addPlayer({ slot, player, pos, value = 0, tag = 1 }) {
    if (this.isFull) {
      throw new Error('Roster is full')
    }

    const isEligible = this.isEligibleForSlot({ slot, player, pos })
    if (!isEligible) throw new Error('Player is not eligible')
    this._players.set(player, { slot, player, pos, rid: this.uid, value, tag })
  }

  isEligibleForSlot({ slot, player, pos }) {
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

  isEligibleForTag({ tag, player }) {
    if (tag === 1) {
      return true
    }

    const count = this.getCountByTag(tag)
    return count < this._league[`tag${tag}`]
  }

  hasOpenInjuredReserveSlot() {
    return this.ir.length < this._league.ir
  }

  hasOpenPracticeSquadSlot() {
    return this.practice.length < this._league.ps
  }

  hasOpenBenchSlot(pos) {
    if (this.isFull) {
      return false
    }

    const count = this.players.filter((p) => p.pos === pos).length
    const limit = this._league[`m${pos.toLowerCase()}`]
    return !limit || count < limit
  }
}
