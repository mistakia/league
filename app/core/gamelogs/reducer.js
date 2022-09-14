import { List, Map } from 'immutable'

import { gamelogsActions } from './actions'
import { playerActions } from '@core/players'

const initialState = new Map({
  players: new Map(),
  teams: new List(),
  playersAnalysis: new List(),
  teamsAnalysis: new List()
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

    case gamelogsActions.GET_TEAM_GAMELOGS_FULFILLED:
      return state.set('teams', new List(payload.data))

    case gamelogsActions.SET_TEAM_GAMELOGS_ANALYSIS:
      return state.set('teamsAnalysis', new Map(payload.data))

    case gamelogsActions.SET_PLAYER_GAMELOGS_ANALYSIS:
      return state.set('playersAnalysis', new Map(payload.data))

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
