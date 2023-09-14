import { Record, List } from 'immutable'

export const Matchup = new Record({
  uid: null,
  tids: new List(),
  hid: null,
  aid: null,
  type: null,
  year: null,
  week: null,
  lid: null,

  ap: null,
  hp: null,

  away_projection: null,
  home_projection: null
})

export function createMatchup({
  uid,
  tids,
  hid,
  aid,
  type,
  year,
  week,
  lid,

  ap,
  hp,

  away_projection,
  home_projection
} = {}) {
  return new Matchup({
    uid,
    tids: new List(tids),
    hid,
    aid,
    type,
    year,
    week,
    lid,
    ap,
    hp,
    away_projection,
    home_projection
  })
}
