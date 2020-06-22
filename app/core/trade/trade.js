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
  sendPlayers: new List(),
  receivePlayers: new List(),
  sendPicks: new Map(),
  receivePicks: new Map(),
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
  sendPlayers,
  receivePlayers,
  sendPicks,
  receivePicks,
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
    sendPlayers: new List(sendPlayers),
    receivePlayers: new List(receivePlayers),
    sendPicks: new Map(sendPicks.reduce((m, p) => m.set(p.uid, p), new Map())),
    receivePicks: new Map(receivePicks.reduce((m, p) => m.set(p.uid, p), new Map())),
    dropPlayers: new List(dropPlayers)
  })
}
