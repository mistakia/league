import { Record, List } from 'immutable'

export const Trade = new Record({
  uid: null,
  propose_tid: null,
  accept_tid: null,
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
  proposingTeamReleasePlayers: new List(),
  acceptingTeamReleasePlayers: new List()
})

export function create_trade({
  uid,
  propose_tid,
  accept_tid,
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
  proposingTeamReleasePlayers,
  acceptingTeamReleasePlayers
}) {
  return new Trade({
    uid,
    propose_tid,
    accept_tid,
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
    proposingTeamReleasePlayers: new List(proposingTeamReleasePlayers),
    acceptingTeamReleasePlayers: new List(acceptingTeamReleasePlayers)
  })
}
