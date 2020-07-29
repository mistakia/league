import { Record, List } from 'immutable'

export const Team = new Record({
  uid: null,
  name: null,
  image: null,
  abbrv: null,
  lid: null,
  acap: null,
  teamtext: 0,
  teamvoice: 0,
  leaguetext: 0,
  picks: new List()
})

export function createTeam ({
  uid,
  name,
  image,
  abbrv,
  lid,
  acap,
  teamtext,
  teamvoice,
  leaguetext,
  picks = []
}) {
  return new Team({
    uid,
    name,
    image,
    abbrv,
    lid,
    acap,
    teamtext,
    teamvoice,
    leaguetext,
    picks: new List(picks)
  })
}
