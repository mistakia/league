import { Record, List, Map } from 'immutable'

export const Trade = new Record({
  trade_id: null,
  propose_tid: null,
  accept_tid: null,
  lid: null,
  season_year: null,
  offered: null,
  accepted: null,
  cancelled: null,
  rejected: null,
  vetoed: null,
  approved: null,
  proposingTeamPlayers: new List(),
  acceptingTeamPlayers: new List(),
  proposingTeamPicks: new List(),
  acceptingTeamPicks: new List(),
  proposingTeamReleasePlayers: new List(),
  acceptingTeamReleasePlayers: new List(),
  proposingTeamSlots: new Map(),
  acceptingTeamSlots: new Map()
})

export function create_trade({
  trade_id,
  propose_tid,
  accept_tid,
  lid,
  season_year,
  offered,
  accepted,
  cancelled,
  rejected,
  vetoed,
  approved,
  proposingTeamPlayers,
  acceptingTeamPlayers,
  proposingTeamPicks,
  acceptingTeamPicks,
  proposingTeamReleasePlayers,
  acceptingTeamReleasePlayers,
  proposingTeamSlots,
  acceptingTeamSlots
}) {
  return new Trade({
    trade_id,
    propose_tid,
    accept_tid,
    lid,
    season_year,
    offered,
    accepted,
    cancelled,
    rejected,
    vetoed,
    approved,
    proposingTeamPlayers: new List(proposingTeamPlayers),
    acceptingTeamPlayers: new List(acceptingTeamPlayers),
    proposingTeamPicks: new List(proposingTeamPicks),
    acceptingTeamPicks: new List(acceptingTeamPicks),
    proposingTeamReleasePlayers: new List(proposingTeamReleasePlayers),
    acceptingTeamReleasePlayers: new List(acceptingTeamReleasePlayers),
    proposingTeamSlots: new Map(proposingTeamSlots),
    acceptingTeamSlots: new Map(acceptingTeamSlots)
  })
}
