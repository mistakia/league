import { List, Map } from 'immutable'

import { gamelogsActions } from './actions'

const initialState = new Map({
  players: new List(),
  teams: new List()
})

export function gamelogsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case gamelogsActions.GET_PLAYER_GAMELOGS_FULFILLED:
      return state.set('players', new List(payload.data))

    default:
      return state
  }
}
