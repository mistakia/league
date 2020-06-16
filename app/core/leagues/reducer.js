import { Map, List } from 'immutable'

import { appActions } from '@core/app'
import { createLeague } from './league'
import { teamActions } from '@core/teams'

const initialState = new Map()

export function leaguesReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.leagues.forEach(l => state.set(l.uid, createLeague(l)))
      })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.setIn(
        [payload.opts.leagueId, 'teams'],
        new List(payload.data.teams.map(t => t.uid))
      )

    case appActions.LOGOUT:
      return initialState

    default:
      return state
  }
}
