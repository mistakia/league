import { Record, List } from 'immutable'

export const Season = new Record({
  wildcard_round: null,
  championship_round: new List()
})

export const create_season = ({ wildcard_round, championship_round }) =>
  new Season({
    wildcard_round,
    championship_round: new List(championship_round)
  })
