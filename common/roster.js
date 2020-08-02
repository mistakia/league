import * as constants from './constants'

export default class Roster {
  constructor ({ roster, league }) {
    this.uid = roster.uid
    this._league = league
    this._players = new Map()

    this._activeRosterLimit = league.sqb + league.srb + league.swr + league.ste + league.srbwr + league.srbwrte + league.sqbrbwrte + league.swrte + league.sdst + league.sk + league.bench

    for (const { slot, player, pos, value } of roster.players) {
      this._players.set(player, { slot, player, pos, rid: roster.uid, value })
    }
  }

  get isFull () {
    return this.active.length >= this._activeRosterLimit
  }

  get availableCap () {
    const used = this.active.reduce((a, b) => a + b.value, 0)
    return this._league.cap - used
  }

  get players () {
    const arr = []
    for (const { slot, player, pos, rid } of this._players.values()) {
      arr.push({ slot, player, pos, rid })
    }
    return arr
  }

  get starters () {
    const exclude = [constants.slots.IR, constants.slots.PS, constants.slots.BENCH]
    return this.players.filter(p => !exclude.includes(p.slot))
  }

  get active () {
    const exclude = [constants.slots.IR, constants.slots.PS]
    return this.players.filter(p => !exclude.includes(p.slot))
  }

  get practice () {
    return this.players.filter(p => p.slot === constants.slots.PS)
  }

  get bench () {
    return this.players.filter(p => p.slot === constants.slots.BENCH)
  }

  get ir () {
    return this.players.filter(p => p.slot === constants.slots.IR)
  }

  has (player) {
    return this._players.has(player)
  }

  _getBySlot (slot) {
    return this.players.filter(p => p.slot === constants.slots[slot])
  }

  removePlayer (player) {
    this._players.delete(player)
  }

  addPlayer ({ slot, player, pos }) {
    const isEligible = this.isEligibleForSlot({ slot, player, pos })
    if (!isEligible) throw new Error('Player is not eligible')
    this._players.set(player, { slot, player, pos, rid: this.uid })
  }

  isEligibleForSlot ({ slot, player, pos }) {
    if (slot === constants.slots.IR) {
      return this.hasOpenIrSlot()
    } else if (slot === constants.slots.BENCH) {
      return this.hasOpenBenchSlot(pos)
    } else if (slot === constants.slots.PS) {
      return this.hasOpenPracticeSquadSlot()
    } else {
      const slotName = Object.keys(constants.slots).find(key => constants.slots[key] === slot)
      if (!slotName.includes(pos)) {
        return false
      }

      const count = this._getBySlot(slot)
      return count < this._league[`s${slotName.toLowerCase()}`]
    }
  }

  hasOpenIrSlot () {
    return this.ir.length < this._league.ir
  }

  hasOpenPracticeSquadSlot () {
    return this.practice.length < this._league.ps
  }

  hasOpenBenchSlot (pos) {
    if (this.isFull) {
      return false
    }

    const count = this.players.filter(p => p.pos === pos).length
    const limit = this._league[`m${pos.toLowerCase()}`]
    return !limit || count < limit
  }
}
