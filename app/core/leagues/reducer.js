import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createLeague } from './league'

const initialState = new Map({
  currentLeagueId: undefined
})

export function leaguesReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        state.set('currentLeagueId', payload.data.leagues[0].uid)
        payload.data.leagues.forEach(l => state.set(l.uid, createLeague(l)))
      })

    case appActions.LOGOUT_FULFILLED:
      return initialState

    default:
      return state
  }
}
