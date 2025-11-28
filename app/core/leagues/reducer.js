import { Map, List } from 'immutable'

import { app_actions } from '@core/app'
import { createLeague, League } from './league'
import { team_actions } from '@core/teams'
import { league_actions } from './actions'
import { create_default_league } from '@libs-shared'
import { league_defaults } from '@constants'

const initialState = new Map().set(
  league_defaults.LEAGUE_ID,
  new League(create_default_league({ isLoaded: true }))
)

export function leagues_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case app_actions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.leagues.forEach((l) =>
          state.set(l.uid, createLeague({ isLoaded: true, ...l }))
        )
      })

    case league_actions.GET_LEAGUE_PENDING: {
      if (state.has(payload.opts.leagueId)) {
        return state.setIn([payload.opts.leagueId, 'isLoading'], true)
      } else {
        return state.set(
          payload.opts.leagueId,
          createLeague({ isLoading: true })
        )
      }
    }

    case league_actions.GET_LEAGUE_FAILED:
      return state.setIn([payload.opts.leagueId, 'isLoading'], false)

    case league_actions.GET_LEAGUE_FULFILLED:
      return state.set(
        payload.data.uid,
        createLeague({ isLoaded: true, ...payload.data })
      )

    case team_actions.GET_TEAMS_FULFILLED: {
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

    case league_actions.SET_LEAGUE:
    case league_actions.PUT_LEAGUE_FULFILLED:
      return state.setIn(
        [payload.opts.leagueId, payload.opts.field],
        payload.data ? payload.data.value : payload.opts.value
      )

    case app_actions.LOGOUT:
      return initialState

    default:
      return state
  }
}
