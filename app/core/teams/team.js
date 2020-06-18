import { Record } from 'immutable'

export const Team = new Record({
  uid: null,
  name: null,
  image: null,
  lid: null,
  acap: null,
})

export function createTeam ({
  uid,
  name,
  image,
  lid,
  acap
}) {
  return new Team({
    uid,
    name,
    image,
    lid,
    acap
  })
}
