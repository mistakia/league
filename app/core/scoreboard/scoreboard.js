import { Record } from 'immutable'

import { Matchup, createMatchup } from '@core/matchups/matchup'

export const Scoreboard = new Record({
  tid: null,
  points: null,
  projected: null,
  minutes: null,
  matchup: new Matchup()
})

export const createScoreboard = ({
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
    matchup: createMatchup(matchup)
  })
}
