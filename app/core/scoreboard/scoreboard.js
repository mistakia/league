import { Record } from 'immutable'

import { Matchup, create_matchup } from '@core/matchups/matchup'

export const Scoreboard = new Record({
  tid: null,
  points: null,
  projected: null,
  minutes: null,
  matchup: new Matchup()
})

export const create_scoreboard = ({
  tid,
  points,
  projected,
  minutes,
  matchup
} = {}) => {
  return new Scoreboard({
    tid,
    points,
    projected,
    minutes,
    matchup: create_matchup(matchup)
  })
}
