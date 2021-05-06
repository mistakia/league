import { Map, List } from 'immutable'

import { appActions } from '@core/app'
import { createLeague, League } from './league'
import { teamActions } from '@core/teams'
import { leagueActions } from './actions'
import { DEFAULT_LEAGUE_ID } from '@core/constants'
import { createDefaultLeague } from '@common'

const initialState = new Map({
  [DEFAULT_LEAGUE_ID]: new League(createDefaultLeague({ userId: undefined }))
})

export function leaguesReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.leagues.forEach((l) => state.set(l.uid, createLeague(l)))
      })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.setIn(
        [payload.opts.leagueId, 'teams'],
        new List(payload.data.teams.map((t) => t.uid))
      )

    case leagueActions.SET_LEAGUE:
    case leagueActions.PUT_LEAGUE_FULFILLED:
      return state.setIn(
        [payload.opts.leagueId, payload.opts.field],
        payload.data ? payload.data.value : payload.opts.value
      )

    case appActions.LOGOUT:
      return initialState

    default:
      return state
  }
}
