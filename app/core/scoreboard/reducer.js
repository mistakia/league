import { Map } from 'immutable'

import { scoreboardActions } from './actions'
import { constants } from '@common'

const initialState = new Map({
  plays: new Map(),
  isLoaded: false,
  week: constants.season.week
})

export function scoreboardReducer (state = initialState, { payload, type }) {
  switch (type) {
    case scoreboardActions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboardActions.GET_SCOREBOARD_FULFILLED:
      return state.withMutations(state => {
        state.set('isLoaded', true)
        payload.data.forEach(play => {
          state.setIn(['plays', `${play.esbid}:${play.playId}`], play)
        })
      })

    default:
      return state
  }
}
