import { Record, List } from 'immutable'

export const Team = new Record({
  uid: null,
  name: null,
  image: null,
  lid: null,
  acap: null,
  picks: new List()
})

export function createTeam ({
  uid,
  name,
  image,
  lid,
  acap,
  picks = []
}) {
  return new Team({
    uid,
    name,
    image,
    lid,
    acap,
    picks: new List(picks)
  })
}
