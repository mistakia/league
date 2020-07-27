import { Record, List, Map } from 'immutable'

export const Trade = new Record({
  uid: null,
  pid: null,
  tid: null,
  lid: null,
  year: null,
  offered: null,
  accepted: null,
  cancelled: null,
  rejected: null,
  vetoed: null,
  proposingTeamPlayers: new List(),
  acceptingTeamPlayers: new List(),
  proposingTeamPicks: new Map(),
  acceptingTeamPicks: new Map(),
  dropPlayers: new List()
})

export function createTrade ({
  uid,
  pid,
  tid,
  lid,
  year,
  offered,
  accepted,
  cancelled,
  rejected,
  vetoed,
  proposingTeamPlayers,
  acceptingTeamPlayers,
  proposingTeamPicks,
  acceptingTeamPicks,
  dropPlayers
}) {
  return new Trade({
    uid,
    pid,
    tid,
    lid,
    year,
    offered,
    accepted,
    cancelled,
    rejected,
    vetoed,
    proposingTeamPlayers: new List(proposingTeamPlayers),
    acceptingTeamPlayers: new List(acceptingTeamPlayers),
    proposingTeamPicks: new Map(proposingTeamPicks.reduce((m, p) => m.set(p.uid, p), new Map())),
    acceptingTeamPicks: new Map(acceptingTeamPicks.reduce((m, p) => m.set(p.uid, p), new Map())),
    dropPlayers: new List(dropPlayers)
  })
}
