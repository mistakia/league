import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createTeam } from './team'

const initialState = new Map()

export function teamsReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.teams.forEach(t => state.set(t.uid, createTeam(t)))
      })

    case appActions.LOGOUT_FULFILLED:
      return initialState

    default:
      return state
  }
}
