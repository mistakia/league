import * as constants from './constants'

export default class Roster {
  constructor (data) {
    this._roster = data
    this._slots = new Map()

    for (const key in this._roster) {
      if (key.startsWith('s')) {
        this._slots.set(key, this._roster[key])
      }
    }
  }

  get players () {
    return Array.from(this._slots.values())
  }

  get slots () {
    return Object.fromEntries(this._slots)
  }

  removePlayer (playerId) {
    for (const [slot, player] of this._slots.entries()) {
      if (player === playerId) {
        this._slots.set(slot, null)
      }
    }
  }

  addPlayer (slot, player) {
    const slotNum = constants.slots[slot]
    this._slots.set(`s${slotNum}`, player)
  }

  getOpenSlots (slots) {
    const open = []
    for (const slot of slots) {
      const slotNum = constants.slots[slot]
      if (!this._slots.get(`s${slotNum}`)) {
        open.push(slot)
      }
    }

    return open
  }
}
