import { Map } from 'immutable'

import { play_actions } from './actions'
import { scoreboard_actions } from '@core/scoreboard'

export function plays_reducer(state = new Map(), { payload, type }) {
  switch (type) {
    case scoreboard_actions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboard_actions.GET_SCOREBOARD_FULFILLED:
    case play_actions.GET_PLAYS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((play) => {
          state.setIn([play.week, `${play.esbid}:${play.playId}`], {
            playStats: [],
            ...play
          })
        })
      })

    case play_actions.GET_PLAYSTATS_FULFILLED:
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
