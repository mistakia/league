import { Map } from 'immutable'

import { playActions } from './actions'
import { scoreboardActions } from '@core/scoreboard'

export function playsReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case scoreboardActions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboardActions.GET_SCOREBOARD_FULFILLED:
    case playActions.GET_PLAYS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((play) => {
          state.setIn([play.week, `${play.esbid}:${play.playId}`], {
            playStats: [],
            ...play
          })
        })
      })

    case playActions.GET_PLAYSTATS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((playStat) => {
          state.mergeIn(
            [
              playStat.week,
              `${playStat.esbid}:${playStat.playId}`,
              'playStats'
            ],
            [playStat]
          )
        })
      })

    default:
      return state
  }
}
