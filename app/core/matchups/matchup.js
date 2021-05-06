import { Record, List } from 'immutable'

export const Matchup = new Record({
  uid: null,
  tids: new List(),
  hid: null,
  aid: null,
  type: null,
  year: null,
  week: null,
  lid: null
})

export function createMatchup({
  uid,
  tids,
  hid,
  aid,
  type,
  year,
  week,
  lid
} = {}) {
  return new Matchup({
    uid,
    tids,
    hid,
    aid,
    type,
    year,
    week,
    lid
  })
}
