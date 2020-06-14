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

  areSlotsOpen (slots) {
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
