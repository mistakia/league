import { Record, List, Map } from 'immutable'
import { constants } from '@libs-shared'

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
  do: null,
  pc: null,
  ac: null,
  teamtext: 0,
  teamvoice: 0,
  leaguetext: 0,
  picks: new List(),
  stats: new Map({
    [constants.year]: constants.createFantasyTeamStats()
  }),

  playoff_odds: null,
  division_odds: null,
  bye_odds: null,
  championship_odds: null
})

export function createTeam({
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
  picks = [],

  playoff_odds,
  division_odds,
  bye_odds,
  championship_odds,

  stats,

  ...params
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
    do: params.do,
    pc,
    ac,
    teamtext,
    teamvoice,
    leaguetext,
    picks: new List(picks),

    stats: stats
      ? new Map({
          [stats.year]: stats
        })
      : undefined,

    playoff_odds,
    division_odds,
    bye_odds,
    championship_odds
  })
}
