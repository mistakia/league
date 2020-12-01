import { Record, List, Map } from 'immutable'
import { constants } from '@common'

export const Team = new Record({
  uid: null,
  div: null,
  name: null,
  image: null,
  abbrv: null,
  lid: null,
  cap: null,
  faab: null,
  wo: null,
  pc: null,
  ac: null,
  teamtext: 0,
  teamvoice: 0,
  leaguetext: 0,
  picks: new List(),
  stats: new Map(constants.createFantasyTeamStats()),

  playoffOdds: null,
  divisionOdds: null,
  byeOdds: null
})

export function createTeam ({
  uid,
  div,
  name,
  image,
  abbrv,
  lid,
  cap,
  faab,
  wo,
  pc,
  ac,
  teamtext,
  teamvoice,
  leaguetext,
  picks = []
}) {
  return new Team({
    uid,
    div,
    name,
    image,
    abbrv,
    lid,
    cap,
    faab,
    wo,
    pc,
    ac,
    teamtext,
    teamvoice,
    leaguetext,
    picks: new List(picks)
  })
}
