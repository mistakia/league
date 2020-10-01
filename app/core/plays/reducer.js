import { Map } from 'immutable'
import moment from 'moment'

import { playActions } from './actions'
import { scoreboardActions } from '@core/scoreboard'
import { constants } from '@common'

export function playsReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case scoreboardActions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboardActions.GET_SCOREBOARD_FULFILLED:
    case playActions.GET_PLAYS_FULFILLED:
      return state.withMutations(state => {
        payload.data.forEach(play => {
          state.mergeIn([`${play.esbid}:${play.playId}`], play)
        })
      })

    default:
      return state
  }
}
