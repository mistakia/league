import { Map } from 'immutable'

import { scoreboardActions } from './actions'
import { constants } from '@common'

const initialState = new Map({
  plays: new Map(),
  week: constants.season.week
})

export function scoreboardReducer (state = initialState, { payload, type }) {
  switch (type) {
    case scoreboardActions.GET_SCOREBOARD_FULFILLED:
      return state.withMutations(state => {
        payload.data.forEach(play => {
          state.setIn(['plays', play.playId], play)
        })
      })

    default:
      return state
  }
}
