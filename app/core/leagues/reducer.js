import { Map, List } from 'immutable'

import { appActions } from '@core/app'
import { createLeague, League } from './league'
import { teamActions } from '@core/teams'
import { leagueActions } from './actions'
import { constants, createDefaultLeague } from '@libs-shared'

const initialState = new Map().set(
  constants.DEFAULTS.LEAGUE_ID,
  new League(createDefaultLeague({ isLoaded: true }))
)

export function leaguesReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.leagues.forEach((l) =>
          state.set(l.uid, createLeague({ isLoaded: true, ...l }))
        )
      })

    case leagueActions.GET_LEAGUE_PENDING: {
      if (state.has(payload.opts.leagueId)) {
        return state.setIn([payload.opts.leagueId, 'isLoading'], true)
      } else {
        return state.set(
          payload.opts.leagueId,
          createLeague({ isLoading: true })
        )
      }
    }

    case leagueActions.GET_LEAGUE_FAILED:
      return state.setIn([payload.opts.leagueId, 'isLoading'], false)

    case leagueActions.GET_LEAGUE_FULFILLED:
      return state.set(
        payload.data.uid,
        createLeague({ isLoaded: true, ...payload.data })
      )

    case teamActions.GET_TEAMS_FULFILLED: {
      const teamIds = payload.data.teams.map((t) => t.uid)
      if (state.hasIn([payload.opts.leagueId, 'uid'])) {
        return state.setIn([payload.opts.leagueId, 'teams'], new List(teamIds))
      } else {
        return state.set(
          payload.opts.leagueId,
          createLeague({ teams: teamIds })
        )
      }
    }

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
