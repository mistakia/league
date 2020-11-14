import { List, Map } from 'immutable'

import { gamelogsActions } from './actions'

const initialState = new Map({
  players: new List(),
  teams: new List(),
  playersAnalysis: new List(),
  teamsAnalysis: new List()
})

export function gamelogsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case gamelogsActions.GET_PLAYER_GAMELOGS_FULFILLED:
      return state.set('players', new List(payload.data))

    case gamelogsActions.GET_TEAM_GAMELOGS_FULFILLED:
      return state.set('teams', new List(payload.data))

    case gamelogsActions.SET_TEAM_GAMELOGS_ANALYSIS:
      return state.set('teamsAnalysis', new Map(payload.data))

    case gamelogsActions.SET_PLAYER_GAMELOGS_ANALYSIS:
      return state.set('playersAnalysis', new Map(payload.data))

    default:
      return state
  }
}
