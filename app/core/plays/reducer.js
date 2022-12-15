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
            play_stats: [],
            ...play
          })
        })
      })

    case playActions.GET_PLAYSTATS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((play_stat) => {
          state.mergeIn(
            [
              play_stat.week,
              `${play_stat.esbid}:${play_stat.playId}`,
              'play_stats'
            ],
            [play_stat]
          )
        })
      })

    default:
      return state
  }
}
