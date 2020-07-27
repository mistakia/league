import * as constants from './constants'

export default class Roster {
  constructor ({ roster, league }) {
    this.uid = roster.uid
    this._league = league
    this._players = new Map()

    this._activeRosterLimit = league.sqb + league.srb + league.swr + league.ste + league.srbwr + league.srbwrte + league.sqbrbwrte + league.swrte + league.sdst + league.sk + league.bench

    for (const { slot, player, pos } of roster.players) {
      this._players.set(player, { slot, player, pos, rid: roster.uid })
    }
  }

  get isFull () {
    return this.active.length >= this._activeRosterLimit
  }

  get players () {
    return Array.from(this._players.values())
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

  getBySlot (slot) {
    return this.players.filter(p => p.slot === constants.slots[slot])
  }

  removePlayer (player) {
    this._players.delete(player)
  }

  addPlayer ({ slot, player, pos }) {
    // TODO - handle invalid roster states
    this._players.set(player, { slot, player, pos, rid: this.uid })
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
