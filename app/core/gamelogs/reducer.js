import { Map } from 'immutable'

import { gamelogs_actions } from './actions'
import { player_actions } from '@core/players'

const initialState = new Map({
  players: new Map()
})

export function gamelogs_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case gamelogs_actions.GET_PLAYERS_GAMELOGS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((g) =>
          state.setIn(
            ['players', `${g.year}/${g.seas_type}/${g.week}/${g.pid}`],
            g
          )
        )
      })

    case player_actions.GET_PLAYER_GAMELOGS_FULFILLED:
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
