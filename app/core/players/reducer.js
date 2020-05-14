import { Map } from 'immutable'

import { playerActions } from './actions'
import { createPlayer } from './player'

const initialState = new Map({
  isPending: false,
  items: new Map()
})

export function playersReducer (state = initialState, { payload, type }) {
  switch (type) {
    case playerActions.FETCH_PLAYER_PENDING:
      return state.merge({
        isPending: true
      })

    case playerActions.FETCH_PLAYER_FAILED:
      return state.merge({
        isPending: false
      })

    case playerActions.FETCH_PLAYERS_FULFILLED:
      return state.withMutations(players => {
        players.set('isPending', false)
        payload.data.forEach(playerData => {
          players.setIn(['items', playerData.player], createPlayer(playerData))
        })
      })

    default:
      return state
  }
}
