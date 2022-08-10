import { Record, List, Map } from 'immutable'

export const Roster = new Record({
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

  const { tid, lid, week, year, last_updated, players, lineups } = roster

  return new Roster({
    players: new List(players),
    lineups: new Map(lineups),
    tid,
    lid,
    week,
    year,
    last_updated
  })
}
