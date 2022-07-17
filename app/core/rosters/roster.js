import { Record, List, Map } from 'immutable'

export const Roster = new Record({
  isPending: false,
  tid: null,
  lid: null,
  week: null,
  year: null,
  penalty: null,
  last_updated: null,
  players: new List(),
  lineups: new Map(),
  acquired_rfa_pids: new List()
})

export function createRoster(roster) {
  if (!roster) {
    return
  }

  const {
    tid,
    lid,
    week,
    year,
    last_updated,
    players,
    lineups,
    penalty,
    acquired_rfa_pids
  } = roster

  return new Roster({
    isPending: false,
    players: new List(players),
    lineups: new Map(lineups),
    tid,
    lid,
    week,
    year,
    last_updated,
    penalty,
    acquired_rfa_pids
  })
}
