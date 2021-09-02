import { Record, List, Map } from 'immutable'

export const Roster = new Record({
  isPending: false,
  tid: null,
  lid: null,
  week: null,
  year: null,
  last_updated: null,
  players: new List(),
  lineups: new Map()
})

export function createRoster(roster) {
  if (!roster) {
    return
  }

  const { tid, lid, week, year, last_updated, players } = roster

  return new Roster({
    isPending: false,
    players: new List(players),
    tid,
    lid,
    week,
    year,
    last_updated
  })
}
