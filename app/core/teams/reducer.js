import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'
import { teamActions } from './actions'

const initialState = new Map()

export function teamsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    case appActions.LOGOUT_FULFILLED:
      return initialState

    case teamActions.GET_TEAMS_FULFILLED:
      return state.withMutations(state => {
        payload.data.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    default:
      return state
  }
}
