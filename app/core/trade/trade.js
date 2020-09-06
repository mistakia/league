import { Record, List } from 'immutable'

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
  proposingTeamPicks: new List(),
  acceptingTeamPicks: new List(),
  proposingTeamDropPlayers: new List(),
  acceptingTeamDropPlayers: new List()
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
  proposingTeamDropPlayers,
  acceptingTeamDropPlayers
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
    proposingTeamPicks: new List(proposingTeamPicks),
    acceptingTeamPicks: new List(acceptingTeamPicks),
    proposingTeamDropPlayers: new List(proposingTeamDropPlayers),
    acceptingTeamDropPlayers: new List(acceptingTeamDropPlayers)
  })
}
