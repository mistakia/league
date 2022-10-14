import { Map } from 'immutable'

import { gamelogsActions } from './actions'
import { playerActions } from '@core/players'

const initialState = new Map({
  players: new Map()
})

export function gamelogsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case gamelogsActions.GET_PLAYERS_GAMELOGS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((g) =>
          state.setIn(
            ['players', `${g.year}/${g.seas_type}/${g.week}/${g.pid}`],
            g
          )
        )
      })

    case playerActions.GET_PLAYER_GAMELOGS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((g) =>
          state.setIn(
            ['players', `${g.year}/${g.seas_type}/${g.week}/${g.pid}`],
            g
          )
        )
      })

    default:
      return state
  }
}
