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
  waiver_order: null,
  draft_order: null,
  pc: null,
  ac: null,
  teamtext: 0,
  teamvoice: 0,
  leaguetext: 0,
  picks: new List(),
  stats: new Map(constants.createFantasyTeamStats()),

  playoff_odds: null,
  division_odds: null,
  bye_odds: null,
  championship_odds: null,
  playoff_odds_with_win: null,
  division_odds_with_win: null,
  bye_odds_with_win: null,
  championship_odds_with_win: null,
  playoff_odds_with_loss: null,
  division_odds_with_loss: null,
  bye_odds_with_loss: null,
  championship_odds_with_loss: null
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
  waiver_order,
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
  playoff_odds_with_win,
  division_odds_with_win,
  bye_odds_with_win,
  championship_odds_with_win,
  playoff_odds_with_loss,
  division_odds_with_loss,
  bye_odds_with_loss,
  championship_odds_with_loss,

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
    waiver_order,
    draft_order: params.draft_order,
    pc,
    ac,
    teamtext,
    teamvoice,
    leaguetext,
    picks: new List(picks),

    stats: Map.isMap(stats) ? stats : stats ? new Map(stats) : undefined,

    playoff_odds,
    division_odds,
    bye_odds,
    championship_odds,
    playoff_odds_with_win,
    division_odds_with_win,
    bye_odds_with_win,
    championship_odds_with_win,
    playoff_odds_with_loss,
    division_odds_with_loss,
    bye_odds_with_loss,
    championship_odds_with_loss
  })
}
